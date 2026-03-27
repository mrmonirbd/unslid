"""
Account management endpoints.
- GET  /account/me              → current user profile
- PUT  /account/me              → update name
- GET  /account/api-keys        → list API keys
- POST /account/api-keys        → create new API key
- DELETE /account/api-keys/{id} → revoke API key
- POST /account/delete          → delete account (GDPR)
- GET  /account/export          → download all user data (GDPR)
- GET  /account/shares          → list presentation share links
- POST /account/shares          → create share link
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from api.auth import get_current_user
from models.sql.user import UserModel
from models.sql.api_key import ApiKeyModel
from models.sql.brand_kit import BrandKitModel
from models.sql.notification_preference import NotificationPreference
from models.sql.presentation import PresentationModel
from models.sql.presentation_share import PresentationShareModel
from models.sql.user_ai_preferences import UserAIPreferences
from models.sql.template_tier import TemplateTierModel
from services.database import get_async_session
from services.storage_service import delete_all_user_files

ACCOUNT_ROUTER = APIRouter(prefix="/account", tags=["account"])


# ─── Profile ─────────────────────────────────────────────────────────────────

@ACCOUNT_ROUTER.get("/me")
async def get_profile(current_user: UserModel = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "plan": current_user.plan,
        "storage_region": current_user.storage_region,
        "storage_used_bytes": current_user.storage_used_bytes,
        "is_admin": current_user.is_admin,
        "subscription_status": current_user.subscription_status,
        "cancel_at_period_end": current_user.cancel_at_period_end,
        "terms_accepted_at": current_user.terms_accepted_at.isoformat() if current_user.terms_accepted_at else None,
        "created_at": current_user.created_at.isoformat(),
    }


@ACCOUNT_ROUTER.post("/accept-terms")
async def accept_terms(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Record that the user has accepted the Terms of Service."""
    if not current_user.terms_accepted_at:
        current_user.terms_accepted_at = datetime.now(timezone.utc)
        current_user.updated_at = datetime.now(timezone.utc)
        session.add(current_user)
        await session.commit()
    return {"ok": True, "terms_accepted_at": current_user.terms_accepted_at.isoformat()}


class UpdateProfileRequest(BaseModel):
    full_name: str


@ACCOUNT_ROUTER.put("/me")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    current_user.full_name = body.full_name.strip()
    current_user.updated_at = datetime.now(timezone.utc)
    session.add(current_user)
    await session.commit()
    return {"ok": True}


# ─── API Keys ─────────────────────────────────────────────────────────────────

@ACCOUNT_ROUTER.get("/api-keys")
async def list_api_keys(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    if current_user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="API keys are available on Pro and Team plans.",
        )
    result = await session.execute(
        select(ApiKeyModel)
        .where(ApiKeyModel.user_id == current_user.id, ApiKeyModel.is_active == True)
        .order_by(ApiKeyModel.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        {
            "id": k.id,
            "label": k.label,
            "key_prefix": k.key_prefix,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "created_at": k.created_at.isoformat(),
        }
        for k in keys
    ]


class CreateApiKeyRequest(BaseModel):
    label: str


@ACCOUNT_ROUTER.post("/api-keys")
async def create_api_key(
    body: CreateApiKeyRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    if current_user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="API keys are available on Pro and Team plans.",
        )

    result = await session.execute(
        select(ApiKeyModel).where(
            ApiKeyModel.user_id == current_user.id, ApiKeyModel.is_active == True
        )
    )
    existing = result.scalars().all()
    if len(existing) >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 API keys allowed.")

    raw_key, key_hash, key_prefix = ApiKeyModel.generate()
    api_key = ApiKeyModel(
        user_id=current_user.id,
        label=body.label.strip(),
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    return {
        "id": api_key.id,
        "label": api_key.label,
        "key": raw_key,  # Shown ONCE only
        "key_prefix": api_key.key_prefix,
        "created_at": api_key.created_at.isoformat(),
    }


@ACCOUNT_ROUTER.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: int,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    key = await session.get(ApiKeyModel, key_id)
    if not key or key.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="API key not found")

    key.is_active = False
    session.add(key)
    await session.commit()
    return {"ok": True}


# ─── Presentation Shares ──────────────────────────────────────────────────────

@ACCOUNT_ROUTER.get("/shares")
async def list_shares(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    import uuid as _uuid
    result = await session.execute(
        select(PresentationShareModel)
        .where(PresentationShareModel.user_id == current_user.id)
        .order_by(PresentationShareModel.created_at.desc())
    )
    shares = result.scalars().all()

    # Fetch presentation titles in bulk
    pids = list({s.presentation_id for s in shares})
    title_map: dict[str, str] = {}
    for pid in pids:
        try:
            pres = await session.get(PresentationModel, _uuid.UUID(pid))
            if pres:
                title_map[pid] = pres.title or "Untitled"
        except Exception:
            pass

    return [
        {
            "id": s.id,
            "presentation_id": s.presentation_id,
            "presentation_title": title_map.get(s.presentation_id, "Untitled"),
            "token": s.token,
            "mode": s.mode,
            "view_count": s.view_count,
            "share_url": f"/s/{s.token}",
            "created_at": s.created_at.isoformat(),
        }
        for s in shares
    ]


class CreateShareRequest(BaseModel):
    presentation_id: str
    mode: str = "public"  # public | password
    password: Optional[str] = None


@ACCOUNT_ROUTER.post("/shares")
async def create_share(
    body: CreateShareRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    if body.mode not in ("public", "password"):
        raise HTTPException(status_code=400, detail="mode must be 'public' or 'password'")
    if body.mode == "password" and not body.password:
        raise HTTPException(status_code=400, detail="password required for password mode")

    existing = await PresentationShareModel.get_by_presentation(
        session, body.presentation_id, current_user.id
    )
    if existing:
        # Update existing share
        existing.mode = body.mode
        if body.password:
            existing.set_password(body.password)
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        await session.commit()
        share = existing
    else:
        share = PresentationShareModel(
            presentation_id=body.presentation_id,
            user_id=current_user.id,
            mode=body.mode,
        )
        if body.password:
            share.set_password(body.password)
        session.add(share)
        await session.commit()
        await session.refresh(share)

    return {"token": share.token, "share_url": f"/s/{share.token}", "mode": share.mode}


# ─── GDPR: Account Deletion ───────────────────────────────────────────────────

@ACCOUNT_ROUTER.post("/delete")
async def delete_account(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Permanently delete account:
    1. Cancel active Stripe subscription (so billing stops immediately)
    2. Delete all S3 files for this user
    3. Soft-delete the user record (anonymise PII, keep for audit)
    """
    import logging as _logging
    _log = _logging.getLogger(__name__)

    # 1. Cancel Stripe subscription if the user has one
    if current_user.stripe_customer_id:
        try:
            from api.v1.billing.router import get_stripe_async
            s = await get_stripe_async(session)
            subscriptions = s.Subscription.list(
                customer=current_user.stripe_customer_id,
                status="active",
                limit=5,
            )
            for sub in subscriptions.auto_paging_iter():
                s.Subscription.cancel(sub.id)
                _log.info("Cancelled Stripe subscription %s for user %s", sub.id, current_user.id)
        except Exception as e:
            # Non-fatal — proceed with deletion even if Stripe call fails
            _log.warning("Could not cancel Stripe subscription during account deletion: %s", e)

    # 2. Delete S3 files
    user_prefix = f"users/{current_user.id}/"
    deleted_files = await delete_all_user_files(
        current_user.storage_region, user_prefix
    )

    # 3. Anonymise the user record (GDPR right to erasure)
    current_user.is_active = False
    current_user.email = f"deleted_{current_user.id}@deleted.invalid"
    current_user.full_name = ""
    current_user.stripe_customer_id = None
    current_user.utm_source = None
    current_user.utm_medium = None
    current_user.utm_campaign = None
    current_user.updated_at = datetime.now(timezone.utc)
    session.add(current_user)
    await session.commit()

    return {
        "ok": True,
        "deleted_files": deleted_files,
        "message": "Account deleted. Your data has been permanently removed.",
    }


# ─── GDPR: Data Export ────────────────────────────────────────────────────────

@ACCOUNT_ROUTER.get("/export")
async def export_user_data(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return all data we hold about this user as a JSON download."""
    from models.sql.presentation import PresentationModel
    from models.sql.api_key import ApiKeyModel

    presentations = await session.execute(
        select(PresentationModel).where(PresentationModel.user_id == current_user.id)
        if hasattr(PresentationModel, "user_id")
        else select(PresentationModel).limit(0)
    )

    keys = await session.execute(
        select(ApiKeyModel).where(ApiKeyModel.user_id == current_user.id)
    )

    export_data = {
        "profile": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "plan": current_user.plan,
            "storage_region": current_user.storage_region,
            "created_at": current_user.created_at.isoformat(),
        },
        "api_keys": [
            {
                "id": k.id,
                "label": k.label,
                "key_prefix": k.key_prefix,
                "created_at": k.created_at.isoformat(),
            }
            for k in keys.scalars().all()
        ],
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

    return JSONResponse(
        content=export_data,
        headers={
            "Content-Disposition": 'attachment; filename="my-data-export.json"'
        },
    )


# ─── AI Preferences (Pro / Team) ─────────────────────────────────────────────

@ACCOUNT_ROUTER.get("/ai-preferences")
async def get_ai_preferences(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return the current user's AI model preferences."""
    result = await session.execute(
        select(UserAIPreferences).where(UserAIPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {"llm_provider": None, "llm_model": None, "llm_base_url": None, "image_provider": None}
    return {
        "llm_provider": prefs.llm_provider,
        "llm_model": prefs.llm_model,
        "llm_base_url": prefs.llm_base_url,
        "image_provider": prefs.image_provider,
    }


class AIPreferencesRequest(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    llm_base_url: Optional[str] = None
    image_provider: Optional[str] = None


@ACCOUNT_ROUTER.put("/ai-preferences")
async def update_ai_preferences(
    body: AIPreferencesRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Update the current user's AI model preferences (Pro/Team only)."""
    if current_user.plan == "free":
        raise HTTPException(status_code=403, detail="AI preferences are available on Pro and Team plans.")

    result = await session.execute(
        select(UserAIPreferences).where(UserAIPreferences.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = UserAIPreferences(user_id=current_user.id)
        session.add(prefs)

    prefs.llm_provider = body.llm_provider
    prefs.llm_model = body.llm_model
    prefs.llm_base_url = body.llm_base_url
    prefs.image_provider = body.image_provider
    await session.commit()
    return {"ok": True}


# ─── Template Tiers (public, authenticated) ───────────────────────────────────

@ACCOUNT_ROUTER.get("/template-tiers")
async def get_template_tiers_for_user(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Return active template tier config so the frontend can lock premium templates
    for free-plan users.  Returns a list ordered by sort_order.
    """
    result = await session.execute(
        select(TemplateTierModel)
        .where(TemplateTierModel.is_active == True)  # noqa: E712
        .order_by(TemplateTierModel.sort_order)
    )
    rows = result.scalars().all()
    return [
        {"template_id": r.template_id, "name": r.name, "tier": r.tier}
        for r in rows
    ]


# ─── Brand Kit ───────────────────────────────────────────────────────────────

class BrandKitRequest(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    heading_font: Optional[str] = None
    body_font: Optional[str] = None
    brand_name: Optional[str] = None


@ACCOUNT_ROUTER.get("/brand-kit")
async def get_brand_kit(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(BrandKitModel).where(BrandKitModel.user_id == current_user.id)
    )
    kit = result.scalar_one_or_none()
    if not kit:
        return {}
    return {
        "logo_url": kit.logo_url,
        "primary_color": kit.primary_color,
        "secondary_color": kit.secondary_color,
        "accent_color": kit.accent_color,
        "heading_font": kit.heading_font,
        "body_font": kit.body_font,
        "brand_name": kit.brand_name,
    }


@ACCOUNT_ROUTER.put("/brand-kit")
async def update_brand_kit(
    body: BrandKitRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(BrandKitModel).where(BrandKitModel.user_id == current_user.id)
    )
    kit = result.scalar_one_or_none()
    if not kit:
        kit = BrandKitModel(user_id=current_user.id)
        session.add(kit)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(kit, field, value)
    kit.updated_at = datetime.utcnow()
    await session.commit()
    return {"ok": True}


@ACCOUNT_ROUTER.post("/brand-kit/logo")
async def upload_brand_logo(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Upload brand logo — stored in app_data and served via static files."""
    import os, uuid, aiofiles
    from pathlib import Path

    allowed = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    ext = Path(file.filename or "logo.png").suffix or ".png"
    logo_dir = Path("/app_data/brand_logos")
    logo_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    dest = logo_dir / filename

    async with aiofiles.open(dest, "wb") as f:
        content = await file.read()
        await f.write(content)

    logo_url = f"/api/v1/brand-logo/{filename}"

    result = await session.execute(
        select(BrandKitModel).where(BrandKitModel.user_id == current_user.id)
    )
    kit = result.scalar_one_or_none()
    if not kit:
        kit = BrandKitModel(user_id=current_user.id)
        session.add(kit)
    kit.logo_url = logo_url
    kit.updated_at = datetime.utcnow()
    await session.commit()
    return {"logo_url": logo_url}


# ─── Notification Preferences ─────────────────────────────────────────────────

class NotificationPreferenceRequest(BaseModel):
    share_viewed: Optional[bool] = None
    comment_added: Optional[bool] = None


@ACCOUNT_ROUTER.get("/notification-preferences")
async def get_notification_preferences(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return {"share_viewed": True, "comment_added": True}
    return {"share_viewed": prefs.share_viewed, "comment_added": prefs.comment_added}


@ACCOUNT_ROUTER.put("/notification-preferences")
async def update_notification_preferences(
    body: NotificationPreferenceRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreference(user_id=current_user.id)
        session.add(prefs)
    if body.share_viewed is not None:
        prefs.share_viewed = body.share_viewed
    if body.comment_added is not None:
        prefs.comment_added = body.comment_added
    prefs.updated_at = datetime.utcnow()
    await session.commit()
    return {"ok": True}
