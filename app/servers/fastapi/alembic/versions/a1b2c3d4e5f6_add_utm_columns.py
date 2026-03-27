"""add utm columns to users

Revision ID: a1b2c3d4e5f6
Revises: fd2ab04834cc
Create Date: 2026-03-22 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "fd2ab04834cc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("utm_source",   sa.String(), nullable=True))
    op.add_column("users", sa.Column("utm_medium",   sa.String(), nullable=True))
    op.add_column("users", sa.Column("utm_campaign", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "utm_campaign")
    op.drop_column("users", "utm_medium")
    op.drop_column("users", "utm_source")
