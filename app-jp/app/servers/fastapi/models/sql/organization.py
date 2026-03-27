from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, select
from sqlalchemy.ext.asyncio import AsyncSession


class OrganizationModel(SQLModel, table=True):
    __tablename__ = "organizations"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    plan: str = Field(default="free")  # free | pro | team
    stripe_customer_id: Optional[str] = Field(default=None)
    stripe_subscription_id: Optional[str] = Field(default=None)
    seats_purchased: int = Field(default=2)  # minimum 2 seats for team plan
    storage_used_bytes: int = Field(default=0)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    async def get_by_slug(
        cls, session: AsyncSession, slug: str
    ) -> Optional["OrganizationModel"]:
        result = await session.execute(select(cls).where(cls.slug == slug))
        return result.scalar_one_or_none()
