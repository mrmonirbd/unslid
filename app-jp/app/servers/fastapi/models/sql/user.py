from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlmodel import Field, SQLModel, select
from sqlalchemy import String
from sqlalchemy.ext.asyncio import AsyncSession


class UserModel(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    supabase_id: str = Field(unique=True, index=True)
    email: str = Field(index=True)
    full_name: str = Field(default="")
    storage_region: str = Field(default="eu")  # eu | us | ap-se | ap-ne
    storage_region_confirmed_at: Optional[datetime] = Field(default=None)
    plan: str = Field(default="free")  # free | pro | team
    stripe_customer_id: Optional[str] = Field(default=None)
    presentations_this_month: int = Field(default=0)
    storage_used_bytes: int = Field(default=0)
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    # Billing lifecycle
    subscription_status: str = Field(default="active")  # active | past_due | cancelled
    cancel_at_period_end: bool = Field(default=False)
    subscription_ends_at: Optional[datetime] = Field(default=None)
    # One-time trial (Spark): plan=pro while trial_expires_at is in the future
    trial_expires_at: Optional[datetime] = Field(default=None)
    # Abuse-prevention usage counters (reset monthly by cron)
    tokens_used_this_month: int = Field(default=0)   # estimated LLM tokens (chars ÷ 4)
    images_generated_this_month: int = Field(default=0)
    # Legal compliance
    terms_accepted_at: Optional[datetime] = Field(default=None)
    # Acquisition attribution (UTM parameters captured at signup)
    utm_source: Optional[str] = Field(default=None)    # e.g. google, linkedin, newsletter
    utm_medium: Optional[str] = Field(default=None)    # e.g. cpc, email, organic
    utm_campaign: Optional[str] = Field(default=None)  # e.g. summer_promo, brand
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    async def get_by_supabase_id(
        cls, session: AsyncSession, supabase_id: str
    ) -> Optional["UserModel"]:
        result = await session.execute(
            select(cls).where(cls.supabase_id == supabase_id)
        )
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_email(
        cls, session: AsyncSession, email: str
    ) -> Optional["UserModel"]:
        result = await session.execute(select(cls).where(cls.email == email))
        return result.scalar_one_or_none()
