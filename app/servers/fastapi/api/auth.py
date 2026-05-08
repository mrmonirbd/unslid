import hashlib
import hmac
import os
import secrets
from typing import Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlmodel.ext.asyncio.session import AsyncSession
from pydantic import BaseModel

from services.database import get_async_session
from models.sql.user import UserModel

security = HTTPBearer(auto_error=False)
AUTH_ROUTER = APIRouter(prefix="/api/v1/auth", tags=["auth"])

JWT_SECRET = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET") or ""
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))

if os.getenv("ENVIRONMENT") == "production" and (
    not JWT_SECRET or JWT_SECRET == "change-me-in-production"
):
    raise RuntimeError("SECRET_KEY must be set to a strong random value in production.")


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""
    storage_region: str = "eu"
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


def _hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def _verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algorithm, salt, stored = password_hash.split("$", 2)
        if algorithm != "pbkdf2_sha256":
            return False
        return hmac.compare_digest(_hash_password(password, salt), password_hash)
    except Exception:
        return False


def _create_access_token(user: UserModel) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.supabase_id,
        "uid": user.id,
        "email": user.email,
        "user_metadata": {
            "full_name": user.full_name,
            "storage_region": user.storage_region,
            "email_verified": True,
        },
        "app_metadata": {
            "plan": user.plan,
            "is_admin": user.is_admin,
        },
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_EXPIRE_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _user_payload(user: UserModel) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "storage_region": user.storage_region,
        "plan": user.plan,
        "is_admin": user.is_admin,
    }


def _try_decode(token: str, key, algorithms: list[str]) -> Optional[dict]:
    try:
        return jwt.decode(
            token, key, algorithms=algorithms, options={"verify_aud": False}
        )
    except JWTError:
        return None


async def _decode_token(token: str) -> dict:
    """Decode the app's local JWT."""
    local_result = _try_decode(token, JWT_SECRET, [JWT_ALGORITHM])
    if local_result is not None:
        return local_result

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
    user_subject: str = payload.get("sub", "")

    if not user_subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
        )

    email_confirmed = payload.get("user_metadata", {}).get("email_verified")
    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production" and not email_confirmed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before continuing. Check your inbox for a confirmation link.",
        )

    user = await UserModel.get_by_supabase_id(session, user_subject)

    if not user:
        # First time — auto-provision user record from JWT claims
        user_meta = payload.get("user_metadata", {})
        app_meta = payload.get("app_metadata", {})
        user = UserModel(
            supabase_id=user_subject,
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


@AUTH_ROUTER.post("/signup")
async def signup(body: SignupRequest, session: AsyncSession = Depends(get_async_session)):
    if "@" not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    existing = await UserModel.get_by_email(session, body.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = UserModel(
        supabase_id=f"local:{body.email.lower()}",
        email=body.email.lower(),
        password_hash=_hash_password(body.password),
        full_name=body.full_name,
        storage_region=body.storage_region,
        utm_source=body.utm_source,
        utm_medium=body.utm_medium,
        utm_campaign=body.utm_campaign,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return {"access_token": _create_access_token(user), "user": _user_payload(user)}


@AUTH_ROUTER.post("/login")
async def login(body: LoginRequest, session: AsyncSession = Depends(get_async_session)):
    if "@" not in body.email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    user = await UserModel.get_by_email(session, body.email.lower())
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account is disabled.")
    return {"access_token": _create_access_token(user), "user": _user_payload(user)}


@AUTH_ROUTER.get("/me")
async def me(current_user: UserModel = Depends(get_current_user)):
    return {"user": _user_payload(current_user)}
