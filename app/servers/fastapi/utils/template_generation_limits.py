from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.sql.key_value import KeyValueSqlModel

TEMPLATE_GENERATION_LIMITS_KEY = "template_generation_limits"
PLAN_KEYS = ("free", "pro", "team")

DEFAULT_TEMPLATE_GENERATION_LIMITS = {
    "free": 5,
    "pro": -1,
    "team": -1,
}


def normalize_template_generation_limits(value: dict | None) -> dict[str, int]:
    limits: dict[str, int] = {}
    source = value or {}
    for plan in PLAN_KEYS:
        raw_value = source.get(plan, DEFAULT_TEMPLATE_GENERATION_LIMITS[plan])
        try:
            limit = int(raw_value)
        except (TypeError, ValueError):
            limit = DEFAULT_TEMPLATE_GENERATION_LIMITS[plan]
        limits[plan] = max(-1, limit)
    return limits


async def get_template_generation_limits(session: AsyncSession) -> dict[str, int]:
    result = await session.execute(
        select(KeyValueSqlModel).where(
            KeyValueSqlModel.key == TEMPLATE_GENERATION_LIMITS_KEY
        )
    )
    row = result.scalar_one_or_none()
    return normalize_template_generation_limits(row.value if row else None)


async def save_template_generation_limits(
    limits: dict[str, int], session: AsyncSession
) -> dict[str, int]:
    normalized = normalize_template_generation_limits(limits)
    result = await session.execute(
        select(KeyValueSqlModel).where(
            KeyValueSqlModel.key == TEMPLATE_GENERATION_LIMITS_KEY
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = normalized
        session.add(row)
    else:
        session.add(
            KeyValueSqlModel(
                key=TEMPLATE_GENERATION_LIMITS_KEY,
                value=normalized,
            )
        )
    await session.commit()
    return normalized
