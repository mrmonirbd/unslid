"""
Per-request plan AI config using Python contextvars.

When a request comes in we set the active plan config once (in middleware).
All downstream calls to get_llm_provider() / get_model() check here first,
falling back to os.environ only when no plan config is active.
This is safe in async code — each request gets its own context.
"""
from contextvars import ContextVar
from typing import Optional

_active_plan_config: ContextVar[Optional[dict]] = ContextVar(
    "active_plan_config", default=None
)

# Tracks the DB user.id for the current request — used by usage tracking hooks
_active_user_id: ContextVar[Optional[int]] = ContextVar(
    "active_user_id", default=None
)


def set_active_plan_config(config: dict) -> None:
    _active_plan_config.set(config)


def clear_active_plan_config() -> None:
    _active_plan_config.set(None)


def get_active_plan_config() -> Optional[dict]:
    return _active_plan_config.get()


def set_active_user_id(user_id: int) -> None:
    _active_user_id.set(user_id)


def clear_active_user_id() -> None:
    _active_user_id.set(None)


def get_active_user_id() -> Optional[int]:
    return _active_user_id.get()


def get_plan_config_value(key: str, env_fallback: Optional[str] = None) -> Optional[str]:
    """Return value from the active plan config, falling back to env_fallback."""
    cfg = _active_plan_config.get()
    if cfg:
        val = cfg.get(key)
        if val:
            return val
    return env_fallback
