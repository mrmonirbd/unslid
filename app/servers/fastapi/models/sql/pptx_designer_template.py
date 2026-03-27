"""
Designer-uploaded PPTX templates.

Admins upload a .pptx file; the system generates slide thumbnails and stores
the template metadata here.  Users then select a designer template when starting
a new presentation — at PPTX export time, the designer template's theme
(colors, fonts, backgrounds) is applied to the generated output.
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class PptxDesignerTemplate(SQLModel, table=True):
    __tablename__ = "pptx_designer_templates"

    id: Optional[int] = Field(default=None, primary_key=True)

    name: str = Field(index=True)
    description: str = Field(default="")

    # "free" | "premium" — same as TemplateTierModel
    tier: str = Field(default="free")

    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)

    # Path on disk relative to app_data root, e.g. "pptx_templates/abc123.pptx"
    file_path: str = Field(default="")

    # JSON list of thumbnail paths, one per slide (relative to app_data root)
    # e.g. ["pptx_templates/thumbs/abc123/slide_0.png", ...]
    thumbnail_paths: Optional[List[str]] = Field(
        sa_column=Column(JSON), default=None
    )

    # Number of slides detected in the uploaded file
    slide_count: int = Field(default=0)

    # Color scheme extracted from the template theme
    # e.g. {"accent1": "#4472C4", "dk1": "#000000", "lt1": "#FFFFFF", ...}
    color_scheme: Optional[dict] = Field(
        sa_column=Column(JSON), default=None
    )

    # Font scheme extracted: {"major": "Calibri Light", "minor": "Calibri"}
    font_scheme: Optional[dict] = Field(
        sa_column=Column(JSON), default=None
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
