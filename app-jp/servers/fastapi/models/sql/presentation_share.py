import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, select
from sqlalchemy.ext.asyncio import AsyncSession


class PresentationShareModel(SQLModel, table=True):
    __tablename__ = "presentation_shares"

    id: Optional[int] = Field(default=None, primary_key=True)
    presentation_id: str = Field(index=True)
    user_id: int = Field(foreign_key="users.id")
    token: str = Field(unique=True, index=True, default_factory=lambda: secrets.token_urlsafe(16))
    mode: str = Field(default="private")  # private | public | password
    password_hash: Optional[str] = Field(default=None)
    view_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    async def get_by_token(
        cls, session: AsyncSession, token: str
    ) -> Optional["PresentationShareModel"]:
        result = await session.execute(select(cls).where(cls.token == token))
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_presentation(
        cls, session: AsyncSession, presentation_id: str, user_id: int
    ) -> Optional["PresentationShareModel"]:
        result = await session.execute(
            select(cls).where(
                cls.presentation_id == presentation_id,
                cls.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return hashlib.sha256(password.encode()).hexdigest() == self.password_hash

    def set_password(self, password: str):
        self.password_hash = hashlib.sha256(password.encode()).hexdigest()
