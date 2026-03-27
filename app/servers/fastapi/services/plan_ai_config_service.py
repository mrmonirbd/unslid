"""
Service for reading and writing per-plan AI model configuration.
API keys are encrypted with Fernet (AES-128) before being written to the
database and decrypted transparently on read.  The encryption key lives only
in SECRET_KEY (env var) — never in the DB itself.
"""
import os
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from models.sql.plan_ai_config import PlanAIConfig
from utils.crypto import decrypt_value, encrypt_value

PLANS = ["free", "pro", "team"]

# Default config seeded on first startup (falls back to env vars)
DEFAULT_CONFIGS = {
    "free": {
        "llm_provider": os.getenv("LLM", "openai"),
        "llm_model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        "llm_api_key": os.getenv("OPENAI_API_KEY", ""),
        "image_provider": os.getenv("IMAGE_PROVIDER", "pexels"),
        "image_model": None,
        "image_api_key": os.getenv("PEXELS_API_KEY", ""),
        "llm_base_url": None,
    },
    "pro": {
        "llm_provider": os.getenv("LLM", "openai"),
        "llm_model": os.getenv("OPENAI_MODEL", "gpt-4.1"),
        "llm_api_key": os.getenv("OPENAI_API_KEY", ""),
        "image_provider": os.getenv("IMAGE_PROVIDER", "pexels"),
        "image_model": None,
        "image_api_key": os.getenv("PEXELS_API_KEY", ""),
        "llm_base_url": None,
    },
    "team": {
        "llm_provider": os.getenv("LLM", "openai"),
        "llm_model": os.getenv("OPENAI_MODEL", "gpt-4.1"),
        "llm_api_key": os.getenv("OPENAI_API_KEY", ""),
        "image_provider": os.getenv("IMAGE_PROVIDER", "pexels"),
        "image_model": None,
        "image_api_key": os.getenv("PEXELS_API_KEY", ""),
        "llm_base_url": None,
    },
}


async def get_plan_ai_config(plan: str, session: AsyncSession) -> Optional[PlanAIConfig]:
    result = await session.execute(select(PlanAIConfig).where(PlanAIConfig.plan == plan))
    return result.scalar_one_or_none()


async def get_all_plan_configs(session: AsyncSession) -> list[PlanAIConfig]:
    result = await session.execute(select(PlanAIConfig))
    rows = result.scalars().all()
    # Ensure all plans are represented (fill gaps with defaults)
    existing = {r.plan: r for r in rows}
    out = []
    for plan in PLANS:
        if plan in existing:
            out.append(existing[plan])
        else:
            out.append(_default_config_obj(plan))
    return out


async def upsert_plan_ai_config(
    plan: str,
    llm_provider: str,
    llm_model: str,
    llm_api_key: Optional[str],
    llm_base_url: Optional[str],
    image_provider: str,
    image_model: Optional[str],
    image_api_key: Optional[str],
    admin_id: int,
    session: AsyncSession,
    user_can_override_llm: bool = False,
    user_can_override_image: bool = False,
) -> PlanAIConfig:
    existing = await get_plan_ai_config(plan, session)
    if existing:
        existing.llm_provider = llm_provider
        existing.llm_model = llm_model
        if llm_api_key is not None:
            existing.llm_api_key = encrypt_value(llm_api_key)
        existing.llm_base_url = llm_base_url
        existing.image_provider = image_provider
        existing.image_model = image_model
        if image_api_key is not None:
            existing.image_api_key = encrypt_value(image_api_key)
        existing.user_can_override_llm = user_can_override_llm
        existing.user_can_override_image = user_can_override_image
        existing.updated_at = datetime.utcnow()
        existing.updated_by_admin_id = admin_id
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        return existing
    else:
        cfg = PlanAIConfig(
            plan=plan,
            llm_provider=llm_provider,
            llm_model=llm_model,
            llm_api_key=encrypt_value(llm_api_key) if llm_api_key else None,
            llm_base_url=llm_base_url,
            image_provider=image_provider,
            image_model=image_model,
            image_api_key=encrypt_value(image_api_key) if image_api_key else None,
            user_can_override_llm=user_can_override_llm,
            user_can_override_image=user_can_override_image,
            updated_at=datetime.utcnow(),
            updated_by_admin_id=admin_id,
        )
        session.add(cfg)
        await session.commit()
        await session.refresh(cfg)
        return cfg


def build_plan_context_dict(cfg: Optional[PlanAIConfig], plan: str) -> dict:
    """
    Build the dict that gets stored in the plan ContextVar.
    API keys are decrypted here; downstream code receives plaintext.
    Falls back to env vars when DB config is missing or key is empty.
    """
    defaults = DEFAULT_CONFIGS.get(plan, DEFAULT_CONFIGS["free"])

    def _key(db_val: Optional[str], env_fallback: str = "") -> str:
        """Decrypt a DB key value, falling back to an env var default."""
        if db_val:
            return decrypt_value(db_val)
        return env_fallback

    if cfg is None:
        return {
            "LLM": defaults["llm_provider"],
            "OPENAI_MODEL": defaults["llm_model"] if defaults["llm_provider"] == "openai" else None,
            "GOOGLE_MODEL": defaults["llm_model"] if defaults["llm_provider"] == "google" else None,
            "ANTHROPIC_MODEL": defaults["llm_model"] if defaults["llm_provider"] == "anthropic" else None,
            "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
            "GOOGLE_API_KEY": os.getenv("GOOGLE_API_KEY", ""),
            "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY", ""),
            "IMAGE_PROVIDER": defaults["image_provider"],
            "PEXELS_API_KEY": os.getenv("PEXELS_API_KEY", ""),
            "PIXABAY_API_KEY": os.getenv("PIXABAY_API_KEY", ""),
            "CUSTOM_LLM_URL": defaults["llm_base_url"],
            "OLLAMA_URL": defaults["llm_base_url"],
        }

    provider = cfg.llm_provider
    llm_key = _key(cfg.llm_api_key)
    img_key = _key(cfg.image_api_key)

    return {
        "LLM": provider,
        "OPENAI_MODEL": cfg.llm_model if provider == "openai" else None,
        "GOOGLE_MODEL": cfg.llm_model if provider == "google" else None,
        "ANTHROPIC_MODEL": cfg.llm_model if provider == "anthropic" else None,
        "OLLAMA_MODEL": cfg.llm_model if provider == "ollama" else None,
        "CUSTOM_MODEL": cfg.llm_model if provider == "custom" else None,
        # Provide the key to whichever provider is active; others get env fallback
        "OPENAI_API_KEY": llm_key if provider == "openai" else os.getenv("OPENAI_API_KEY", ""),
        "GOOGLE_API_KEY": llm_key if provider == "google" else os.getenv("GOOGLE_API_KEY", ""),
        "ANTHROPIC_API_KEY": llm_key if provider == "anthropic" else os.getenv("ANTHROPIC_API_KEY", ""),
        "CUSTOM_LLM_API_KEY": llm_key if provider == "custom" else os.getenv("CUSTOM_LLM_API_KEY", ""),
        "IMAGE_PROVIDER": cfg.image_provider or defaults["image_provider"],
        "PEXELS_API_KEY": img_key or os.getenv("PEXELS_API_KEY", ""),
        "PIXABAY_API_KEY": img_key or os.getenv("PIXABAY_API_KEY", ""),
        "CUSTOM_LLM_URL": cfg.llm_base_url,
        "OLLAMA_URL": cfg.llm_base_url,
    }


def _default_config_obj(plan: str) -> PlanAIConfig:
    d = DEFAULT_CONFIGS.get(plan, DEFAULT_CONFIGS["free"])
    return PlanAIConfig(
        plan=plan,
        llm_provider=d["llm_provider"],
        llm_model=d["llm_model"],
        llm_api_key=None,
        image_provider=d["image_provider"],
        image_model=None,
    )
