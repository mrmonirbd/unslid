from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class SlideComment(SQLModel, table=True):
    __tablename__ = "slide_comments"

    id: Optional[int] = Field(default=None, primary_key=True)

    presentation_id: str = Field(index=True)
    slide_index: int = Field(default=0)

    user_id: str = Field(index=True)
    user_name: str = Field(default="")

    body: str = Field(default="")
    resolved: bool = Field(default=False)

    # Optional: reply to another comment
    parent_id: Optional[int] = Field(default=None, foreign_key="slide_comments.id")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
