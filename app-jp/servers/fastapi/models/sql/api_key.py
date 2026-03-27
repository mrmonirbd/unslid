import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, select
from sqlalchemy.ext.asyncio import AsyncSession


class ApiKeyModel(SQLModel, table=True):
    __tablename__ = "api_keys"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    label: str
    key_hash: str = Field(unique=True, index=True)
    key_prefix: str  # First 8 chars shown in UI e.g. "sk_live_"
    last_used_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = Field(default=True)

    @staticmethod
    def generate() -> tuple[str, str, str]:
        """
        Generate a new API key.
        Returns (raw_key, key_hash, key_prefix).
        Raw key is shown to user ONCE and never stored.
        """
        raw = f"sk_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(raw.encode()).hexdigest()
        key_prefix = raw[:12]
        return raw, key_hash, key_prefix

    @classmethod
    async def get_by_hash(
        cls, session: AsyncSession, key_hash: str
    ) -> Optional["ApiKeyModel"]:
        result = await session.execute(
            select(cls).where(cls.key_hash == key_hash, cls.is_active == True)
        )
        return result.scalar_one_or_none()
