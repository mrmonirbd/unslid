from collections.abc import AsyncGenerator
import os
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy import text
from sqlmodel import SQLModel

from models.sql.async_presentation_generation_status import (
    AsyncPresentationGenerationTaskModel,
)
from models.sql.image_asset import ImageAsset
from models.sql.key_value import KeyValueSqlModel
from models.sql.ollama_pull_status import OllamaPullStatus
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel
from models.sql.presentation_layout_code import PresentationLayoutCodeModel
from models.sql.template import TemplateModel
from models.sql.webhook_subscription import WebhookSubscription
from models.sql.user import UserModel
from models.sql.organization import OrganizationModel
from models.sql.org_member import OrgMemberModel, OrgInvitationModel
from models.sql.api_key import ApiKeyModel
from models.sql.presentation_share import PresentationShareModel
from models.sql.plan_ai_config import PlanAIConfig
from models.sql.user_ai_preferences import UserAIPreferences
from models.sql.template_tier import TemplateTierModel
from models.sql.pptx_designer_template import PptxDesignerTemplate
from models.sql.brand_kit import BrandKitModel
from models.sql.share_view_event import ShareViewEvent
from models.sql.presentation_version import PresentationVersion
from models.sql.slide_comment import SlideComment
from models.sql.notification_preference import NotificationPreference
from utils.db_utils import get_database_url_and_connect_args


database_url, connect_args = get_database_url_and_connect_args()

sql_engine: AsyncEngine = create_async_engine(database_url, connect_args=connect_args)
async_session_maker = async_sessionmaker(sql_engine, expire_on_commit=False)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


# Container DB (Lives inside the container)
container_db_url = "sqlite+aiosqlite:////app/container.db"
container_db_engine: AsyncEngine = create_async_engine(
    container_db_url, connect_args={"check_same_thread": False}
)
container_db_async_session_maker = async_sessionmaker(
    container_db_engine, expire_on_commit=False
)


async def get_container_db_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with container_db_async_session_maker() as session:
        yield session


# Create Database and Tables
async def create_db_and_tables():
    async with sql_engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: SQLModel.metadata.create_all(
                sync_conn,
                tables=[
                    # SaaS multi-tenant tables (create first — referenced by FKs)
                    UserModel.__table__,
                    OrganizationModel.__table__,
                    OrgMemberModel.__table__,
                    OrgInvitationModel.__table__,
                    ApiKeyModel.__table__,
                    PresentationShareModel.__table__,
                    PlanAIConfig.__table__,
                    UserAIPreferences.__table__,
                    TemplateTierModel.__table__,
                    PptxDesignerTemplate.__table__,
                    BrandKitModel.__table__,
                    ShareViewEvent.__table__,
                    PresentationVersion.__table__,
                    SlideComment.__table__,
                    NotificationPreference.__table__,
                    # Core presentation tables
                    PresentationModel.__table__,
                    SlideModel.__table__,
                    KeyValueSqlModel.__table__,
                    ImageAsset.__table__,
                    PresentationLayoutCodeModel.__table__,
                    TemplateModel.__table__,
                    WebhookSubscription.__table__,
                    AsyncPresentationGenerationTaskModel.__table__,
                ],
            )
        )
        # Safe runtime migrations — add new columns to existing tables without breaking data.
        await _run_safe_migrations(conn, database_url)

    async with container_db_engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: SQLModel.metadata.create_all(
                sync_conn,
                tables=[OllamaPullStatus.__table__],
            )
        )


async def _run_safe_migrations(conn, db_url: str):
    """
    Add missing columns to existing tables without dropping data.
    Works for both SQLite (local dev) and PostgreSQL (Supabase).
    """
    is_sqlite = db_url.startswith("sqlite")

    async def pg_cols(table: str) -> set:
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
        ), {"t": table})
        return {row[0] for row in result.fetchall()}

    if is_sqlite:
        result = await conn.execute(text("PRAGMA table_info(presentations)"))
        cols = {row[1] for row in result.fetchall()}
        if "theme" not in cols:
            await conn.execute(text("ALTER TABLE presentations ADD COLUMN theme JSON"))
        if "user_id" not in cols:
            await conn.execute(text("ALTER TABLE presentations ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL"))
        if "org_id" not in cols:
            await conn.execute(text("ALTER TABLE presentations ADD COLUMN org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL"))
        if "visibility" not in cols:
            await conn.execute(text("ALTER TABLE presentations ADD COLUMN visibility VARCHAR DEFAULT 'private'"))
    else:
        # ── presentations ────────────────────────────────────────────────────
        cols = await pg_cols("presentations")
        if "theme" not in cols:
            await conn.execute(text("ALTER TABLE presentations ADD COLUMN IF NOT EXISTS theme JSONB"))
        if "user_id" not in cols:
            await conn.execute(text(
                "ALTER TABLE presentations ADD COLUMN IF NOT EXISTS user_id INTEGER "
                "REFERENCES users(id) ON DELETE SET NULL"
            ))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_presentations_user_id ON presentations(user_id)"))
        if "org_id" not in cols:
            await conn.execute(text(
                "ALTER TABLE presentations ADD COLUMN IF NOT EXISTS org_id INTEGER "
                "REFERENCES organizations(id) ON DELETE SET NULL"
            ))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_presentations_org_id ON presentations(org_id)"))
        if "visibility" not in cols:
            await conn.execute(text(
                "ALTER TABLE presentations ADD COLUMN IF NOT EXISTS visibility VARCHAR NOT NULL DEFAULT 'private'"
            ))

        # ── users ────────────────────────────────────────────────────────────
        cols = await pg_cols("users")
        if "subscription_status" not in cols:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR NOT NULL DEFAULT 'active'"
            ))
        if "cancel_at_period_end" not in cols:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE"
            ))
        if "subscription_ends_at" not in cols:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP"
            ))
        if "terms_accepted_at" not in cols:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP"
            ))

        # ── organizations ────────────────────────────────────────────────────
        cols = await pg_cols("organizations")
        if "seats_purchased" not in cols:
            await conn.execute(text(
                "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seats_purchased INTEGER NOT NULL DEFAULT 2"
            ))
        if "stripe_subscription_id" not in cols:
            await conn.execute(text(
                "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR"
            ))

        # ── org_invitations ──────────────────────────────────────────────────
        cols = await pg_cols("org_invitations")
        if "cancelled_at" not in cols:
            await conn.execute(text(
                "ALTER TABLE org_invitations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP"
            ))
        if "resent_at" not in cols:
            await conn.execute(text(
                "ALTER TABLE org_invitations ADD COLUMN IF NOT EXISTS resent_at TIMESTAMP"
            ))

        # ── plan_ai_configs ──────────────────────────────────────────────────
        cols = await pg_cols("plan_ai_configs")
        if "user_can_override_llm" not in cols:
            await conn.execute(text(
                "ALTER TABLE plan_ai_configs ADD COLUMN IF NOT EXISTS user_can_override_llm BOOLEAN NOT NULL DEFAULT FALSE"
            ))
        if "user_can_override_image" not in cols:
            await conn.execute(text(
                "ALTER TABLE plan_ai_configs ADD COLUMN IF NOT EXISTS user_can_override_image BOOLEAN NOT NULL DEFAULT FALSE"
            ))


# Known built-in template sets — must match the IDs in the frontend index.tsx
BUILTIN_TEMPLATE_SETS = [
    {"template_id": "neo-general",  "name": "Neo General",  "sort_order": 0},
    {"template_id": "neo-standard", "name": "Neo Standard", "sort_order": 1},
    {"template_id": "neo-modern",   "name": "Neo Modern",   "sort_order": 2},
    {"template_id": "neo-swift",    "name": "Neo Swift",    "sort_order": 3},
    {"template_id": "general",      "name": "General",      "sort_order": 4},
    {"template_id": "modern",       "name": "Modern",       "sort_order": 5},
    {"template_id": "standard",     "name": "Standard",     "sort_order": 6},
    {"template_id": "swift",        "name": "Swift",        "sort_order": 7},
]


async def seed_template_tiers() -> None:
    """Insert any missing template tier rows with default free/active settings.
    Safe to call on every startup — existing rows are never touched.
    """
    from sqlmodel import select as sql_select
    async with async_session_maker() as session:
        for entry in BUILTIN_TEMPLATE_SETS:
            result = await session.execute(
                sql_select(TemplateTierModel).where(
                    TemplateTierModel.template_id == entry["template_id"]
                )
            )
            if result.scalar_one_or_none() is None:
                session.add(TemplateTierModel(
                    template_id=entry["template_id"],
                    name=entry["name"],
                    tier="free",
                    is_active=True,
                    sort_order=entry["sort_order"],
                ))
        await session.commit()
