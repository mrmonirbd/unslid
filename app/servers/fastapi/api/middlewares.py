import logging

from fastapi import Request
from sqlmodel import select
from starlette.middleware.base import BaseHTTPMiddleware

from models.sql.user import UserModel
from models.sql.user_ai_preferences import UserAIPreferences
from services.database import async_session_maker
from services.plan_ai_config_service import build_plan_context_dict, get_plan_ai_config
from utils.get_env import get_can_change_keys_env
from utils.plan_context import (
    clear_active_plan_config,
    set_active_plan_config,
    set_active_user_id,
    clear_active_user_id,
)
from utils.user_config import update_env_with_user_config

logger = logging.getLogger(__name__)


async def _extract_user_subject(request: Request) -> str | None:
    """Extract local user subject from JWT.

    Reads the token from (in priority order):
      1. Authorization: Bearer <token>  header  (normal fetch / XHR)
      2. ?token=<token>                 query param (EventSource — can't send headers)
    """
    from api.auth import _decode_token  # noqa: avoid circular at module level

    token: str | None = None

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    else:
        # Fallback for browser EventSource which cannot set custom headers
        token = request.query_params.get("token") or None

    if not token:
        return None

    try:
        payload = await _decode_token(token)
        return payload.get("sub")
    except Exception:
        return None


class PlanAIConfigMiddleware(BaseHTTPMiddleware):
    """
    Per-request middleware that:
    1. Reads the caller's local auth token (if present)
    2. Looks up their plan in the DB
    3. Loads the admin-configured AI model for that plan
    4. Sets it in a context variable so get_model() / get_llm_provider()
       return the plan-appropriate values — without touching os.environ

    Falls back to env vars (set by admin in .env / docker-compose) when:
    - Request is unauthenticated
    - DB is unavailable
    - No plan config is saved yet for the user's plan
    """

    async def dispatch(self, request: Request, call_next):
        clear_active_plan_config()
        clear_active_user_id()

        user_subject = await _extract_user_subject(request)
        if user_subject:
            try:
                async with async_session_maker() as session:
                    result = await session.execute(
                        select(UserModel).where(UserModel.supabase_id == user_subject)
                    )
                    user = result.scalar_one_or_none()
                    plan = user.plan if user else "free"
                    db_cfg = await get_plan_ai_config(plan, session)
                    ctx = build_plan_context_dict(db_cfg, plan)

                    # Apply user AI preferences on top of plan defaults when overrides are allowed
                    if user and db_cfg and (db_cfg.user_can_override_llm or db_cfg.user_can_override_image):
                        prefs_result = await session.execute(
                            select(UserAIPreferences).where(UserAIPreferences.user_id == user.id)
                        )
                        prefs = prefs_result.scalar_one_or_none()
                        if prefs:
                            if db_cfg.user_can_override_llm and prefs.llm_provider:
                                ctx["LLM"] = prefs.llm_provider
                                ctx["CUSTOM_MODEL"] = prefs.llm_model
                                if prefs.llm_provider == "openai":
                                    ctx["OPENAI_MODEL"] = prefs.llm_model
                                elif prefs.llm_provider == "google":
                                    ctx["GOOGLE_MODEL"] = prefs.llm_model
                                elif prefs.llm_provider == "anthropic":
                                    ctx["ANTHROPIC_MODEL"] = prefs.llm_model
                                elif prefs.llm_provider == "ollama":
                                    ctx["OLLAMA_MODEL"] = prefs.llm_model
                                if prefs.llm_base_url:
                                    ctx["CUSTOM_LLM_URL"] = prefs.llm_base_url
                                    ctx["OLLAMA_URL"] = prefs.llm_base_url
                            if db_cfg.user_can_override_image and prefs.image_provider:
                                ctx["IMAGE_PROVIDER"] = prefs.image_provider

                    set_active_plan_config(ctx)

                    # Store user_id in context for downstream usage tracking
                    if user:
                        set_active_user_id(user.id)
                        # Track concurrent sessions (non-blocking)
                        try:
                            client_ip = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
                            if not client_ip:
                                client_ip = getattr(request.client, "host", "unknown")
                            from utils.rate_limit import track_session
                            import asyncio
                            asyncio.create_task(track_session(user.id, user.plan, client_ip))
                        except Exception:
                            pass

            except Exception as exc:
                logger.debug("PlanAIConfigMiddleware: DB unavailable, using env fallback (%s)", exc)
                # Fallback: apply global env config (legacy behaviour)
                if get_can_change_keys_env() != "false":
                    update_env_with_user_config()

        return await call_next(request)


# Keep the old class available so imports don't break
class UserConfigEnvUpdateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if get_can_change_keys_env() != "false":
            update_env_with_user_config()
        return await call_next(request)
