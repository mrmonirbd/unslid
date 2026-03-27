from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class NotificationPreference(SQLModel, table=True):
    __tablename__ = "notification_preferences"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True)

    # Share-view notification (max once per 24h per share)
    share_viewed: bool = Field(default=True)

    # Comment notification
    comment_added: bool = Field(default=True)

    updated_at: datetime = Field(default_factory=datetime.utcnow)
