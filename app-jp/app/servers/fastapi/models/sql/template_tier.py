"""
Template tier configuration — controls which built-in template sets are free vs premium.

Rows are auto-seeded from the hardcoded template IDs in the frontend on first startup.
Admins can then toggle tiers and visibility via the admin panel.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class TemplateTierModel(SQLModel, table=True):
    __tablename__ = "template_tiers"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Matches the template set ID in the frontend (e.g. "neo-general", "swift")
    template_id: str = Field(index=True, unique=True)

    # Display name shown in admin panel
    name: str = Field(default="")

    # "free" | "premium"  — free: all users; premium: Pro/Team only
    tier: str = Field(default="free")

    # Admin can hide a template set entirely from all users
    is_active: bool = Field(default=True)

    # Controls display order on the templates page (lower = first)
    sort_order: int = Field(default=0)

    updated_at: datetime = Field(default_factory=datetime.utcnow)
