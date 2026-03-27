import asyncio
import base64
import os
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlmodel.ext.asyncio.session import AsyncSession

from services.database import get_async_session
from models.sql.user import UserModel

security = HTTPBearer(auto_error=False)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")

# HS256 fallback key (older Supabase projects) — base64-decoded if possible
_raw_secret = os.getenv("SUPABASE_JWT_SECRET", "")
try:
    _hs256_key: bytes | str = base64.b64decode(_raw_secret)
except Exception:
    _hs256_key = _raw_secret

# ES256 JWKS cache (newer Supabase projects use asymmetric EC signing)
_jwks_keys: list[dict] = []
_jwks_lock = asyncio.Lock()


async def _get_jwks() -> list[dict]:
    """Fetch and cache Supabase's JWKS public keys (used for ES256 verification)."""
    global _jwks_keys
    if _jwks_keys:
        return _jwks_keys
    async with _jwks_lock:
        if _jwks_keys:
            return _jwks_keys
        try:
            url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(url)
                _jwks_keys = r.json().get("keys", [])
        except Exception:
            pass
    return _jwks_keys


def _try_decode(token: str, key, algorithms: list[str]) -> Optional[dict]:
    try:
        return jwt.decode(
            token, key, algorithms=algorithms, options={"verify_aud": False}
        )
    except JWTError:
        return None


async def _decode_token(token: str) -> dict:
    """Try ES256 (JWKS) first, then HS256 fallback."""
    # 1. ES256 — fetch public keys from Supabase JWKS endpoint
    for key in await _get_jwks():
        result = _try_decode(token, key, ["ES256"])
        if result is not None:
            return result

    # 2. HS256 — older Supabase or self-hosted
    result = _try_decode(token, _hs256_key, ["HS256"])
    if result is not None:
        return result

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_async_session),
) -> UserModel:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = await _decode_token(credentials.credentials)
    supabase_user_id: str = payload.get("sub", "")

    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
        )

    # Enforce email verification — Supabase sets email_confirmed_at when confirmed
    email_confirmed = (
        payload.get("email_confirmed_at")
        or payload.get("user_metadata", {}).get("email_verified")
    )
    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production" and not email_confirmed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before continuing. Check your inbox for a confirmation link.",
        )

    user = await UserModel.get_by_supabase_id(session, supabase_user_id)

    if not user:
        # First time — auto-provision user record from JWT claims
        user_meta = payload.get("user_metadata", {})
        app_meta = payload.get("app_metadata", {})
        user = UserModel(
            supabase_id=supabase_user_id,
            email=payload.get("email", ""),
            full_name=user_meta.get("full_name", ""),
            storage_region=user_meta.get("storage_region", "eu"),
            plan=app_meta.get("plan", user_meta.get("plan", "free")),
            is_admin=bool(app_meta.get("is_admin", False)),
            utm_source=user_meta.get("utm_source") or None,
            utm_medium=user_meta.get("utm_medium") or None,
            utm_campaign=user_meta.get("utm_campaign") or None,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        # Send welcome email (non-blocking)
        try:
            from services.emails import send_welcome_email
            await send_welcome_email(user.email, user.full_name or user.email)
        except Exception:
            pass

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: AsyncSession = Depends(get_async_session),
) -> Optional[UserModel]:
    if not credentials:
        return None
    try:
        return await get_current_user(credentials, session)
    except HTTPException:
        return None
