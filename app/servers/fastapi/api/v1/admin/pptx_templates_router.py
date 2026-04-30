"""
Admin endpoints for designer-uploaded PPTX templates.

POST /admin/pptx-templates          → upload a .pptx file
GET  /admin/pptx-templates          → list all templates
PUT  /admin/pptx-templates/{id}     → update name/desc/tier/active/order
DELETE /admin/pptx-templates/{id}   → soft-delete (is_active=False) or hard delete
"""
import asyncio
import io
import logging
import zipfile
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from api.auth import get_current_user
from models.sql.user import UserModel
from models.sql.pptx_designer_template import PptxDesignerTemplate
from services.database import get_async_session
from services import pptx_designer_template_service as svc
from utils.get_env import get_app_data_directory_env

logger = logging.getLogger(__name__)

PPTX_TEMPLATES_ROUTER = APIRouter(prefix="/api/v1/admin/pptx-templates", tags=["admin-pptx-templates"])
PUBLIC_PPTX_TEMPLATES_ROUTER = APIRouter(prefix="/api/v1/account/pptx-templates", tags=["pptx-templates"])

MAX_PPTX_SIZE_BYTES = 50 * 1024 * 1024
MAX_ZIP_SIZE_BYTES = 250 * 1024 * 1024
MAX_PPTX_FILES_PER_ZIP = 100

PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
DML_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PML = f"{{{PML_NS}}}"
DML = f"{{{DML_NS}}}"
EMU_PER_INCH = 914400


def _require_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _row_to_dict(r: PptxDesignerTemplate, base_url: str = "/api/v1/pptx-template-thumbs") -> dict:
    thumbs = []
    if r.thumbnail_paths:
        thumbs = [f"{base_url}/{p}" for p in r.thumbnail_paths]
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "tier": r.tier,
        "is_active": r.is_active,
        "sort_order": r.sort_order,
        "slide_count": r.slide_count,
        "thumbnail_urls": thumbs,
        "file_url": f"/api/v1/account/pptx-templates/{r.id}/download",
        "color_scheme": r.color_scheme,
        "font_scheme": r.font_scheme,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


# ─── Admin CRUD ───────────────────────────────────────────────────────────────

async def _next_sort_order(session: AsyncSession) -> int:
    result = await session.execute(select(PptxDesignerTemplate))
    existing = result.scalars().all()
    return max((r.sort_order for r in existing), default=-1) + 1


async def _repair_incomplete_thumbnails(
    row: PptxDesignerTemplate,
    session: AsyncSession,
) -> None:
    thumb_count = len(row.thumbnail_paths or [])
    if not row.thumbnail_paths or row.slide_count <= 0 or thumb_count >= row.slide_count:
        return

    logger.info(
        "Regenerating incomplete thumbnails for pptx_designer_template id=%s (%s/%s)",
        row.id,
        thumb_count,
        row.slide_count,
    )
    abs_path = svc.resolve_template_abs_path(row.file_path)
    if not Path(abs_path).exists():
        logger.warning(
            "Skipping thumbnail repair for pptx_designer_template id=%s; source file missing: %s",
            row.id,
            abs_path,
        )
        return
    row.thumbnail_paths = await svc.generate_thumbnails(
        abs_path,
        str(row.id),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)


async def _create_pptx_template_row(
    *,
    file_bytes: bytes,
    name: str,
    description: str,
    tier: str,
    sort_order: int,
    session: AsyncSession,
) -> tuple[PptxDesignerTemplate, str]:
    abs_path, rel_path = svc.save_pptx_file(file_bytes)

    slide_count = svc.count_slides(abs_path)
    color_scheme, font_scheme = svc.extract_theme_info(abs_path)

    template = PptxDesignerTemplate(
        name=name,
        description=description,
        tier=tier,
        is_active=True,
        sort_order=sort_order,
        file_path=rel_path,
        slide_count=slide_count,
        color_scheme=color_scheme or None,
        font_scheme=font_scheme or None,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)

    return template, abs_path


def _template_name_from_zip_path(zip_path: str) -> str:
    stem = Path(zip_path).stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in stem.split()) or "Untitled Template"


def _pptx_slide_size(zip_file: zipfile.ZipFile) -> tuple[int, int]:
    try:
        root = ET.fromstring(zip_file.read("ppt/presentation.xml"))
        size = root.find(f"{PML}sldSz")
        if size is not None:
            return int(size.get("cx", "12192000")), int(size.get("cy", "6858000"))
    except Exception:
        pass
    return 12192000, 6858000


def _extract_shape_text(shape: ET.Element) -> str:
    paragraphs: list[str] = []
    tx_body = shape.find(f"{PML}txBody")
    if tx_body is None:
        return ""

    for para in tx_body.findall(f"{DML}p"):
        parts = []
        for text_node in para.findall(f".//{DML}t"):
            if text_node.text:
                parts.append(text_node.text)
        paragraph_text = "".join(parts).strip()
        if paragraph_text:
            paragraphs.append(paragraph_text)
    return "\n".join(paragraphs).strip()


def _extract_shape_box(shape: ET.Element, slide_width: int, slide_height: int) -> Optional[dict]:
    xfrm = shape.find(f".//{DML}xfrm")
    if xfrm is None:
        return None
    off = xfrm.find(f"{DML}off")
    ext = xfrm.find(f"{DML}ext")
    if off is None or ext is None:
        return None

    try:
        x = int(off.get("x", "0"))
        y = int(off.get("y", "0"))
        cx = int(ext.get("cx", "0"))
        cy = int(ext.get("cy", "0"))
    except ValueError:
        return None

    return {
        "left_pct": (x / slide_width) * 100,
        "top_pct": (y / slide_height) * 100,
        "width_pct": (cx / slide_width) * 100,
        "height_pct": (cy / slide_height) * 100,
    }


def _extract_font_size(shape: ET.Element) -> Optional[float]:
    sizes: list[int] = []
    for rpr in shape.findall(f".//{DML}rPr"):
        size = rpr.get("sz")
        if size and size.isdigit():
            sizes.append(int(size))
    if not sizes:
        return None
    # PowerPoint stores font size in hundredths of a point.
    return max(6, min(72, round((sum(sizes) / len(sizes)) / 100, 1)))


def _extract_selectable_slides(
    abs_path: Path,
    thumbnail_urls: list[str],
    background_thumbnail_urls: list[str] | None = None,
) -> list[dict]:
    slides: list[dict] = []
    with zipfile.ZipFile(abs_path) as z:
        slide_width, slide_height = _pptx_slide_size(z)
        slide_names = sorted(
            [
                name for name in z.namelist()
                if name.startswith("ppt/slides/slide") and name.endswith(".xml")
            ],
            key=lambda name: int(Path(name).stem.replace("slide", "") or "0"),
        )

        for index, slide_name in enumerate(slide_names):
            root = ET.fromstring(z.read(slide_name))
            text_boxes = []
            for shape in root.findall(f".//{PML}sp"):
                text = _extract_shape_text(shape)
                if not text:
                    continue
                box = _extract_shape_box(shape, slide_width, slide_height)
                if not box:
                    continue
                text_boxes.append({
                    **box,
                    "text": text,
                    "font_size_pt": _extract_font_size(shape),
                })
            image_boxes = []
            for image in root.findall(f".//{PML}pic"):
                box = _extract_shape_box(image, slide_width, slide_height)
                if not box:
                    continue
                image_boxes.append(box)

            slides.append({
                "slide_number": index + 1,
                "thumbnail_url": thumbnail_urls[index] if index < len(thumbnail_urls) else None,
                "background_thumbnail_url": (
                    background_thumbnail_urls[index]
                    if background_thumbnail_urls and index < len(background_thumbnail_urls)
                    else thumbnail_urls[index] if index < len(thumbnail_urls) else None
                ),
                "text_boxes": text_boxes,
                "image_boxes": image_boxes,
            })
    return slides

@PPTX_TEMPLATES_ROUTER.post("")
async def upload_pptx_template(
    name: str = Form(...),
    description: str = Form(""),
    tier: str = Form("free"),
    file: UploadFile = File(...),
    admin: UserModel = Depends(_require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Upload a .pptx file as a designer template. Thumbnails are generated asynchronously."""
    if not file.filename or not file.filename.lower().endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Only .pptx files are accepted")
    if tier not in ("free", "premium"):
        raise HTTPException(status_code=400, detail="tier must be 'free' or 'premium'")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(file_bytes) > MAX_PPTX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    template, abs_path = await _create_pptx_template_row(
        file_bytes=file_bytes,
        name=name,
        description=description,
        tier=tier,
        sort_order=await _next_sort_order(session),
        session=session,
    )

    # Generate thumbnails in the background (non-blocking)
    template_id = template.id
    asyncio.create_task(
        _generate_and_save_thumbnails(abs_path, str(template_id), template_id, session)
    )

    return _row_to_dict(template)


@PPTX_TEMPLATES_ROUTER.post("/bulk-import")
async def bulk_import_pptx_templates(
    description: str = Form(""),
    tier: str = Form("free"),
    file: UploadFile = File(...),
    admin: UserModel = Depends(_require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Import every .pptx file inside a .zip as designer templates."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted")
    if tier not in ("free", "premium"):
        raise HTTPException(status_code=400, detail="tier must be 'free' or 'premium'")

    zip_bytes = await file.read()
    if len(zip_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded ZIP is empty")
    if len(zip_bytes) > MAX_ZIP_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="ZIP file too large (max 250 MB)")

    try:
        archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")

    imported: list[dict] = []
    skipped: list[dict] = []
    failed: list[dict] = []
    next_sort_order = await _next_sort_order(session)

    with archive:
        pptx_entries = [
            info for info in archive.infolist()
            if not info.is_dir() and info.filename.lower().endswith(".pptx")
        ]
        if not pptx_entries:
            raise HTTPException(status_code=400, detail="ZIP does not contain any .pptx files")
        if len(pptx_entries) > MAX_PPTX_FILES_PER_ZIP:
            raise HTTPException(
                status_code=400,
                detail=f"ZIP contains too many PPTX files (max {MAX_PPTX_FILES_PER_ZIP})",
            )

        for info in pptx_entries:
            if info.file_size == 0:
                skipped.append({"filename": info.filename, "reason": "empty file"})
                continue
            if info.file_size > MAX_PPTX_SIZE_BYTES:
                skipped.append({"filename": info.filename, "reason": "file too large (max 50 MB)"})
                continue

            try:
                pptx_bytes = archive.read(info)
                template, abs_path = await _create_pptx_template_row(
                    file_bytes=pptx_bytes,
                    name=_template_name_from_zip_path(info.filename),
                    description=description,
                    tier=tier,
                    sort_order=next_sort_order,
                    session=session,
                )
                next_sort_order += 1
                imported.append(_row_to_dict(template))

                template_id = template.id
                asyncio.create_task(
                    _generate_and_save_thumbnails(abs_path, str(template_id), template_id, session)
                )
            except Exception as exc:
                logger.exception("Bulk PPTX import failed for %s", info.filename)
                failed.append({"filename": info.filename, "reason": str(exc)})

    return {
        "imported": imported,
        "skipped": skipped,
        "failed": failed,
        "summary": {
            "imported": len(imported),
            "skipped": len(skipped),
            "failed": len(failed),
            "total_pptx": len(imported) + len(skipped) + len(failed),
        },
    }


async def _generate_and_save_thumbnails(
    abs_path: str,
    uuid_str: str,
    template_id: int,
    _session: AsyncSession,  # session from the request is closed; open a new one
) -> None:
    """Background task: generate thumbnails and update the DB row."""
    from services.database import async_session_maker
    thumb_paths = await svc.generate_thumbnails(abs_path, uuid_str)
    async with async_session_maker() as session:
        result = await session.execute(
            select(PptxDesignerTemplate).where(PptxDesignerTemplate.id == template_id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.thumbnail_paths = thumb_paths
            session.add(row)
            await session.commit()
            logger.info("Thumbnails saved for pptx_designer_template id=%s", template_id)


@PPTX_TEMPLATES_ROUTER.get("")
async def list_pptx_templates(
    admin: UserModel = Depends(_require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(PptxDesignerTemplate).order_by(PptxDesignerTemplate.sort_order)
    )
    rows = result.scalars().all()
    for row in rows:
        await _repair_incomplete_thumbnails(row, session)
    return [_row_to_dict(r) for r in rows]


class UpdatePptxTemplateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


@PPTX_TEMPLATES_ROUTER.put("/{template_id}")
async def update_pptx_template(
    template_id: int,
    body: UpdatePptxTemplateRequest,
    admin: UserModel = Depends(_require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(PptxDesignerTemplate).where(PptxDesignerTemplate.id == template_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    if body.name is not None:
        row.name = body.name
    if body.description is not None:
        row.description = body.description
    if body.tier is not None:
        if body.tier not in ("free", "premium"):
            raise HTTPException(status_code=400, detail="tier must be 'free' or 'premium'")
        row.tier = body.tier
    if body.is_active is not None:
        row.is_active = body.is_active
    if body.sort_order is not None:
        row.sort_order = body.sort_order

    from datetime import datetime
    row.updated_at = datetime.utcnow()
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _row_to_dict(row)


@PPTX_TEMPLATES_ROUTER.delete("/{template_id}")
async def delete_pptx_template(
    template_id: int,
    admin: UserModel = Depends(_require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(PptxDesignerTemplate).where(PptxDesignerTemplate.id == template_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    svc.delete_pptx_files(row.file_path, str(template_id))
    await session.delete(row)
    await session.commit()
    return {"ok": True}


# ─── Public: authenticated users fetch active templates ───────────────────────

@PUBLIC_PPTX_TEMPLATES_ROUTER.get("")
async def get_pptx_templates_for_user(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return active designer templates visible to the current user based on their plan."""
    result = await session.execute(
        select(PptxDesignerTemplate)
        .where(PptxDesignerTemplate.is_active == True)  # noqa: E712
        .order_by(PptxDesignerTemplate.sort_order)
    )
    rows = result.scalars().all()
    plan = current_user.plan or "free"
    out = []
    for r in rows:
        await _repair_incomplete_thumbnails(r, session)
        d = _row_to_dict(r)
        # Free-plan users can still SEE premium templates but are locked (same UX as tier templates)
        d["locked"] = (r.tier == "premium" and plan not in ("pro", "team"))
        out.append(d)
    return out


@PUBLIC_PPTX_TEMPLATES_ROUTER.get("/{template_id}/download")
async def download_pptx_template_for_user(
    template_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Download the original designer-uploaded PPTX template."""
    result = await session.execute(
        select(PptxDesignerTemplate).where(
            PptxDesignerTemplate.id == template_id,
            PptxDesignerTemplate.is_active == True,  # noqa: E712
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    plan = current_user.plan or "free"
    if row.tier == "premium" and plan not in ("pro", "team"):
        raise HTTPException(status_code=403, detail="Upgrade required")

    abs_path = Path(svc.resolve_template_abs_path(row.file_path))
    app_data = Path(get_app_data_directory_env()).resolve()
    try:
        abs_path.resolve().relative_to(app_data)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Template file not found")

    safe_name = "".join(c if c.isalnum() or c in (" ", "-", "_", ".") else "_" for c in row.name).strip()
    filename = f"{safe_name or 'designer-template'}.pptx"
    return FileResponse(
        str(abs_path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filename,
    )


@PUBLIC_PPTX_TEMPLATES_ROUTER.get("/{template_id}/selectable-preview")
async def get_selectable_pptx_template_preview(
    template_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return thumbnail URLs plus selectable text boxes extracted from the PPTX XML."""
    result = await session.execute(
        select(PptxDesignerTemplate).where(
            PptxDesignerTemplate.id == template_id,
            PptxDesignerTemplate.is_active == True,  # noqa: E712
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")

    plan = current_user.plan or "free"
    if row.tier == "premium" and plan not in ("pro", "team"):
        raise HTTPException(status_code=403, detail="Upgrade required")

    abs_path = Path(svc.resolve_template_abs_path(row.file_path))
    app_data = Path(get_app_data_directory_env()).resolve()
    try:
        abs_path.resolve().relative_to(app_data)
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Template file not found")

    await _repair_incomplete_thumbnails(row, session)
    thumbnail_urls = _row_to_dict(row)["thumbnail_urls"]
    textless_rel_paths = await svc.generate_textless_thumbnails(str(abs_path), str(template_id))
    base_url = "/api/v1/pptx-template-thumbs"
    background_thumbnail_urls = [f"{base_url}/{p}" for p in textless_rel_paths]

    try:
        slides = _extract_selectable_slides(abs_path, thumbnail_urls, background_thumbnail_urls)
    except Exception as exc:
        logger.exception("Failed to extract selectable preview for template id=%s", template_id)
        raise HTTPException(status_code=500, detail="Failed to extract selectable template preview") from exc

    return {
        "id": row.id,
        "name": row.name,
        "slide_count": row.slide_count,
        "slides": slides,
    }


# ─── Public thumbnail serving ─────────────────────────────────────────────────

THUMB_ROUTER = APIRouter(prefix="/api/v1/pptx-template-thumbs", tags=["pptx-thumbs"])


@THUMB_ROUTER.get("/{path:path}")
async def serve_thumbnail(
    path: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Serve a thumbnail PNG by its relative path (requires authentication)."""
    from pathlib import Path
    from utils.get_env import get_app_data_directory_env
    abs_path = Path(get_app_data_directory_env()) / path
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    # Security: ensure path stays within app_data
    try:
        abs_path.resolve().relative_to(Path(get_app_data_directory_env()).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(str(abs_path), media_type="image/png")
