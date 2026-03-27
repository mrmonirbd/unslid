import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config

from utils.db_utils import get_database_url_and_connect_args
from utils.get_env import get_migrate_database_on_startup_env


async def migrate_database_on_startup() -> None:
    if get_migrate_database_on_startup_env() not in ["true", "True"]:
        return

    try:
        await asyncio.to_thread(_run_migrations)
        print("Migrations run successfully", flush=True)
    except Exception as exc:
        err_str = str(exc)
        # DuplicateTable means tables already exist (e.g. from create_all).
        # Stamp alembic to head so it stops trying to re-run.
        if "DuplicateTable" in err_str or "already exists" in err_str:
            print("Tables already exist — stamping Alembic to head.", flush=True)
            try:
                await asyncio.to_thread(_stamp_head)
            except Exception as stamp_exc:
                print(f"Alembic stamp failed (non-fatal): {stamp_exc}", flush=True)
        elif "psycopg2" in err_str or "No module named" in err_str:
            print(
                f"Migration skipped — sync DB driver not available ({exc}). "
                "Tables will be created by create_db_and_tables().",
                flush=True,
            )
        else:
            print(f"Error running migrations: {exc}", flush=True)


def _stamp_head() -> None:
    base_dir = Path(__file__).resolve().parents[0]
    config = Config()
    config.set_main_option("script_location", str(base_dir / "alembic"))
    database_url, _ = get_database_url_and_connect_args()
    database_url = (
        database_url
        .replace("sqlite+aiosqlite://", "sqlite:///")
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("mysql+aiomysql://", "mysql://")
    )
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.stamp(config, "head")


def _run_migrations() -> None:
    # migrations.py lives at servers/fastapi/migrations.py
    # so parents[0] = servers/fastapi/, where alembic/ lives alongside it.
    base_dir = Path(__file__).resolve().parents[0]
    config = Config()
    config.set_main_option("script_location", str(base_dir / "alembic"))

    database_url, _ = get_database_url_and_connect_args()

    # Alembic uses synchronous engines; strip async driver prefixes.
    database_url = (
        database_url
        .replace("sqlite+aiosqlite://", "sqlite:///")
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("mysql+aiomysql://", "mysql://")
    )

    # Alembic uses Python's configparser internally which treats % as an
    # interpolation marker.  Escape all % signs so passwords with URL-encoded
    # characters (e.g. %2C, %40) are stored literally.
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    command.upgrade(config, "head")
