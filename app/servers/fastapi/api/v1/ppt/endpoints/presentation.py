import asyncio
from datetime import datetime
import json
import math
import os
import random
import traceback
from typing import Annotated, List, Literal, Optional, Tuple
import dirtyjson
from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, HTTPException, Path, Request, UploadFile
from pydantic import BaseModel as PydanticBaseModel
from models.sql.presentation_version import PresentationVersion
from models.sql.slide_comment import SlideComment
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import delete, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from constants.presentation import DEFAULT_TEMPLATES
from enums.webhook_event import WebhookEvent
from models.api_error_model import APIErrorModel
from models.generate_presentation_request import GeneratePresentationRequest
from models.presentation_and_path import PresentationPathAndEditPath
from models.presentation_from_template import EditPresentationRequest
from models.presentation_outline_model import (
    PresentationOutlineModel,
    SlideOutlineModel,
)
from enums.tone import Tone
from enums.verbosity import Verbosity
from models.pptx_models import PptxPresentationModel
from models.presentation_layout import PresentationLayoutModel, SlideLayoutModel
from models.presentation_structure_model import PresentationStructureModel
from models.presentation_with_slides import (
    PresentationWithSlides,
)
from models.sql.template import TemplateModel

from services.documents_loader import DocumentsLoader
from services.webhook_service import WebhookService
from utils.get_layout_by_name import get_layout_by_name
from services.image_generation_service import ImageGenerationService
from utils.dict_utils import deep_update
from utils.export_utils import export_presentation
from utils.llm_calls.generate_presentation_outlines import generate_ppt_outline
from models.sql.slide import SlideModel
from models.sse_response import SSECompleteResponse, SSEErrorResponse, SSEResponse

from api.auth import get_current_user, get_current_user_optional
from models.sql.user import UserModel
from models.sql.org_member import OrgMemberModel
from services.database import get_async_session
from services.temp_file_service import TEMP_FILE_SERVICE
from services.concurrent_service import CONCURRENT_SERVICE
from models.sql.presentation import PresentationModel
from services.pptx_presentation_creator import PptxPresentationCreator
from services import pptx_designer_template_service as designer_svc
from models.sql.pptx_designer_template import PptxDesignerTemplate as PptxDesignerTemplateModel
from models.sql.async_presentation_generation_status import (
    AsyncPresentationGenerationTaskModel,
)
from utils.asset_directory_utils import get_exports_directory, get_images_directory
from utils.llm_calls.generate_presentation_structure import (
    generate_presentation_structure,
)
from utils.llm_calls.generate_slide_content import (
    get_slide_content_from_type_and_outline,
)
from utils.ppt_utils import (
    get_presentation_title_from_outlines,
    select_toc_or_list_slide_layout_index,
)
from utils.process_slides import (
    process_slide_add_placeholder_assets,
    process_slide_and_fetch_assets,
)
import uuid


PRESENTATION_ROUTER = APIRouter(prefix="/presentation", tags=["Presentation"])


def _build_designer_text_schema(text_boxes: list[dict]) -> dict:
    count = max(len(text_boxes), 1)
    descriptions = []
    for index, box in enumerate(text_boxes):
        original = str(box.get("text") or "")[:90]
        role = "main title/headline" if index == 0 else "body/description text"
        if index > 0 and len(original) <= 30:
            role = "short label or badge"
        descriptions.append(
            f"Slot {index + 1}: {role}. Replace template text \"{original}\" with generated content."
        )
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["__designer_text_boxes__"],
        "properties": {
            "__designer_text_boxes__": {
                "type": "array",
                "minItems": count,
                "maxItems": count,
                "description": " ".join([
                    "Generated text for the selected designer PPTX template text boxes, in visual order.",
                    *descriptions,
                ]),
                "items": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 180,
                },
            }
        },
    }


class TemplateContentGenerateRequest(PydanticBaseModel):
    content: str
    layout: PresentationLayoutModel
    language: str = "English"
    tone: Tone = Tone.DEFAULT
    verbosity: Verbosity = Verbosity.STANDARD
    instructions: Optional[str] = None
    pptx_template_id: Optional[int] = None


async def _resolve_designer_generation_layout(
    presentation: PresentationModel,
    layout: PresentationLayoutModel,
    session: AsyncSession,
) -> PresentationLayoutModel:
    if not presentation.pptx_template_id or layout.name == f"designer-{presentation.pptx_template_id}":
        return layout

    from api.v1.admin.pptx_templates_router import _extract_selectable_slides

    result = await session.execute(
        select(PptxDesignerTemplateModel).where(
            PptxDesignerTemplateModel.id == presentation.pptx_template_id,
            PptxDesignerTemplateModel.is_active == True,  # noqa: E712
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        return layout

    abs_template_path = designer_svc.resolve_template_abs_path(template.file_path)
    designer_slides = [
        slide for slide in _extract_selectable_slides(abs_template_path, [])
        if slide.get("text_boxes")
    ]
    if not designer_slides:
        return layout

    template_id = f"designer-{presentation.pptx_template_id}"
    return PresentationLayoutModel(
        name=template_id,
        ordered=True,
        slides=[
            SlideLayoutModel(
                id=f"{template_id}:slide-{slide['slide_number']}",
                name=f"Designer Slide {slide['slide_number']}",
                description=f"Generate text specifically for slide {slide['slide_number']} of the selected designer PPTX template.",
                json_schema=_build_designer_text_schema(slide["text_boxes"]),
            )
            for slide in designer_slides
        ],
    )


@PRESENTATION_ROUTER.post("/template-content/generate")
async def generate_template_content(
    request: TemplateContentGenerateRequest,
    current_user: UserModel = Depends(get_current_user),
):
    if not request.layout.slides:
        raise HTTPException(status_code=400, detail="Layout slides are required")

    presentation_id = uuid.uuid4()
    image_generation_service = ImageGenerationService(get_images_directory())

    async def generate_slide(index: int, slide_layout: SlideLayoutModel) -> Tuple[SlideModel, list]:
        outline = SlideOutlineModel(
            content=(
                f"User prompt: {request.content}\n\n"
                f"Template page {index + 1} of {len(request.layout.slides)}.\n"
                f"Layout name: {slide_layout.name}.\n"
                f"Layout description: {slide_layout.description or ''}\n"
                "Generate content directly for this exact template page. "
                "Do not create a separate presentation outline."
            )
        )
        slide_content = await get_slide_content_from_type_and_outline(
            slide_layout,
            outline,
            request.language,
            request.tone.value,
            request.verbosity.value,
            request.instructions,
        )
        slide = SlideModel(
            presentation=presentation_id,
            layout_group=request.layout.name,
            layout=slide_layout.id,
            index=index,
            speaker_note=slide_content.get("__speaker_note__", ""),
            content=slide_content,
        )
        process_slide_add_placeholder_assets(slide)
        assets = await process_slide_and_fetch_assets(image_generation_service, slide)
        return slide, assets

    try:
        generated = await asyncio.gather(
            *[
                generate_slide(index, slide_layout)
                for index, slide_layout in enumerate(request.layout.slides)
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=str(e) or "Template content generation failed",
        )

    slides = [slide for slide, _assets in generated]
    title = request.content.strip().splitlines()[0][:80] or "Generated Template"
    return {
        "id": str(presentation_id),
        "title": title,
        "pptx_template_id": request.pptx_template_id,
        "layout": request.layout.model_dump(mode="json"),
        "slides": [slide.model_dump(mode="json") for slide in slides],
    }


@PRESENTATION_ROUTER.get("/all", response_model=List[PresentationWithSlides])
async def get_all_presentations(
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    # Fetch all orgs this user belongs to
    memberships = await sql_session.scalars(
        select(OrgMemberModel).where(OrgMemberModel.user_id == current_user.id)
    )
    user_org_ids = [m.org_id for m in memberships.all()]

    # Build ownership filter:
    #   - presentations owned by this user
    #   OR
    #   - presentations shared with the user's org(s) at team visibility
    conditions = [PresentationModel.user_id == current_user.id]
    if user_org_ids:
        conditions.append(
            and_(
                PresentationModel.org_id.in_(user_org_ids),
                PresentationModel.visibility == "team",
            )
        )

    query = (
        select(PresentationModel, SlideModel)
        .join(
            SlideModel,
            (SlideModel.presentation == PresentationModel.id) & (SlideModel.index == 0),
        )
        .where(or_(*conditions))
        .order_by(PresentationModel.created_at.desc())
    )

    results = await sql_session.execute(query)
    rows = results.all()
    return [
        PresentationWithSlides(**presentation.model_dump(), slides=[first_slide])
        for presentation, first_slide in rows
    ]


@PRESENTATION_ROUTER.get("/{id}", response_model=PresentationWithSlides)
async def get_presentation(
    id: uuid.UUID, sql_session: AsyncSession = Depends(get_async_session)
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")
    slides = await sql_session.scalars(
        select(SlideModel)
        .where(SlideModel.presentation == id)
        .order_by(SlideModel.index)
    )
    return PresentationWithSlides(
        **presentation.model_dump(),
        slides=slides,
    )


@PRESENTATION_ROUTER.delete("/{id}", status_code=204)
async def delete_presentation(
    id: uuid.UUID,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")
    # Only the owner or an admin can delete
    if presentation.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Not authorized to delete this presentation")

    await sql_session.delete(presentation)
    await sql_session.commit()


@PRESENTATION_ROUTER.patch("/{id}/visibility", response_model=PresentationWithSlides)
async def update_presentation_visibility(
    id: uuid.UUID,
    visibility: Annotated[str, Body(embed=True)],
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Toggle a presentation between 'private' (owner-only) and 'team' (shared with org)."""
    if visibility not in ("private", "team"):
        raise HTTPException(400, "visibility must be 'private' or 'team'")

    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(404, "Presentation not found")
    if presentation.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Not authorized to update this presentation")

    # When sharing with the team, attach the user's primary org_id (if any)
    if visibility == "team" and not presentation.org_id:
        membership = await sql_session.scalar(
            select(OrgMemberModel).where(OrgMemberModel.user_id == current_user.id).limit(1)
        )
        if membership:
            presentation.org_id = membership.org_id
        else:
            raise HTTPException(400, "You must belong to a team to share presentations.")

    presentation.visibility = visibility
    sql_session.add(presentation)
    await sql_session.commit()
    await sql_session.refresh(presentation)

    slides = await sql_session.scalars(
        select(SlideModel).where(SlideModel.presentation == id).order_by(SlideModel.index)
    )
    return PresentationWithSlides(**presentation.model_dump(), slides=list(slides.all()))


@PRESENTATION_ROUTER.post("/create", response_model=PresentationModel)
async def create_presentation(
    content: Annotated[str, Body()],
    n_slides: Annotated[int, Body()],
    language: Annotated[str, Body()],
    file_paths: Annotated[Optional[List[str]], Body()] = None,
    tone: Annotated[Tone, Body()] = Tone.DEFAULT,
    verbosity: Annotated[Verbosity, Body()] = Verbosity.STANDARD,
    instructions: Annotated[Optional[str], Body()] = None,
    include_table_of_contents: Annotated[bool, Body()] = False,
    include_title_slide: Annotated[bool, Body()] = True,
    web_search: Annotated[bool, Body()] = False,
    theme: Annotated[Optional[dict], Body()] = None,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    # Free plan: allow exactly 1 active presentation (delete it to make a new one)
    if current_user.plan == "free":
        from sqlalchemy import func
        existing_count = await sql_session.scalar(
            select(func.count(PresentationModel.id)).where(
                PresentationModel.user_id == current_user.id
            )
        )
        if existing_count and existing_count >= 1:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Free plan limit reached. You can have 1 presentation at a time. "
                    "Delete your existing presentation to create a new one, or upgrade to Pro for unlimited presentations."
                ),
            )

    if include_table_of_contents and n_slides < 3:
        raise HTTPException(
            status_code=400,
            detail="Number of slides cannot be less than 3 if table of contents is included",
        )

    # Resolve the user's primary org (for team plans)
    org_id: Optional[int] = None
    if current_user.plan == "team":
        membership = await sql_session.scalar(
            select(OrgMemberModel).where(OrgMemberModel.user_id == current_user.id).limit(1)
        )
        if membership:
            org_id = membership.org_id

    presentation_id = uuid.uuid4()

    presentation = PresentationModel(
        id=presentation_id,
        content=content,
        n_slides=n_slides,
        language=language,
        file_paths=file_paths,
        tone=tone.value,
        verbosity=verbosity.value,
        instructions=instructions,
        include_table_of_contents=include_table_of_contents,
        include_title_slide=include_title_slide,
        web_search=web_search,
        theme=theme,
        user_id=current_user.id,
        org_id=org_id,
        visibility="private",
    )

    sql_session.add(presentation)
    await sql_session.commit()

    return presentation


@PRESENTATION_ROUTER.post("/prepare", response_model=PresentationModel)
async def prepare_presentation(
    presentation_id: Annotated[uuid.UUID, Body()],
    outlines: Annotated[List[SlideOutlineModel], Body()],
    layout: Annotated[PresentationLayoutModel, Body()],
    title: Annotated[Optional[str], Body()] = None,
    pptx_template_id: Annotated[Optional[int], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    if not outlines:
        raise HTTPException(status_code=400, detail="Outlines are required")

    presentation = await sql_session.get(PresentationModel, presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    presentation_outline_model = PresentationOutlineModel(slides=outlines)

    total_slide_layouts = len(layout.slides)
    total_outlines = len(outlines)

    if layout.ordered:
        presentation_structure = layout.to_presentation_structure()
    else:
        presentation_structure: PresentationStructureModel = (
            await generate_presentation_structure(
                presentation_outline=presentation_outline_model,
                presentation_layout=layout,
                instructions=presentation.instructions,
            )
        )

    presentation_structure.slides = presentation_structure.slides[: len(outlines)]
    for index in range(total_outlines):
        random_slide_index = random.randint(0, total_slide_layouts - 1)
        if index >= total_outlines:
            presentation_structure.slides.append(random_slide_index)
            continue
        if presentation_structure.slides[index] >= total_slide_layouts:
            presentation_structure.slides[index] = random_slide_index

    if presentation.include_table_of_contents:
        n_toc_slides = presentation.n_slides - total_outlines
        toc_slide_layout_index = select_toc_or_list_slide_layout_index(layout)
        if toc_slide_layout_index != -1:
            outline_index = 1 if presentation.include_title_slide else 0
            for i in range(n_toc_slides):
                outlines_to = outline_index + 10
                if total_outlines == outlines_to:
                    outlines_to -= 1

                presentation_structure.slides.insert(
                    i + 1 if presentation.include_title_slide else i,
                    toc_slide_layout_index,
                )
                toc_outline = "Table of Contents\n\n"

                for outline in presentation_outline_model.slides[
                    outline_index:outlines_to
                ]:
                    page_number = (
                        outline_index - i + n_toc_slides + 1
                        if presentation.include_title_slide
                        else outline_index - i + n_toc_slides
                    )
                    toc_outline += f"Slide page number: {page_number}\n Slide Content: {outline.content[:100]}\n\n"
                    outline_index += 1

                outline_index += 1

                presentation_outline_model.slides.insert(
                    i + 1 if presentation.include_title_slide else i,
                    SlideOutlineModel(
                        content=toc_outline,
                    ),
                )

    sql_session.add(presentation)
    presentation.outlines = presentation_outline_model.model_dump(mode="json")
    presentation.title = title or presentation.title
    presentation.pptx_template_id = pptx_template_id
    presentation.set_layout(layout)
    presentation.set_structure(presentation_structure)
    await sql_session.commit()

    return presentation


@PRESENTATION_ROUTER.get("/stream/{id}", response_model=PresentationWithSlides)
async def stream_presentation(
    id: uuid.UUID, sql_session: AsyncSession = Depends(get_async_session)
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    if not presentation.structure:
        raise HTTPException(
            status_code=400,
            detail="Presentation not prepared for stream",
        )
    if not presentation.outlines:
        raise HTTPException(
            status_code=400,
            detail="Outlines can not be empty",
        )

    image_generation_service = ImageGenerationService(get_images_directory())

    async def inner():
        try:
            structure = presentation.get_structure()
            layout = await _resolve_designer_generation_layout(
                presentation,
                presentation.get_layout(),
                sql_session,
            )
            presentation.set_layout(layout)
            outline = presentation.get_presentation_outline()

            # These tasks will be gathered and awaited after all slides are generated
            async_assets_generation_tasks = []

            slides: List[SlideModel] = []
            opening_chunk = json.dumps({
                "id": str(presentation.id),
                "title": presentation.title,
                "pptx_template_id": presentation.pptx_template_id,
                "layout": layout.model_dump(),
                "slides": [],
            })
            opening_chunk = opening_chunk.rsplit("[]", 1)[0] + "[ "
            yield SSEResponse(
                event="response",
                data=json.dumps({"type": "chunk", "chunk": opening_chunk}),
            ).to_string()
            for i, slide_layout_index in enumerate(structure.slides):
                slide_layout = layout.slides[slide_layout_index]

                try:
                    slide_content = await get_slide_content_from_type_and_outline(
                        slide_layout,
                        outline.slides[i],
                        presentation.language,
                        presentation.tone,
                        presentation.verbosity,
                        presentation.instructions,
                    )
                except HTTPException as e:
                    yield SSEErrorResponse(detail=e.detail).to_string()
                    return

                slide = SlideModel(
                    presentation=id,
                    layout_group=layout.name,
                    layout=slide_layout.id,
                    index=i,
                    speaker_note=slide_content.get("__speaker_note__", ""),
                    content=slide_content,
                )
                slides.append(slide)

                # This will mutate slide and add placeholder assets
                process_slide_add_placeholder_assets(slide)

                # This will mutate slide - start task immediately so it runs in parallel with next slide LLM generation
                async_assets_generation_tasks.append(
                    asyncio.create_task(process_slide_and_fetch_assets(image_generation_service, slide))
                )

                yield SSEResponse(
                    event="response",
                    data=json.dumps({"type": "chunk", "chunk": slide.model_dump_json()}),
                ).to_string()

            yield SSEResponse(
                event="response",
                data=json.dumps({"type": "chunk", "chunk": " ] }"}),
            ).to_string()

            generated_assets_lists = await asyncio.gather(*async_assets_generation_tasks)
            generated_assets = []
            for assets_list in generated_assets_lists:
                generated_assets.extend(assets_list)

            # Moved this here to make sure new slides are generated before deleting the old ones
            await sql_session.execute(
                delete(SlideModel).where(SlideModel.presentation == id)
            )
            await sql_session.commit()

            sql_session.add(presentation)
            sql_session.add_all(slides)
            sql_session.add_all(generated_assets)
            await sql_session.commit()

            response = PresentationWithSlides(
                **presentation.model_dump(),
                slides=slides,
            )

            yield SSECompleteResponse(
                key="presentation",
                value=response.model_dump(mode="json"),
            ).to_string()
        except Exception as e:
            traceback.print_exc()
            detail = e.detail if isinstance(e, HTTPException) else str(e)
            yield SSEErrorResponse(
                detail=detail or "Presentation generation failed. Please check AI model configuration."
            ).to_string()

    return StreamingResponse(inner(), media_type="text/event-stream")


@PRESENTATION_ROUTER.patch("/update", response_model=PresentationWithSlides)
async def update_presentation(
    request: Request,
    id: Annotated[uuid.UUID, Body()],
    n_slides: Annotated[Optional[int], Body()] = None,
    title: Annotated[Optional[str], Body()] = None,
    theme: Annotated[Optional[dict], Body()] = None,
    slides: Annotated[Optional[List[SlideModel]], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    presentation_update_dict = {}
    request_body = await request.json()
    theme_provided = "theme" in request_body
    if n_slides:
        presentation_update_dict["n_slides"] = n_slides
    if title:
        presentation_update_dict["title"] = title
    if theme_provided:
        presentation_update_dict["theme"] = theme

    if n_slides or title or theme_provided:
        presentation.sqlmodel_update(presentation_update_dict)

    if slides:
        # Just to make sure id is UUID
        for slide in slides:
            slide.presentation = uuid.UUID(slide.presentation)
            slide.id = uuid.UUID(slide.id)

        await sql_session.execute(
            delete(SlideModel).where(SlideModel.presentation == presentation.id)
        )
        sql_session.add_all(slides)

    await sql_session.commit()

    return PresentationWithSlides(
        **presentation.model_dump(),
        slides=slides or [],
    )


async def _apply_designer_template_if_set(
    pptx_model: PptxPresentationModel,
    pptx_path: str,
    session: AsyncSession,
) -> None:
    """If pptx_model.pptx_template_id is set, apply the designer theme to the saved pptx_path."""
    if not pptx_model.pptx_template_id:
        return
    try:
        from sqlmodel import select as _select
        result = await session.execute(
            _select(PptxDesignerTemplateModel).where(
                PptxDesignerTemplateModel.id == pptx_model.pptx_template_id,
                PptxDesignerTemplateModel.is_active == True,  # noqa: E712
            )
        )
        tmpl = result.scalar_one_or_none()
        if not tmpl or not tmpl.file_path:
            return
        abs_template_path = designer_svc.resolve_template_abs_path(tmpl.file_path)
        if not os.path.exists(abs_template_path):
            return

        from pptx import Presentation as _Prs
        prs = _Prs(pptx_path)
        designer_svc.apply_designer_theme(prs, abs_template_path)
        prs.save(pptx_path)
    except Exception as e:
        import logging as _logging
        _logging.getLogger(__name__).warning("Designer theme apply failed (non-fatal): %s", e)


@PRESENTATION_ROUTER.post("/export/pptx")
async def export_presentation_as_pptx(
    pptx_model: Annotated[PptxPresentationModel, Body()],
    session: AsyncSession = Depends(get_async_session),
):
    """Return the generated PPTX file as a binary download (no static-file URL needed)."""
    from pathvalidate import sanitize_filename

    temp_dir = TEMP_FILE_SERVICE.create_temp_dir()
    pptx_creator = PptxPresentationCreator(pptx_model, temp_dir)
    await pptx_creator.create_ppt()

    safe_name = sanitize_filename(pptx_model.name or str(uuid.uuid4()))
    safe_name = safe_name[:200]
    pptx_path = os.path.join(temp_dir, f"{safe_name}.pptx")
    pptx_creator.save(pptx_path)

    await _apply_designer_template_if_set(pptx_model, pptx_path, session)

    return FileResponse(
        path=pptx_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"{safe_name}.pptx",
    )


@PRESENTATION_ROUTER.post("/export/pdf")
async def export_presentation_as_pdf_from_model(
    pptx_model: Annotated[PptxPresentationModel, Body()],
    session: AsyncSession = Depends(get_async_session),
):
    """Generate a PPTX then convert to PDF via LibreOffice and stream the result.

    Fast-path PDF export: the browser supplies the rendered slide attributes so
    we skip Puppeteer entirely (~5-10 s vs 15-60 s).
    """
    import subprocess
    from pathvalidate import sanitize_filename

    temp_dir = TEMP_FILE_SERVICE.create_temp_dir()
    pptx_creator = PptxPresentationCreator(pptx_model, temp_dir)
    await pptx_creator.create_ppt()

    safe_name = sanitize_filename(pptx_model.name or str(uuid.uuid4()))
    pptx_path = os.path.join(temp_dir, f"{safe_name}.pptx")
    pptx_creator.save(pptx_path)

    await _apply_designer_template_if_set(pptx_model, pptx_path, session)

    try:
        result = subprocess.run(
            ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", temp_dir, pptx_path],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"LibreOffice conversion failed: {result.stderr}",
            )
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="LibreOffice is not installed on the server.")

    pdf_path = os.path.join(temp_dir, f"{safe_name}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="PDF file was not created by LibreOffice.")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{safe_name}.pdf",
    )


@PRESENTATION_ROUTER.post("/export", response_model=PresentationPathAndEditPath)
async def export_presentation_as_pptx_or_pdf(
    id: Annotated[uuid.UUID, Body(description="Presentation ID to export")],
    export_as: Annotated[
        Literal["pptx", "pdf"], Body(description="Format to export the presentation as")
    ] = "pptx",
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, id)

    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    presentation_and_path = await export_presentation(
        id,
        presentation.title or str(uuid.uuid4()),
        export_as,
    )

    return PresentationPathAndEditPath(
        **presentation_and_path.model_dump(),
        edit_path=f"/presentation?id={id}",
    )


async def check_if_api_request_is_valid(
    request: GeneratePresentationRequest,
    sql_session: AsyncSession = Depends(get_async_session),
) -> Tuple[uuid.UUID,]:
    presentation_id = uuid.uuid4()
    print(f"Presentation ID: {presentation_id}")

    # Making sure either content, slides markdown or files is provided
    if not (request.content or request.slides_markdown or request.files):
        raise HTTPException(
            status_code=400,
            detail="Either content or slides markdown or files is required to generate presentation",
        )

    # Making sure number of slides is greater than 0
    if request.n_slides <= 0:
        raise HTTPException(
            status_code=400,
            detail="Number of slides must be greater than 0",
        )

    # Checking if template is valid
    if request.template not in DEFAULT_TEMPLATES:
        request.template = request.template.lower()
        if not request.template.startswith("custom-"):
            raise HTTPException(
                status_code=400,
                detail="Template not found. Please use a valid template.",
            )
        template_id = request.template.replace("custom-", "")
        try:
            template = await sql_session.get(TemplateModel, uuid.UUID(template_id))
            if not template:
                raise Exception()
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Template not found. Please use a valid template.",
            )

    return (presentation_id,)


async def generate_presentation_handler(
    request: GeneratePresentationRequest,
    presentation_id: uuid.UUID,
    async_status: Optional[AsyncPresentationGenerationTaskModel],
    sql_session: AsyncSession = Depends(get_async_session),
):
    try:
        using_slides_markdown = False

        if request.slides_markdown:
            using_slides_markdown = True
            request.n_slides = len(request.slides_markdown)

        if not using_slides_markdown:
            additional_context = ""

            # Updating async status
            if async_status:
                async_status.message = "Generating presentation outlines"
                async_status.updated_at = datetime.now()
                sql_session.add(async_status)
                await sql_session.commit()

            if request.files:
                documents_loader = DocumentsLoader(file_paths=request.files)
                await documents_loader.load_documents()
                documents = documents_loader.documents
                if documents:
                    additional_context = "\n\n".join(documents)

            # Finding number of slides to generate by considering table of contents
            n_slides_to_generate = request.n_slides
            if request.include_table_of_contents:
                needed_toc_count = math.ceil(
                    (
                        (request.n_slides - 1)
                        if request.include_title_slide
                        else request.n_slides
                    )
                    / 10
                )
                n_slides_to_generate -= math.ceil(
                    (request.n_slides - needed_toc_count) / 10
                )

            presentation_outlines_text = ""
            async for chunk in generate_ppt_outline(
                request.content,
                n_slides_to_generate,
                request.language,
                additional_context,
                request.tone.value,
                request.verbosity.value,
                request.instructions,
                request.include_title_slide,
                request.web_search,
            ):

                if isinstance(chunk, HTTPException):
                    raise chunk

                presentation_outlines_text += chunk

            try:
                presentation_outlines_json = dict(
                    dirtyjson.loads(presentation_outlines_text)
                )
            except Exception:
                traceback.print_exc()
                raise HTTPException(
                    status_code=400,
                    detail="Failed to generate presentation outlines. Please try again.",
                )
            presentation_outlines = PresentationOutlineModel(
                **presentation_outlines_json
            )
            total_outlines = n_slides_to_generate

        else:
            # Setting outlines to slides markdown
            presentation_outlines = PresentationOutlineModel(
                slides=[
                    SlideOutlineModel(content=slide)
                    for slide in request.slides_markdown
                ]
            )
            total_outlines = len(request.slides_markdown)

        # Updating async status
        if async_status:
            async_status.message = "Selecting layout for each slide"
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        print("-" * 40)
        print(f"Generated {total_outlines} outlines for the presentation")

        # Parse Layouts
        layout_model = await get_layout_by_name(request.template)
        total_slide_layouts = len(layout_model.slides)

        # Generate Structure
        if layout_model.ordered:
            presentation_structure = layout_model.to_presentation_structure()
        else:
            presentation_structure: PresentationStructureModel = (
                await generate_presentation_structure(
                    presentation_outlines,
                    layout_model,
                    request.instructions,
                    using_slides_markdown,
                )
            )

        presentation_structure.slides = presentation_structure.slides[:total_outlines]
        for index in range(total_outlines):
            random_slide_index = random.randint(0, total_slide_layouts - 1)
            if index >= total_outlines:
                presentation_structure.slides.append(random_slide_index)
                continue
            if presentation_structure.slides[index] >= total_slide_layouts:
                presentation_structure.slides[index] = random_slide_index

        # Injecting table of contents to the presentation structure and outlines
        if request.include_table_of_contents and not using_slides_markdown:
            n_toc_slides = request.n_slides - total_outlines
            toc_slide_layout_index = select_toc_or_list_slide_layout_index(layout_model)
            if toc_slide_layout_index != -1:
                outline_index = 1 if request.include_title_slide else 0
                for i in range(n_toc_slides):
                    outlines_to = outline_index + 10
                    if total_outlines == outlines_to:
                        outlines_to -= 1

                    presentation_structure.slides.insert(
                        i + 1 if request.include_title_slide else i,
                        toc_slide_layout_index,
                    )
                    toc_outline = "Table of Contents\n\n"

                    for outline in presentation_outlines.slides[
                        outline_index:outlines_to
                    ]:
                        page_number = (
                            outline_index - i + n_toc_slides + 1
                            if request.include_title_slide
                            else outline_index - i + n_toc_slides
                        )
                        toc_outline += f"Slide page number: {page_number}\n Slide Content: {outline.content[:100]}\n\n"
                        outline_index += 1

                    outline_index += 1

                    presentation_outlines.slides.insert(
                        i + 1 if request.include_title_slide else i,
                        SlideOutlineModel(
                            content=toc_outline,
                        ),
                    )

        # Create PresentationModel
        presentation = PresentationModel(
            id=presentation_id,
            content=request.content,
            n_slides=request.n_slides,
            language=request.language,
            title=get_presentation_title_from_outlines(presentation_outlines),
            outlines=presentation_outlines.model_dump(),
            layout=layout_model.model_dump(),
            structure=presentation_structure.model_dump(),
            tone=request.tone.value,
            verbosity=request.verbosity.value,
            instructions=request.instructions,
        )

        # Updating async status
        if async_status:
            async_status.message = "Generating slides"
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        image_generation_service = ImageGenerationService(get_images_directory())
        async_assets_generation_tasks = []

        # 7. Generate slide content concurrently (batched), then build slides and fetch assets
        slides: List[SlideModel] = []

        slide_layout_indices = presentation_structure.slides
        slide_layouts = [layout_model.slides[idx] for idx in slide_layout_indices]

        # Schedule slide content generation and asset fetching in batches of 10
        batch_size = 10
        for start in range(0, len(slide_layouts), batch_size):
            end = min(start + batch_size, len(slide_layouts))

            print(f"Generating slides from {start} to {end}")

            # Generate contents for this batch concurrently
            content_tasks = [
                get_slide_content_from_type_and_outline(
                    slide_layouts[i],
                    presentation_outlines.slides[i],
                    request.language,
                    request.tone.value,
                    request.verbosity.value,
                    request.instructions,
                )
                for i in range(start, end)
            ]
            batch_contents: List[dict] = await asyncio.gather(*content_tasks)

            # Build slides for this batch
            batch_slides: List[SlideModel] = []
            for offset, slide_content in enumerate(batch_contents):
                i = start + offset
                slide_layout = slide_layouts[i]
                slide = SlideModel(
                    presentation=presentation_id,
                    layout_group=layout_model.name,
                    layout=slide_layout.id,
                    index=i,
                    speaker_note=slide_content.get("__speaker_note__"),
                    content=slide_content,
                )
                slides.append(slide)
                batch_slides.append(slide)

            # Start asset fetch tasks immediately so they run in parallel with next batch's LLM calls
            asset_tasks = [
                asyncio.create_task(process_slide_and_fetch_assets(image_generation_service, slide))
                for slide in batch_slides
            ]
            async_assets_generation_tasks.extend(asset_tasks)

        if async_status:
            async_status.message = "Fetching assets for slides"
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        # Run all asset tasks concurrently while batches may still be generating content
        generated_assets_list = await asyncio.gather(*async_assets_generation_tasks)
        generated_assets = []
        for assets_list in generated_assets_list:
            generated_assets.extend(assets_list)

        # 8. Save PresentationModel and Slides
        sql_session.add(presentation)
        sql_session.add_all(slides)
        sql_session.add_all(generated_assets)
        await sql_session.commit()

        if async_status:
            async_status.message = "Exporting presentation"
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)

        # 9. Export
        presentation_and_path = await export_presentation(
            presentation_id, presentation.title or str(uuid.uuid4()), request.export_as
        )

        response = PresentationPathAndEditPath(
            **presentation_and_path.model_dump(),
            edit_path=f"/presentation?id={presentation_id}",
        )

        if async_status:
            async_status.message = "Presentation generation completed"
            async_status.status = "completed"
            async_status.data = response.model_dump(mode="json")
            async_status.updated_at = datetime.now()
            sql_session.add(async_status)
            await sql_session.commit()

        # Triggering webhook on success
        CONCURRENT_SERVICE.run_task(
            None,
            WebhookService.send_webhook,
            WebhookEvent.PRESENTATION_GENERATION_COMPLETED,
            response.model_dump(mode="json"),
        )

        return response

    except Exception as e:
        if not isinstance(e, HTTPException):
            traceback.print_exc()
            e = HTTPException(status_code=500, detail="Presentation generation failed")

        api_error_model = APIErrorModel.from_exception(e)

        # Triggering webhook on failure
        CONCURRENT_SERVICE.run_task(
            None,
            WebhookService.send_webhook,
            WebhookEvent.PRESENTATION_GENERATION_FAILED,
            api_error_model.model_dump(mode="json"),
        )

        if async_status:
            async_status.status = "error"
            async_status.message = "Presentation generation failed"
            async_status.updated_at = datetime.now()
            async_status.error = api_error_model.model_dump(mode="json")
            sql_session.add(async_status)
            await sql_session.commit()

        else:
            raise e


@PRESENTATION_ROUTER.post("/generate", response_model=PresentationPathAndEditPath)
async def generate_presentation_sync(
    request: GeneratePresentationRequest,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    try:
        # Free plan: 1 active presentation slot
        if current_user.plan == "free":
            from sqlalchemy import func
            existing_count = await sql_session.scalar(
                select(func.count(PresentationModel.id)).where(
                    PresentationModel.user_id == current_user.id
                )
            )
            if existing_count and existing_count >= 1:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Free plan limit reached. You can have 1 presentation at a time. "
                        "Delete your existing presentation to create a new one, or upgrade to Pro for unlimited presentations."
                    ),
                )
        # Pro/Team: soft monthly cap check
        from utils.rate_limit import check_soft_cap
        under_cap, current_count, cap = await check_soft_cap(current_user.id, current_user.plan)
        if not under_cap:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"You've generated {current_count} presentations this month, which exceeds the "
                    f"soft limit of {cap} for the {current_user.plan.title()} plan. "
                    "Please contact support if you need a higher limit or are interested in an enterprise plan."
                ),
            )
        (presentation_id,) = await check_if_api_request_is_valid(request, sql_session)
        return await generate_presentation_handler(
            request, presentation_id, None, sql_session
        )
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Presentation generation failed")


@PRESENTATION_ROUTER.post(
    "/generate/async", response_model=AsyncPresentationGenerationTaskModel
)
async def generate_presentation_async(
    request: GeneratePresentationRequest,
    background_tasks: BackgroundTasks,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    try:
        # Free plan: 1 active presentation slot
        if current_user.plan == "free":
            from sqlalchemy import func
            existing_count = await sql_session.scalar(
                select(func.count(PresentationModel.id)).where(
                    PresentationModel.user_id == current_user.id
                )
            )
            if existing_count and existing_count >= 1:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Free plan limit reached. You can have 1 presentation at a time. "
                        "Delete your existing presentation to create a new one, or upgrade to Pro for unlimited presentations."
                    ),
                )
        # Pro/Team: soft monthly cap check
        from utils.rate_limit import check_soft_cap
        under_cap, current_count, cap = await check_soft_cap(current_user.id, current_user.plan)
        if not under_cap:
            raise HTTPException(
                status_code=429,
                detail=(
                    f"You've generated {current_count} presentations this month, which exceeds the "
                    f"soft limit of {cap} for the {current_user.plan.title()} plan. "
                    "Please contact support if you need a higher limit or are interested in an enterprise plan."
                ),
            )

        (presentation_id,) = await check_if_api_request_is_valid(request, sql_session)

        async_status = AsyncPresentationGenerationTaskModel(
            status="pending",
            message="Queued for generation",
            data=None,
        )
        sql_session.add(async_status)
        await sql_session.commit()

        background_tasks.add_task(
            generate_presentation_handler,
            request,
            presentation_id,
            async_status=async_status,
            sql_session=sql_session,
        )
        return async_status

    except Exception as e:
        if not isinstance(e, HTTPException):
            print(e)
            e = HTTPException(status_code=500, detail="Presentation generation failed")

        raise e


@PRESENTATION_ROUTER.get(
    "/status/{id}", response_model=AsyncPresentationGenerationTaskModel
)
async def check_async_presentation_generation_status(
    id: str = Path(description="ID of the presentation generation task"),
    sql_session: AsyncSession = Depends(get_async_session),
):
    status = await sql_session.get(AsyncPresentationGenerationTaskModel, id)
    if not status:
        raise HTTPException(
            status_code=404, detail="No presentation generation task found"
        )
    return status


@PRESENTATION_ROUTER.post("/edit", response_model=PresentationPathAndEditPath)
async def edit_presentation_with_new_content(
    data: Annotated[EditPresentationRequest, Body()],
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, data.presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides = await sql_session.scalars(
        select(SlideModel).where(SlideModel.presentation == data.presentation_id)
    )

    new_slides = []
    slides_to_delete = []
    for each_slide in slides:
        updated_content = None
        new_slide_data = list(
            filter(lambda x: x.index == each_slide.index, data.slides)
        )
        if new_slide_data:
            updated_content = deep_update(each_slide.content, new_slide_data[0].content)
            new_slides.append(
                each_slide.get_new_slide(presentation.id, updated_content)
            )
            slides_to_delete.append(each_slide.id)

    await sql_session.execute(
        delete(SlideModel).where(SlideModel.id.in_(slides_to_delete))
    )

    sql_session.add_all(new_slides)
    await sql_session.commit()

    presentation_and_path = await export_presentation(
        presentation.id, presentation.title or str(uuid.uuid4()), data.export_as
    )

    return PresentationPathAndEditPath(
        **presentation_and_path.model_dump(),
        edit_path=f"/presentation?id={presentation.id}",
    )


@PRESENTATION_ROUTER.post("/derive", response_model=PresentationPathAndEditPath)
async def derive_presentation_from_existing_one(
    data: Annotated[EditPresentationRequest, Body()],
    sql_session: AsyncSession = Depends(get_async_session),
):
    presentation = await sql_session.get(PresentationModel, data.presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides = await sql_session.scalars(
        select(SlideModel).where(SlideModel.presentation == data.presentation_id)
    )

    new_presentation = presentation.get_new_presentation()
    new_slides = []
    for each_slide in slides:
        updated_content = None
        new_slide_data = list(
            filter(lambda x: x.index == each_slide.index, data.slides)
        )
        if new_slide_data:
            updated_content = deep_update(each_slide.content, new_slide_data[0].content)
        new_slides.append(
            each_slide.get_new_slide(new_presentation.id, updated_content)
        )

    sql_session.add(new_presentation)
    sql_session.add_all(new_slides)
    await sql_session.commit()

    presentation_and_path = await export_presentation(
        new_presentation.id, new_presentation.title or str(uuid.uuid4()), data.export_as
    )

    return PresentationPathAndEditPath(
        **presentation_and_path.model_dump(),
        edit_path=f"/presentation?id={new_presentation.id}",
    )


# ─── Version History ──────────────────────────────────────────────────────────

@PRESENTATION_ROUTER.post("/{presentation_id}/versions")
async def save_version(
    presentation_id: uuid.UUID,
    label: Annotated[Optional[str], Body(embed=True)] = None,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Snapshot the current slide set as a new version."""
    presentation = await sql_session.get(PresentationModel, presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    slides_result = await sql_session.scalars(
        select(SlideModel)
        .where(SlideModel.presentation == presentation_id)
        .order_by(SlideModel.index)
    )
    slides = slides_result.all()

    # Count existing versions
    count_result = await sql_session.execute(
        select(PresentationVersion)
        .where(PresentationVersion.presentation_id == str(presentation_id))
        .order_by(PresentationVersion.version_number.desc())
        .limit(1)
    )
    last_version = count_result.scalar_one_or_none()
    next_number = (last_version.version_number + 1) if last_version else 1

    snapshot = [
        {
            "id": str(s.id),
            "index": s.index,
            "layout": s.layout,
            "layout_group": s.layout_group,
            "content": s.content,
            "speaker_note": s.speaker_note,
        }
        for s in slides
    ]

    version = PresentationVersion(
        presentation_id=str(presentation_id),
        version_number=next_number,
        label=label or f"Version {next_number}",
        snapshot={"slides": snapshot, "title": presentation.title},
    )
    sql_session.add(version)
    await sql_session.commit()
    return {"id": version.id, "version_number": version.version_number, "label": version.label}


@PRESENTATION_ROUTER.get("/{presentation_id}/versions")
async def list_versions(
    presentation_id: uuid.UUID,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """List all saved versions for a presentation."""
    result = await sql_session.execute(
        select(PresentationVersion)
        .where(PresentationVersion.presentation_id == str(presentation_id))
        .order_by(PresentationVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return [
        {
            "id": v.id,
            "version_number": v.version_number,
            "label": v.label,
            "slide_count": len((v.snapshot or {}).get("slides", [])),
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


@PRESENTATION_ROUTER.post("/{presentation_id}/versions/{version_id}/restore")
async def restore_version(
    presentation_id: uuid.UUID,
    version_id: int,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Restore a presentation to a saved version snapshot."""
    presentation = await sql_session.get(PresentationModel, presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    version_result = await sql_session.execute(
        select(PresentationVersion)
        .where(
            PresentationVersion.id == version_id,
            PresentationVersion.presentation_id == str(presentation_id),
        )
    )
    version = version_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    snapshot = version.snapshot or {}
    slide_snapshots = snapshot.get("slides", [])

    # Delete current slides and restore from snapshot
    await sql_session.execute(
        delete(SlideModel).where(SlideModel.presentation == presentation_id)
    )

    new_slides = [
        SlideModel(
            id=uuid.uuid4(),
            presentation=presentation_id,
            index=s["index"],
            layout=s["layout"],
            layout_group=s.get("layout_group", ""),
            content=s.get("content", {}),
            speaker_note=s.get("speaker_note", ""),
        )
        for s in slide_snapshots
    ]
    sql_session.add_all(new_slides)
    await sql_session.commit()
    return {"ok": True, "restored_slides": len(new_slides)}


# ─── Magic Resize ─────────────────────────────────────────────────────────────

# Standard aspect ratios (width:height in px at 96 dpi for slides)
ASPECT_RATIOS: dict[str, tuple[float, float]] = {
    "16:9":  (1280, 720),   # widescreen default
    "4:3":   (1024, 768),   # classic
    "9:16":  (720, 1280),   # mobile / social
    "1:1":   (1080, 1080),  # square / LinkedIn
    "A4":    (1240, 1754),  # portrait document
}


class ResizeRequest(PydanticBaseModel):
    aspect_ratio: str  # key from ASPECT_RATIOS


@PRESENTATION_ROUTER.post("/{presentation_id}/resize")
async def resize_presentation(
    presentation_id: uuid.UUID,
    body: ResizeRequest,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """
    Store the chosen aspect ratio on the presentation theme.
    The slide renderer and PPTX creator read theme.aspect_ratio to adjust dimensions.
    """
    if body.aspect_ratio not in ASPECT_RATIOS:
        raise HTTPException(
            status_code=400,
            detail=f"aspect_ratio must be one of: {', '.join(ASPECT_RATIOS.keys())}",
        )

    presentation = await sql_session.get(PresentationModel, presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    w, h = ASPECT_RATIOS[body.aspect_ratio]
    theme = dict(presentation.theme or {})
    theme["aspect_ratio"] = body.aspect_ratio
    theme["slide_width_px"] = w
    theme["slide_height_px"] = h
    presentation.theme = theme
    await sql_session.commit()

    return {
        "aspect_ratio": body.aspect_ratio,
        "width_px": w,
        "height_px": h,
    }


# ─── PPTX Import ─────────────────────────────────────────────────────────────

@PRESENTATION_ROUTER.post("/import")
async def import_pptx(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Import a .pptx file and create a new presentation from it."""
    import tempfile
    import os as _os
    from pptx import Presentation as PptxPresentation  # type: ignore

    if not file.filename or not file.filename.lower().endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Only .pptx files are supported")

    content_bytes = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(content_bytes)
        tmp_path = tmp.name

    try:
        prs = PptxPresentation(tmp_path)
        title = file.filename.replace(".pptx", "").replace("_", " ").strip() or "Imported Presentation"

        # Create the presentation
        new_presentation = PresentationModel(
            user_id=current_user.id,
            title=title,
            n_slides=len(prs.slides),
            theme={},
            structure={},
            language="English",
        )
        sql_session.add(new_presentation)
        await sql_session.flush()

        slides_to_add = []
        for i, pptx_slide in enumerate(prs.slides):
            # Extract text from shapes
            texts: dict[str, str] = {}
            body_items = []
            for shape in pptx_slide.shapes:
                if not hasattr(shape, "text_frame"):
                    continue
                text = shape.text_frame.text.strip() if shape.text_frame else ""
                if not text:
                    continue
                if i == 0 or shape.shape_id == 1:
                    texts["title"] = text
                else:
                    body_items.append(text)

            if not texts.get("title") and body_items:
                texts["title"] = body_items.pop(0)

            # Extract speaker notes
            notes_text = ""
            if pptx_slide.has_notes_slide:
                try:
                    notes_text = pptx_slide.notes_slide.notes_text_frame.text.strip()
                except Exception:
                    pass

            content = {
                "title": texts.get("title", f"Slide {i + 1}"),
                "body_items": body_items,
            }

            slide_model = SlideModel(
                id=uuid.uuid4(),
                presentation=new_presentation.id,
                layout="neo-general:neo_general_title_and_content",
                layout_group="neo-general",
                index=i,
                content=content,
                speaker_note=notes_text,
                properties={},
            )
            slides_to_add.append(slide_model)

        sql_session.add_all(slides_to_add)
        await sql_session.commit()

        return {
            "presentation_id": str(new_presentation.id),
            "title": title,
            "slide_count": len(slides_to_add),
            "edit_url": f"/presentation?id={new_presentation.id}&type=standard",
        }
    finally:
        _os.unlink(tmp_path)


# ─── Slide Comments ───────────────────────────────────────────────────────────

class CommentCreateRequest(PydanticBaseModel):
    slide_index: int
    body: str
    parent_id: Optional[int] = None


class CommentPatchRequest(PydanticBaseModel):
    resolved: Optional[bool] = None
    body: Optional[str] = None


@PRESENTATION_ROUTER.get("/{presentation_id}/comments")
async def list_comments(
    presentation_id: uuid.UUID,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    result = await sql_session.execute(
        select(SlideComment)
        .where(SlideComment.presentation_id == str(presentation_id))
        .order_by(SlideComment.created_at.asc())
    )
    comments = result.scalars().all()
    return [
        {
            "id": c.id,
            "slide_index": c.slide_index,
            "user_id": c.user_id,
            "user_name": c.user_name,
            "body": c.body,
            "resolved": c.resolved,
            "parent_id": c.parent_id,
            "created_at": c.created_at.isoformat(),
        }
        for c in comments
    ]


@PRESENTATION_ROUTER.post("/{presentation_id}/comments")
async def create_comment(
    presentation_id: uuid.UUID,
    body: CommentCreateRequest,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    comment = SlideComment(
        presentation_id=str(presentation_id),
        slide_index=body.slide_index,
        user_id=current_user.id,
        user_name=current_user.full_name or current_user.email or "User",
        body=body.body,
        parent_id=body.parent_id,
    )
    sql_session.add(comment)
    await sql_session.commit()
    return {
        "id": comment.id,
        "slide_index": comment.slide_index,
        "user_id": comment.user_id,
        "user_name": comment.user_name,
        "body": comment.body,
        "resolved": comment.resolved,
        "parent_id": comment.parent_id,
        "created_at": comment.created_at.isoformat(),
    }


@PRESENTATION_ROUTER.patch("/{presentation_id}/comments/{comment_id}")
async def update_comment(
    presentation_id: uuid.UUID,
    comment_id: int,
    body: CommentPatchRequest,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    result = await sql_session.execute(
        select(SlideComment).where(
            SlideComment.id == comment_id,
            SlideComment.presentation_id == str(presentation_id),
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if body.resolved is not None:
        comment.resolved = body.resolved
    if body.body is not None:
        comment.body = body.body
    comment.updated_at = datetime.utcnow()
    await sql_session.commit()
    return {"ok": True}


@PRESENTATION_ROUTER.delete("/{presentation_id}/comments/{comment_id}")
async def delete_comment(
    presentation_id: uuid.UUID,
    comment_id: int,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    result = await sql_session.execute(
        select(SlideComment).where(
            SlideComment.id == comment_id,
            SlideComment.presentation_id == str(presentation_id),
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised")
    await sql_session.delete(comment)
    await sql_session.commit()
    return {"ok": True}
