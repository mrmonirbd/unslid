from typing import Optional
from sqlmodel import Field, SQLModel


class UserAIPreferences(SQLModel, table=True):
    """
    Per-user AI model preferences. Only respected when the plan's
    PlanAIConfig.user_can_override_llm / user_can_override_image is True.
    Falls back to plan default when not set.
    """

    __tablename__ = "user_ai_preferences"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)

    # LLM preference (mirrors PlanAIConfig fields)
    llm_provider: Optional[str] = Field(default=None)   # openai | google | anthropic | ollama | custom
    llm_model: Optional[str] = Field(default=None)
    llm_base_url: Optional[str] = Field(default=None)

    # Image preference
    image_provider: Optional[str] = Field(default=None)  # pexels | pixabay | openai | google | none
