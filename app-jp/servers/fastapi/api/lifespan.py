from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI

from migrations import migrate_database_on_startup
from services.database import create_db_and_tables, seed_template_tiers
from utils.get_env import get_app_data_directory_env
from utils.model_availability import (
    check_llm_and_image_provider_api_or_model_availability,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Initializes the application data directory, runs Alembic migrations when
    MIGRATE_DATABASE_ON_STARTUP=true, creates any missing tables, and checks
    LLM model availability. Database errors are caught so the app can still
    start for health checks while the DB connection issue is resolved.
    """
    os.makedirs(get_app_data_directory_env(), exist_ok=True)
    try:
        await migrate_database_on_startup()
        await create_db_and_tables()
        await seed_template_tiers()
    except Exception as exc:
        logger.error(
            "⚠️  Database startup failed — app is running in degraded mode. "
            "Fix DATABASE_URL and restart. Error: %s",
            exc,
        )
    try:
        await check_llm_and_image_provider_api_or_model_availability()
    except Exception as exc:
        logger.warning("LLM availability check failed (non-fatal): %s", exc)
    yield
