import hashlib
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession


class IframeCustomer(SQLModel, table=True):
    __tablename__ = "iframe_customers"

    id: Optional[int] = Field(default=None, primary_key=True)
    site_domain: str = Field(index=True)
    api_key_hash: str = Field(index=True)
    customer_key_hash: str = Field(index=True)
    customer_api_key_hash: Optional[str] = Field(default=None, index=True)
    customer_api_key_encrypted: Optional[str] = Field(default=None)
    crm_customer_id: Optional[str] = Field(default=None, index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    crm_payload: Optional[dict] = Field(sa_column=Column(JSON), default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen_at: Optional[datetime] = Field(default=None)

    @staticmethod
    def hash_secret(value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()

    @classmethod
    async def get_active(
        cls,
        session: AsyncSession,
        site_domain: str,
        api_key: str,
        customer_key: str,
    ) -> Optional["IframeCustomer"]:
        result = await session.execute(
            select(cls).where(
                cls.site_domain == site_domain,
                cls.api_key_hash == cls.hash_secret(api_key),
                cls.customer_key_hash == cls.hash_secret(customer_key),
                cls.is_active == True,
            )
        )
        return result.scalar_one_or_none()
