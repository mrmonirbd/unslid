from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class PresentationVersion(SQLModel, table=True):
    __tablename__ = "presentation_versions"

    id: Optional[int] = Field(default=None, primary_key=True)

    presentation_id: str = Field(index=True)

    # Incrementing version number scoped to the presentation
    version_number: int = Field(default=1)

    # Human-readable label (auto-generated or set by user on restore)
    label: Optional[str] = Field(default=None)

    # Full snapshot of slides as JSON
    snapshot: Optional[dict] = Field(sa_column=Column(JSON), default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
