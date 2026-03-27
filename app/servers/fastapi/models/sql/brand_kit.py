from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class BrandKitModel(SQLModel, table=True):
    __tablename__ = "brand_kits"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Foreign key to user
    user_id: str = Field(index=True, unique=True)

    # Logo stored on S3 / local app_data; public URL
    logo_url: Optional[str] = Field(default=None)

    # Brand colours (hex strings, e.g. "#5141E5")
    primary_color: Optional[str] = Field(default=None)
    secondary_color: Optional[str] = Field(default=None)
    accent_color: Optional[str] = Field(default=None)

    # Typography
    heading_font: Optional[str] = Field(default=None)
    body_font: Optional[str] = Field(default=None)

    # Optional brand name override used on slides
    brand_name: Optional[str] = Field(default=None)

    updated_at: datetime = Field(default_factory=datetime.utcnow)
