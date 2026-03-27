from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class PlanAIConfig(SQLModel, table=True):
    """
    Per-plan AI model configuration set by platform admins.
    One row per plan (free | pro | team). Admin configures which LLM
    provider/model/API keys are used for each user tier — users never
    touch these settings themselves.
    """

    __tablename__ = "plan_ai_configs"

    id: Optional[int] = Field(default=None, primary_key=True)

    # The plan this config applies to
    plan: str = Field(unique=True, index=True)  # free | pro | team

    # ── Text / LLM settings ──────────────────────────────────────────────────
    llm_provider: str = Field(default="openai")        # openai | google | anthropic | ollama | custom
    llm_model: str = Field(default="gpt-4.1-mini")     # model id
    llm_api_key: Optional[str] = Field(default=None)   # encrypted at rest (future); plain for now
    llm_base_url: Optional[str] = Field(default=None)  # for custom/ollama providers

    # ── Image settings ───────────────────────────────────────────────────────
    image_provider: str = Field(default="pexels")      # pexels | openai | google | none
    image_model: Optional[str] = Field(default=None)   # e.g. dall-e-3
    image_api_key: Optional[str] = Field(default=None) # separate key if needed

    # ── User override ────────────────────────────────────────────────────────
    # When True, Pro/Team users on this plan can pick their own LLM/image provider
    # from the list of providers the admin has configured API keys for.
    user_can_override_llm: bool = Field(default=False)
    user_can_override_image: bool = Field(default=False)

    # ── Metadata ─────────────────────────────────────────────────────────────
    updated_at: Optional[datetime] = Field(default=None)
    updated_by_admin_id: Optional[int] = Field(default=None, foreign_key="users.id")
