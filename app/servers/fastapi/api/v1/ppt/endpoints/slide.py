import copy
from typing import Annotated, Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from models.sql.user import UserModel
from services.database import get_async_session
from services.image_generation_service import ImageGenerationService
from utils.asset_directory_utils import get_images_directory
from utils.llm_calls.edit_slide import get_edited_slide_content
from utils.llm_calls.edit_slide_html import get_edited_slide_html
from utils.llm_calls.select_slide_type_on_edit import get_slide_layout_from_prompt
from utils.process_slides import process_old_and_new_slides_and_fetch_assets
from api.auth import get_current_user
import uuid


SLIDE_ROUTER = APIRouter(prefix="/slide", tags=["Slide"])


@SLIDE_ROUTER.post("/edit")
async def edit_slide(
    id: Annotated[uuid.UUID, Body()],
    prompt: Annotated[str, Body()],
    sql_session: AsyncSession = Depends(get_async_session),
):
    slide = await sql_session.get(SlideModel, id)
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    presentation = await sql_session.get(PresentationModel, slide.presentation)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    presentation_layout = presentation.get_layout()
    slide_layout = await get_slide_layout_from_prompt(
        prompt, presentation_layout, slide
    )

    edited_slide_content = await get_edited_slide_content(
        prompt, slide, presentation.language, slide_layout
    )

    image_generation_service = ImageGenerationService(get_images_directory())

    # This will mutate edited_slide_content
    new_assets = await process_old_and_new_slides_and_fetch_assets(
        image_generation_service,
        slide.content,
        edited_slide_content,
    )

    slide.content = edited_slide_content
    slide.layout = slide_layout.id
    slide.speaker_note = edited_slide_content.get("__speaker_note__", "")
    sql_session.add(slide)
    sql_session.add_all(new_assets)
    await sql_session.commit()
    await sql_session.refresh(slide)

    return slide


@SLIDE_ROUTER.patch("/{slide_id}/note")
async def update_slide_note(
    slide_id: uuid.UUID,
    note: Annotated[str, Body(embed=True)],
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Update only the speaker_note field of a single slide."""
    slide = await sql_session.get(SlideModel, slide_id)
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")
    slide.speaker_note = note
    await sql_session.commit()
    return {"ok": True}


@SLIDE_ROUTER.post("/edit-html", response_model=SlideModel)
async def edit_slide_html(
    id: Annotated[uuid.UUID, Body()],
    prompt: Annotated[str, Body()],
    html: Annotated[Optional[str], Body()] = None,
    sql_session: AsyncSession = Depends(get_async_session),
):
    slide = await sql_session.get(SlideModel, id)
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    html_to_edit = html or slide.html_content
    if not html_to_edit:
        raise HTTPException(status_code=400, detail="No HTML to edit")

    edited_slide_html = await get_edited_slide_html(prompt, html_to_edit)

    slide.html_content = edited_slide_html
    sql_session.add(slide)
    await sql_session.commit()
    await sql_session.refresh(slide)

    return slide


class EditElementRequest(PydanticBaseModel):
    slide_id: uuid.UUID
    # Dot-path into slide.content, e.g. "title" or "body_items.0"
    element_path: str
    prompt: str
    element_type: str = "text"  # "text" | "image"


@SLIDE_ROUTER.post("/edit-element")
async def edit_element(
    body: EditElementRequest,
    current_user: UserModel = Depends(get_current_user),
    sql_session: AsyncSession = Depends(get_async_session),
):
    """Edit a single text or image element on a slide using AI."""
    slide = await sql_session.get(SlideModel, body.slide_id)
    if not slide:
        raise HTTPException(status_code=404, detail="Slide not found")

    if body.element_type == "image":
        # For images: search for a new image based on the prompt
        from models.image_prompt import ImagePrompt
        image_gen_svc = ImageGenerationService(get_images_directory())
        img_prompt = ImagePrompt(prompt=body.prompt, theme_prompt="")
        result = await image_gen_svc.generate_image(img_prompt)
        # Determine the URL/path
        if isinstance(result, str):
            new_url = result
            new_asset = None
        else:
            new_url = f"/api/v1/images/{result.id}" if hasattr(result, "id") else ""
            new_asset = result

        content = copy.deepcopy(slide.content or {})
        _set_nested(content, body.element_path, new_url)
        slide.content = content
        if new_asset:
            sql_session.add(new_asset)
        await sql_session.commit()
        await sql_session.refresh(slide)
        return {"updated_content": slide.content}
    else:
        # For text: use LLM to rewrite the targeted text
        from services.llm_client import LLMClient
        from utils.llm_provider import get_model
        from models.llm_message import LLMSystemMessage, LLMUserMessage

        content = slide.content or {}
        current_text = _get_nested(content, body.element_path) or ""

        llm_client = LLMClient()
        model = get_model()
        messages = [
            LLMSystemMessage(content="Rewrite the following text based on the instruction. Return ONLY the rewritten text, nothing else."),
            LLMUserMessage(content=f"Text: {current_text}\n\nInstruction: {body.prompt}"),
        ]
        response = await llm_client.completion(model=model, messages=messages)
        new_text = response.choices[0].message.content.strip() if response else current_text

        new_content = copy.deepcopy(content)
        _set_nested(new_content, body.element_path, new_text)
        slide.content = new_content
        await sql_session.commit()
        await sql_session.refresh(slide)
        return {"updated_content": slide.content}


def _get_nested(d: dict, path: str):
    """Get value from nested dict/list using dot-path like 'body_items.0'."""
    keys = path.split(".")
    cur = d
    for k in keys:
        if cur is None:
            return None
        if isinstance(cur, list):
            try:
                cur = cur[int(k)]
            except (ValueError, IndexError):
                return None
        elif isinstance(cur, dict):
            cur = cur.get(k)
        else:
            return None
    return cur


def _set_nested(d: dict, path: str, value):
    """Set value in nested dict/list using dot-path."""
    keys = path.split(".")
    cur = d
    for i, k in enumerate(keys[:-1]):
        if isinstance(cur, list):
            try:
                cur = cur[int(k)]
            except (ValueError, IndexError):
                return
        elif isinstance(cur, dict):
            cur = cur.setdefault(k, {})
    last_key = keys[-1]
    if isinstance(cur, list):
        try:
            cur[int(last_key)] = value
        except (ValueError, IndexError):
            pass
    elif isinstance(cur, dict):
        cur[last_key] = value
