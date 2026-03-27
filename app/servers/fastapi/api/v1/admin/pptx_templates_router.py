"""
Admin endpoints for designer-uploaded PPTX templates.

POST /admin/pptx-templates          → upload a .pptx file
GET  /admin/pptx-templates          → list all templates
PUT  /admin/pptx-templates/{id}     → update name/desc/tier/active/order
DELETE /admin/pptx-templates/{id}   → soft-delete (is_active=False) or hard delete
"""
import asyncio
import logging
from typing import Optional

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

logger = logging.getLogger(__name__)

PPTX_TEMPLATES_ROUTER = APIRouter(prefix="/api/v1/admin/pptx-templates", tags=["admin-pptx-templates"])
PUBLIC_PPTX_TEMPLATES_ROUTER = APIRouter(prefix="/api/v1/account/pptx-templates", tags=["pptx-templates"])


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
        "color_scheme": r.color_scheme,
        "font_scheme": r.font_scheme,
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


# ─── Admin CRUD ───────────────────────────────────────────────────────────────

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
    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    abs_path, rel_path = svc.save_pptx_file(file_bytes)

    # Extract metadata synchronously (fast)
    slide_count = svc.count_slides(abs_path)
    color_scheme, font_scheme = svc.extract_theme_info(abs_path)

    # Determine sort order (append to end)
    result = await session.execute(select(PptxDesignerTemplate))
    existing = result.scalars().all()
    sort_order = max((r.sort_order for r in existing), default=-1) + 1

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

    # Generate thumbnails in the background (non-blocking)
    template_id = template.id
    asyncio.create_task(
        _generate_and_save_thumbnails(abs_path, str(template_id), template_id, session)
    )

    return _row_to_dict(template)


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
        d = _row_to_dict(r)
        # Free-plan users can still SEE premium templates but are locked (same UX as tier templates)
        d["locked"] = (r.tier == "premium" and plan not in ("pro", "team"))
        out.append(d)
    return out


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
