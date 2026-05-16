"""
Redis-based per-user rate limiting, concurrency control, and usage tracking.

Plan limits:
- free: max 1 concurrent generation, 5 presentations/month
- pro:  max 3 concurrent generations, 100 presentations/month (soft cap — contact us above)
- team: max 5 concurrent generations, unlimited presentations

Note: Hard presentation generation limits are enforced from the presentations table,
not via the Redis monthly counter. The monthly counter is kept for potential future
use but is not the gating mechanism for free users.

Abuse prevention:
- Pro soft cap: 100 presentations/month. Flagged in admin; contact support for more.
- Token usage tracking: estimated tokens (chars÷4) incremented after each LLM generate call.
- Image tracking: incremented after each generate_image call.
- Session tracking: concurrent active IPs per user stored in a Redis sorted set.
  Multiple simultaneous IPs triggers an admin flag (not auto-block).
"""

import logging
import os
from redis.asyncio import Redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

PLAN_CONCURRENCY_LIMITS = {
    "free": 1,
    "pro": 3,
    "team": 5,
}

PLAN_MONTHLY_LIMITS = {
    "free": None,  # DB-enforced monthly limit — see presentation_generation_limits.py
    "pro": None,   # unlimited (soft cap enforced separately via PRO_MONTHLY_SOFT_CAP)
    "team": None,  # unlimited
}

# Soft presentation cap per plan per month.
# Above this threshold, the endpoint returns 429 with a "contact us" message.
# Set to None to disable the cap for a plan.
PLAN_MONTHLY_SOFT_CAPS = {
    "free": None,  # hard-capped by presentation_generation_limits.py
    "pro": 100,    # soft cap — contact support above this
    "team": None,  # unlimited for team
}

_redis_client: Redis | None = None


async def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def _concurrency_key(user_id: int) -> str:
    return f"user:{user_id}:active_jobs"


def _monthly_key(user_id: int) -> str:
    from datetime import datetime
    month = datetime.utcnow().strftime("%Y-%m")
    return f"user:{user_id}:monthly_count:{month}"


async def check_and_increment_concurrency(user_id: int, plan: str) -> bool:
    """
    Check if the user is under their concurrent job limit.
    If yes, increment the counter and return True.
    If at limit, return False.
    """
    limit = PLAN_CONCURRENCY_LIMITS.get(plan, 1)
    redis = await get_redis()
    key = _concurrency_key(user_id)

    async with redis.pipeline(transaction=True) as pipe:
        try:
            await pipe.watch(key)
            current = await pipe.get(key)
            current_count = int(current) if current else 0

            if current_count >= limit:
                await pipe.reset()
                return False

            pipe.multi()
            pipe.incr(key)
            pipe.expire(key, 7200)  # Expire after 2 hours (safety net)
            await pipe.execute()
            return True
        except Exception:
            return False


async def decrement_concurrency(user_id: int):
    """Decrement active job count when a job finishes."""
    redis = await get_redis()
    key = _concurrency_key(user_id)
    current = await redis.get(key)
    if current and int(current) > 0:
        await redis.decr(key)


async def check_monthly_limit(user_id: int, plan: str) -> tuple[bool, int, int | None]:
    """
    Check if user is within their monthly presentation limit.
    Returns (allowed, current_count, limit).
    """
    limit = PLAN_MONTHLY_LIMITS.get(plan)
    if limit is None:
        return True, 0, None  # Unlimited plan

    redis = await get_redis()
    key = _monthly_key(user_id)
    current = await redis.get(key)
    current_count = int(current) if current else 0

    return current_count < limit, current_count, limit


async def increment_monthly_count(user_id: int):
    """Increment the user's monthly presentation count."""
    redis = await get_redis()
    key = _monthly_key(user_id)
    await redis.incr(key)
    # Expire key after 35 days (longer than a month for safety)
    await redis.expire(key, 35 * 24 * 3600)


async def get_user_usage(user_id: int, plan: str) -> dict:
    """Get current usage stats for a user."""
    redis = await get_redis()

    concurrency_key = _concurrency_key(user_id)
    monthly_key = _monthly_key(user_id)

    active = await redis.get(concurrency_key)
    monthly = await redis.get(monthly_key)

    monthly_limit = PLAN_MONTHLY_LIMITS.get(plan)
    concurrency_limit = PLAN_CONCURRENCY_LIMITS.get(plan, 1)

    return {
        "active_jobs": int(active) if active else 0,
        "concurrency_limit": concurrency_limit,
        "presentations_this_month": int(monthly) if monthly else 0,
        "monthly_limit": monthly_limit,
    }


# ─── Soft Cap Check ───────────────────────────────────────────────────────────

async def check_soft_cap(user_id: int, plan: str) -> tuple[bool, int, int | None]:
    """
    Check if the user has hit the monthly soft cap for their plan.
    Returns (under_cap, current_count, cap_limit).
    under_cap=True means OK to proceed.
    """
    cap = PLAN_MONTHLY_SOFT_CAPS.get(plan)
    if cap is None:
        return True, 0, None  # No cap for this plan

    redis = await get_redis()
    key = _monthly_key(user_id)
    current = await redis.get(key)
    current_count = int(current) if current else 0

    return current_count < cap, current_count, cap


# ─── Token Usage Tracking ─────────────────────────────────────────────────────

def _token_key(user_id: int) -> str:
    from datetime import datetime
    month = datetime.utcnow().strftime("%Y-%m")
    return f"user:{user_id}:tokens:{month}"


async def track_token_usage(user_id: int, char_count: int) -> None:
    """
    Fire-and-forget: increment estimated token usage for the current month.
    Estimation: 1 token ≈ 4 chars (English). Used for abuse detection only.
    """
    try:
        estimated_tokens = max(1, char_count // 4)
        redis = await get_redis()
        key = _token_key(user_id)
        await redis.incrby(key, estimated_tokens)
        await redis.expire(key, 35 * 24 * 3600)
    except Exception:
        pass  # Never block a generation for tracking


async def get_token_usage(user_id: int) -> int:
    """Get estimated token usage for the current month."""
    try:
        redis = await get_redis()
        val = await redis.get(_token_key(user_id))
        return int(val) if val else 0
    except Exception:
        return 0


# ─── Image Usage Tracking ─────────────────────────────────────────────────────

def _image_key(user_id: int) -> str:
    from datetime import datetime
    month = datetime.utcnow().strftime("%Y-%m")
    return f"user:{user_id}:images:{month}"


async def track_image_usage(user_id: int) -> None:
    """Fire-and-forget: increment image generation count for the current month."""
    try:
        redis = await get_redis()
        key = _image_key(user_id)
        await redis.incr(key)
        await redis.expire(key, 35 * 24 * 3600)
    except Exception:
        pass


async def get_image_usage(user_id: int) -> int:
    """Get image generation count for the current month."""
    try:
        redis = await get_redis()
        val = await redis.get(_image_key(user_id))
        return int(val) if val else 0
    except Exception:
        return 0


# ─── Concurrent Session Tracking ─────────────────────────────────────────────

def _session_key(user_id: int) -> str:
    return f"user:{user_id}:sessions"

# If a paid user is active from this many distinct IPs simultaneously, flag them.
SUSPICIOUS_SESSION_THRESHOLD = {
    "free": 2,
    "pro": 3,    # 3+ IPs simultaneously is suspicious
    "team": 5,   # team may have multiple users, but same account on 5+ IPs is unusual
}


async def track_session(user_id: int, plan: str, client_ip: str) -> None:
    """
    Track active IPs for the user. Stores IPs in a sorted set with a 30-minute TTL per entry.
    If simultaneous active IPs exceed the plan threshold, logs a warning for admin review.
    """
    try:
        import time
        redis = await get_redis()
        key = _session_key(user_id)
        now = time.time()

        # Add this IP with timestamp as score
        await redis.zadd(key, {client_ip: now})
        # Expire entries older than 30 minutes
        await redis.zremrangebyscore(key, 0, now - 1800)
        await redis.expire(key, 3600)

        # Check for suspicious simultaneous sessions
        active_ips = await redis.zcard(key)
        threshold = SUSPICIOUS_SESSION_THRESHOLD.get(plan, 3)
        if active_ips >= threshold and client_ip not in ("", "unknown", "127.0.0.1"):
            logger.warning(
                "ABUSE_FLAG: user_id=%s plan=%s active_ips=%s (threshold=%s)",
                user_id, plan, active_ips, threshold,
            )
    except Exception:
        pass


async def get_active_sessions(user_id: int) -> list[str]:
    """Get list of active IPs for a user (within the last 30 minutes)."""
    try:
        import time
        redis = await get_redis()
        key = _session_key(user_id)
        now = time.time()
        await redis.zremrangebyscore(key, 0, now - 1800)
        return await redis.zrange(key, 0, -1)
    except Exception:
        return []
