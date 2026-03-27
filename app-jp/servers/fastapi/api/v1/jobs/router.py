"""
Job status API — lets the frontend poll the status of async generation jobs.
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from arq.connections import ArqRedis, create_pool, RedisSettings

from api.auth import get_current_user
from models.sql.user import UserModel
from models.sql.async_presentation_generation_status import (
    AsyncPresentationGenerationTaskModel,
)
from services.database import get_async_session

JOBS_ROUTER = APIRouter(prefix="/jobs", tags=["jobs"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


def _get_redis_settings() -> RedisSettings:
    url = REDIS_URL.replace("redis://", "")
    parts = url.split(":")
    host = parts[0]
    port = int(parts[1]) if len(parts) > 1 else 6379
    return RedisSettings(host=host, port=port)


async def get_redis() -> ArqRedis:
    return await create_pool(_get_redis_settings())


@JOBS_ROUTER.get("/{task_id}")
async def get_job_status(
    task_id: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Poll the status of a presentation generation job.
    Returns status: queued | processing | complete | failed
    """
    task = await session.get(AsyncPresentationGenerationTaskModel, task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "task_id": task.id,
        "status": task.status,
        "message": task.message,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }

    if task.status == "complete" and task.data:
        response["result"] = task.data

    if task.status == "failed" and task.error:
        response["error"] = task.error

    return response


@JOBS_ROUTER.delete("/{task_id}")
async def cancel_job(
    task_id: str,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Cancel a queued job (only works if not yet processing)."""
    task = await session.get(AsyncPresentationGenerationTaskModel, task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Job not found")

    if task.status == "processing":
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel a job that is already processing",
        )

    if task.status in ("complete", "failed"):
        raise HTTPException(
            status_code=400,
            detail=f"Job already {task.status}",
        )

    task.status = "cancelled"
    session.add(task)
    await session.commit()

    return {"task_id": task_id, "status": "cancelled"}
