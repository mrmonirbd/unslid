from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel, select
from sqlalchemy.ext.asyncio import AsyncSession


class OrgMemberModel(SQLModel, table=True):
    __tablename__ = "org_members"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organizations.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    role: str = Field(default="member")  # owner | admin | member
    invited_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OrgInvitationModel(SQLModel, table=True):
    __tablename__ = "org_invitations"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organizations.id", index=True)
    invited_by_user_id: int = Field(foreign_key="users.id")
    email: str = Field(index=True)
    role: str = Field(default="member")
    token: str = Field(unique=True, index=True)
    expires_at: datetime
    accepted_at: Optional[datetime] = Field(default=None)
    cancelled_at: Optional[datetime] = Field(default=None)
    resent_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
