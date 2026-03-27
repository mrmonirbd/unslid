"""
Public share viewer endpoints — no authentication required.
"""
import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from api.auth import get_current_user
from models.sql.presentation_share import PresentationShareModel
from models.sql.presentation import PresentationModel
from models.sql.share_view_event import ShareViewEvent
from models.sql.user import UserModel
from services.database import get_async_session
from services.emails.email_service import notify_share_viewed

# In-memory rate limiter: share_token → last_notified_at (ISO str)
_share_notify_cache: dict[str, str] = {}

SHARE_VIEWER_ROUTER = APIRouter(prefix="/s", tags=["share"])


def _viewer_hash(request: Request) -> str:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    return hashlib.sha256(ip.split(",")[0].strip().encode()).hexdigest()[:16]


@SHARE_VIEWER_ROUTER.get("/{token}")
async def get_shared_presentation(
    token: str,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Return metadata for a shared presentation (unauthenticated).
    Creates a view event and increments the total view counter.
    """
    share = await PresentationShareModel.get_by_token(session, token)
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    if share.mode == "password":
        return {"token": token, "mode": "password", "requires_password": True}

    # Increment view count
    share.view_count += 1
    session.add(share)

    # Record a view event
    event = ShareViewEvent(
        share_token=token,
        viewer_hash=_viewer_hash(request),
        slide_index=0,
        seconds_spent=0,
    )
    session.add(event)
    await session.commit()

    presentation = await session.get(PresentationModel, share.presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    # Send owner notification (max once per 24h per share, fire-and-forget)
    now_str = datetime.now(timezone.utc).isoformat()
    last = _share_notify_cache.get(token)
    should_notify = (
        not last
        or (datetime.fromisoformat(last) < datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
    )
    if should_notify:
        _share_notify_cache[token] = now_str
        owner_result = await session.execute(
            select(UserModel).where(UserModel.id == share.user_id)
        )
        owner = owner_result.scalar_one_or_none()
        if owner and owner.email:
            asyncio.ensure_future(notify_share_viewed(
                to=owner.email,
                presentation_title=presentation.title or "Untitled",
            ))

    return {
        "token": token,
        "mode": share.mode,
        "view_count": share.view_count,
        "presentation": {
            "id": str(presentation.id),
            "title": presentation.title,
            "n_slides": presentation.n_slides,
            "structure": presentation.structure,
            "theme": presentation.theme,
        },
    }


class HeartbeatRequest(BaseModel):
    slide_index: int
    seconds_spent: int


@SHARE_VIEWER_ROUTER.patch("/{token}/heartbeat")
async def share_heartbeat(
    token: str,
    body: HeartbeatRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Update slide progress for the viewer's latest view event."""
    vh = _viewer_hash(request)
    result = await session.execute(
        select(ShareViewEvent)
        .where(
            ShareViewEvent.share_token == token,
            ShareViewEvent.viewer_hash == vh,
        )
        .order_by(ShareViewEvent.id.desc())
        .limit(1)
    )
    event = result.scalar_one_or_none()
    if event:
        event.slide_index = body.slide_index
        event.seconds_spent = body.seconds_spent
        event.updated_at = datetime.now(timezone.utc)
        session.add(event)
        await session.commit()
    return {"ok": True}


class UnlockShareRequest(BaseModel):
    password: str


@SHARE_VIEWER_ROUTER.post("/{token}/unlock")
async def unlock_shared_presentation(
    token: str,
    body: UnlockShareRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Verify password for a password-protected share link."""
    share = await PresentationShareModel.get_by_token(session, token)
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")

    if not share.check_password(body.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    share.view_count += 1
    session.add(share)

    event = ShareViewEvent(
        share_token=token,
        viewer_hash=_viewer_hash(request),
        slide_index=0,
        seconds_spent=0,
    )
    session.add(event)
    await session.commit()

    presentation = await session.get(PresentationModel, share.presentation_id)
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")

    return {
        "token": token,
        "presentation": {
            "id": str(presentation.id),
            "title": presentation.title,
            "n_slides": presentation.n_slides,
            "structure": presentation.structure,
            "theme": presentation.theme,
        },
    }


# ─── Analytics (authenticated — owner only) ──────────────────────────────────

@SHARE_VIEWER_ROUTER.get("/{token}/analytics")
async def get_share_analytics(
    token: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return per-slide analytics for a share link owned by the current user."""
    share = await PresentationShareModel.get_by_token(session, token)
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")
    if share.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")

    result = await session.execute(
        select(ShareViewEvent).where(ShareViewEvent.share_token == token)
    )
    events = result.scalars().all()

    # Per-slide aggregation
    slide_stats: dict[int, dict] = {}
    unique_viewers: set[Optional[str]] = set()
    for ev in events:
        unique_viewers.add(ev.viewer_hash)
        s = slide_stats.setdefault(ev.slide_index, {"views": 0, "total_seconds": 0})
        s["views"] += 1
        s["total_seconds"] += ev.seconds_spent

    per_slide = [
        {
            "slide_index": idx,
            "views": data["views"],
            "avg_seconds": round(data["total_seconds"] / data["views"], 1) if data["views"] else 0,
        }
        for idx, data in sorted(slide_stats.items())
    ]

    return {
        "token": token,
        "total_views": share.view_count,
        "unique_viewers": len(unique_viewers),
        "per_slide": per_slide,
    }
