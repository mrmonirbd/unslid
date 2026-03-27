"""
ARQ Worker — processes async presentation generation jobs.

This module is the entry point for the worker container.
Start with: python -m arq api.worker.WorkerSettings
"""

import os
import logging
from datetime import datetime
from arq import cron
from arq.connections import RedisSettings

from services.database import async_session_maker
from models.sql.async_presentation_generation_status import (
    AsyncPresentationGenerationTaskModel,
)

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
_redis_settings = None


def get_redis_settings() -> RedisSettings:
    global _redis_settings
    if _redis_settings is None:
        # Parse redis://host:port
        url = REDIS_URL.replace("redis://", "")
        parts = url.split(":")
        host = parts[0]
        port = int(parts[1]) if len(parts) > 1 else 6379
        _redis_settings = RedisSettings(host=host, port=port)
    return _redis_settings


# ─── Job Functions ────────────────────────────────────────────────────────────

async def _check_and_send_usage_warning(session, user) -> None:
    """Send a usage warning email when the user hits 80% of their monthly limit."""
    from utils.rate_limit import check_monthly_limit
    from services.emails import send_usage_warning_email

    if user.plan != "free":
        return  # Only free plan has a limit

    allowed, current_count, limit = await check_monthly_limit(user.id, user.plan)
    if limit is None:
        return

    pct = current_count / limit
    # Send at exactly 80% (4 of 5) — only once, not on every job
    if pct >= 0.8 and current_count == int(limit * 0.8):
        await send_usage_warning_email(
            to=user.email,
            name=user.full_name or user.email,
            current_count=current_count,
            limit=limit,
            plan=user.plan,
        )
        logger.info(f"Sent usage warning to user {user.id} ({current_count}/{limit})")


async def generate_presentation_job(
    ctx: dict,
    task_id: str,
    user_id: int,
    generation_params: dict,
):
    """
    Background job that runs the full AI presentation generation pipeline.
    Updates task status in the database as it progresses.
    """
    logger.info(f"Starting generation job {task_id} for user {user_id}")

    async with async_session_maker() as session:
        # Mark as processing
        task = await session.get(AsyncPresentationGenerationTaskModel, task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return

        task.status = "processing"
        task.updated_at = datetime.utcnow()
        await session.commit()

        try:
            # Import here to avoid circular imports and keep worker startup fast
            from api.v1.ppt.endpoints.presentation import run_presentation_generation
            from models.sql.user import UserModel
            from utils.rate_limit import increment_monthly_count
            from services.plan_ai_config_service import build_plan_context_dict, get_plan_ai_config
            from utils.plan_context import set_active_plan_config, clear_active_plan_config
            from sqlmodel import select as sql_select

            # Load plan AI config into context so LLM/image clients use the correct keys
            clear_active_plan_config()
            result_user = await session.execute(
                sql_select(UserModel).where(UserModel.id == user_id)
            )
            job_user = result_user.scalar_one_or_none()
            if job_user:
                plan = job_user.plan or "free"
                db_cfg = await get_plan_ai_config(plan, session)
                ctx = build_plan_context_dict(db_cfg, plan)
                set_active_plan_config(ctx)

            result = await run_presentation_generation(
                session=session,
                user_id=user_id,
                params=generation_params,
                task_id=task_id,
            )

            task.status = "complete"
            task.data = result
            task.updated_at = datetime.utcnow()
            await session.commit()
            logger.info(f"Job {task_id} completed successfully")

            # Increment monthly usage and check for 80% warning
            user = await session.get(UserModel, user_id)
            if user:
                await increment_monthly_count(user_id)
                await _check_and_send_usage_warning(session, user)

        except Exception as e:
            logger.error(f"Job {task_id} failed: {e}", exc_info=True)
            task.status = "failed"
            task.error = {"message": str(e)}
            task.updated_at = datetime.utcnow()
            await session.commit()


async def cleanup_old_tasks(ctx: dict):
    """Periodic cleanup — remove tasks older than 7 days."""
    from sqlmodel import delete
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(days=7)
    async with async_session_maker() as session:
        await session.execute(
            delete(AsyncPresentationGenerationTaskModel).where(
                AsyncPresentationGenerationTaskModel.created_at < cutoff
            )
        )
        await session.commit()
    logger.info("Cleaned up old generation tasks")


async def reset_monthly_presentation_counts(ctx: dict):
    """
    On the 1st of each month, reset all monthly usage counters for all users:
    - presentations_this_month
    - tokens_used_this_month
    - images_generated_this_month
    Redis monthly counters auto-reset (new key per month); the DB columns need
    an explicit reset so the admin dashboard stats stay accurate.
    """
    from sqlalchemy import text

    async with async_session_maker() as session:
        await session.execute(text(
            "UPDATE users SET presentations_this_month = 0, "
            "tokens_used_this_month = 0, images_generated_this_month = 0"
        ))
        await session.commit()
    logger.info("Reset monthly usage counters (presentations, tokens, images) for all users")


async def expire_trials(ctx: dict):
    """
    Daily cron: downgrade Spark trial users whose trial_expires_at has passed.
    Only affects users where plan='pro' AND trial_expires_at is set AND
    stripe_customer_id IS NULL (guards against accidentally downgrading paid Pro subscribers).
    """
    from sqlmodel import select as sql_select
    from models.sql.user import UserModel

    now = datetime.utcnow()

    async with async_session_maker() as session:
        result = await session.execute(
            sql_select(UserModel).where(
                UserModel.plan == "pro",
                UserModel.trial_expires_at != None,  # noqa: E711
                UserModel.trial_expires_at < now,
                UserModel.stripe_customer_id == None,  # noqa: E711
            )
        )
        expired_users = result.scalars().all()

        count = 0
        for user in expired_users:
            user.plan = "free"
            user.trial_expires_at = None
            user.updated_at = now
            session.add(user)
            count += 1

        if count:
            await session.commit()

    logger.info(f"Expired {count} Spark trial(s)")


# ─── Worker Settings ──────────────────────────────────────────────────────────

class WorkerSettings:
    functions = [generate_presentation_job]
    cron_jobs = [
        cron(cleanup_old_tasks,                  hour=3,  minute=0),   # daily at 3am
        cron(reset_monthly_presentation_counts,  hour=0,  minute=5,    day=1),  # 1st of month
        cron(expire_trials,                      hour=1,  minute=0),   # daily at 1am
    ]
    redis_settings = get_redis_settings()
    max_jobs = 10
    job_timeout = 600  # 10 minutes max per job
    keep_result = 3600  # Keep job results for 1 hour
    retry_jobs = False  # Don't auto-retry failed AI jobs (expensive)
    log_results = True
