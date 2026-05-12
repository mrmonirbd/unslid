from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.key_value import KeyValueSqlModel
from models.sql.presentation import PresentationModel
from models.sql.user import UserModel
from utils.template_generation_limits import (
    TEMPLATE_GENERATION_LIMITS_KEY,
    normalize_template_generation_limits,
)

PRESENTATION_GENERATION_LIMITS_KEY = "presentation_generation_limits"

DEFAULT_PRESENTATION_GENERATION_LIMITS = {
    "free": 1,
    "pro": -1,
    "team": -1,
}


def normalize_presentation_generation_limits(value: dict | None) -> dict[str, int]:
    normalized = normalize_template_generation_limits(
        {**DEFAULT_PRESENTATION_GENERATION_LIMITS, **(value or {})}
    )
    return normalized


async def get_presentation_generation_limits(session: AsyncSession) -> dict[str, int]:
    result = await session.execute(
        select(KeyValueSqlModel).where(
            KeyValueSqlModel.key == PRESENTATION_GENERATION_LIMITS_KEY
        )
    )
    row = result.scalar_one_or_none()
    if row and row.value:
        return normalize_presentation_generation_limits(row.value)

    # Compatibility fallback: the first UI shipped as "template generation limits".
    # If an admin already set those values while intending presentation limits,
    # use them until the new presentation-specific setting is saved.
    legacy_result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == TEMPLATE_GENERATION_LIMITS_KEY)
    )
    legacy_row = legacy_result.scalar_one_or_none()
    if legacy_row and legacy_row.value:
        return normalize_presentation_generation_limits(legacy_row.value)

    return DEFAULT_PRESENTATION_GENERATION_LIMITS


async def save_presentation_generation_limits(
    limits: dict[str, int], session: AsyncSession
) -> dict[str, int]:
    normalized = normalize_presentation_generation_limits(limits)
    result = await session.execute(
        select(KeyValueSqlModel).where(
            KeyValueSqlModel.key == PRESENTATION_GENERATION_LIMITS_KEY
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = normalized
        session.add(row)
    else:
        session.add(
            KeyValueSqlModel(
                key=PRESENTATION_GENERATION_LIMITS_KEY,
                value=normalized,
            )
        )
    await session.commit()
    return normalized


async def get_monthly_presentation_count(
    user_id: int, session: AsyncSession
) -> int:
    month_start = datetime.utcnow().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    count = await session.scalar(
        select(func.count(PresentationModel.id)).where(
            PresentationModel.user_id == user_id,
            PresentationModel.created_at >= month_start,
        )
    )
    return int(count or 0)


async def enforce_presentation_generation_limit(
    current_user: UserModel,
    session: AsyncSession,
) -> None:
    if current_user.is_admin:
        return

    plan = current_user.plan or "free"
    limits = await get_presentation_generation_limits(session)
    limit = limits.get(plan, limits["free"])
    if limit < 0:
        return

    current_count = await get_monthly_presentation_count(current_user.id, session)
    if current_count >= limit:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=429,
            detail=(
                f"{plan.title()} plan monthly presentation limit reached. "
                f"You have generated {current_count} presentations this month; "
                f"your package limit is {limit}."
            ),
        )
