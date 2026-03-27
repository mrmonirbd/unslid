from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class ShareViewEvent(SQLModel, table=True):
    __tablename__ = "share_view_events"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Link back to the share
    share_token: str = Field(index=True)

    # Anonymised viewer identifier (IP hash)
    viewer_hash: Optional[str] = Field(default=None)

    # Which slide was last seen
    slide_index: int = Field(default=0)

    # Seconds spent on this slide (accumulated via heartbeat)
    seconds_spent: int = Field(default=0)

    # ISO 3166-1 alpha-2 country code from GeoIP (best-effort)
    country_code: Optional[str] = Field(default=None)

    viewed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
