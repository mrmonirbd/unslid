"""
Admin API — only accessible by users with is_admin=True.

Endpoints:
- GET  /admin/stats              → platform-wide usage stats
- GET  /admin/users              → list all users (paginated)
- GET  /admin/users/{id}         → get user details
- PUT  /admin/users/{id}/plan    → change user plan
- POST /admin/users/{id}/deactivate
- POST /admin/users/{id}/activate
- GET  /admin/orgs               → list all organizations
- GET  /admin/ai-config          → get per-plan AI model config
- PUT  /admin/ai-config/{plan}   → update AI model config for a plan
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from api.auth import get_current_user
from utils.ai_providers import get_catalog
from utils.crypto import encrypt_value, decrypt_value
from models.sql.user import UserModel
from models.sql.organization import OrganizationModel
from models.sql.presentation import PresentationModel
from models.sql.presentation_layout_code import PresentationLayoutCodeModel
from models.sql.plan_ai_config import PlanAIConfig
from models.sql.key_value import KeyValueSqlModel
from models.sql.template import TemplateModel
from models.sql.template_tier import TemplateTierModel
from services.database import get_async_session
from services.plan_ai_config_service import get_all_plan_configs, upsert_plan_ai_config
from utils.template_generation_limits import (
    get_template_generation_limits,
    save_template_generation_limits,
)
from utils.presentation_generation_limits import (
    get_presentation_generation_limits,
    save_presentation_generation_limits,
)

STRIPE_CONFIG_KEY = "stripe_config"
MAILGUN_CONFIG_KEY = "mailgun_config"

PLAN_PRICING_KEY = "plan_pricing"

TRIAL_CONFIG_KEY = "trial_config"

DEFAULT_TRIAL_CONFIG = {
    "name": "Spark",
    "days": 7,
    "price": 9.90,
    "currency": "USD",
    "stripe_price_id": "",
    "features": [
        "7 days of full Pro access",
        "Premium AI models (GPT-4, Claude, Gemini)",
        "Unlimited presentations during trial",
        "Export to PPTX & PDF",
        "No subscription — one-time payment",
    ],
}

DEFAULT_PLAN_PRICING = {
    "free": {
        "price_monthly": 0,
        "price_annual": 0,
        "currency": "USD",
        "stripe_price_id_monthly": "",
        "stripe_price_id_annual": "",
        "features": [
            "5 presentations / month",
            "1 concurrent generation",
            "All templates",
            "PDF & PPTX export",
            "Community support",
        ],
    },
    "pro": {
        "price_monthly": 19,
        "price_annual": 190,
        "currency": "USD",
        "stripe_price_id_monthly": "",
        "stripe_price_id_annual": "",
        "features": [
            "Unlimited presentations",
            "3 concurrent generations",
            "All templates",
            "PDF & PPTX export",
            "API access",
            "Priority support",
        ],
    },
    "team": {
        "price_monthly": 49,
        "price_annual": 490,
        "currency": "USD",
        "stripe_price_id_monthly": "",
        "stripe_price_id_annual": "",
        "features": [
            "Unlimited presentations",
            "5 concurrent generations",
            "All templates",
            "PDF & PPTX export",
            "Team workspace",
            "API access",
            "Dedicated support",
        ],
    },
}


async def _get_plan_pricing(session: AsyncSession) -> dict:
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == PLAN_PRICING_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        # Merge defaults so new keys are always present
        pricing = {}
        for plan in ("free", "pro", "team"):
            pricing[plan] = {**DEFAULT_PLAN_PRICING[plan], **row.value.get(plan, {})}
        return pricing
    return DEFAULT_PLAN_PRICING


async def _save_plan_pricing(pricing: dict, session: AsyncSession) -> None:
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == PLAN_PRICING_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = pricing
        session.add(row)
    else:
        session.add(KeyValueSqlModel(key=PLAN_PRICING_KEY, value=pricing))
    await session.commit()


async def _get_trial_config(session: AsyncSession) -> dict:
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == TRIAL_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    if row and row.value:
        return {**DEFAULT_TRIAL_CONFIG, **row.value}
    return DEFAULT_TRIAL_CONFIG


async def _save_trial_config(config: dict, session: AsyncSession) -> None:
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == TRIAL_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        row.value = config
        session.add(row)
    else:
        session.add(KeyValueSqlModel(key=TRIAL_CONFIG_KEY, value=config))
    await session.commit()


ADMIN_ROUTER = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    """Dependency that ensures the caller is an admin."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def _get_template_counts_by_user(
    session: AsyncSession, user_ids: list[int]
) -> dict[int, int]:
    if not user_ids:
        return {}

    result = await session.execute(
        select(
            TemplateModel.user_id,
            func.count(TemplateModel.id).label("custom_templates_count"),
        )
        .where(TemplateModel.user_id.in_(user_ids))
        .group_by(TemplateModel.user_id)
    )
    return {
        row.user_id: row.custom_templates_count
        for row in result
        if row.user_id is not None
    }


# ─── Stats Overview ───────────────────────────────────────────────────────────

@ADMIN_ROUTER.get("/stats")
async def get_platform_stats(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Platform-wide stats for the admin dashboard."""
    total_users = await session.scalar(select(func.count(UserModel.id)))
    active_users = await session.scalar(
        select(func.count(UserModel.id)).where(UserModel.is_active == True)
    )

    free_users = await session.scalar(
        select(func.count(UserModel.id)).where(
            UserModel.plan == "free", UserModel.is_active == True
        )
    )
    pro_users = await session.scalar(
        select(func.count(UserModel.id)).where(
            UserModel.plan == "pro", UserModel.is_active == True
        )
    )
    team_users = await session.scalar(
        select(func.count(UserModel.id)).where(
            UserModel.plan == "team", UserModel.is_active == True
        )
    )

    total_orgs = await session.scalar(select(func.count(OrganizationModel.id)))

    total_presentations = await session.scalar(select(func.count(PresentationModel.id)))
    total_custom_templates = await session.scalar(select(func.count(TemplateModel.id)))
    users_with_custom_templates = await session.scalar(
        select(func.count(func.distinct(TemplateModel.user_id))).where(
            TemplateModel.user_id.isnot(None)
        )
    )

    # Users by storage region
    eu_users = await session.scalar(
        select(func.count(UserModel.id)).where(UserModel.storage_region == "eu")
    )
    us_users = await session.scalar(
        select(func.count(UserModel.id)).where(UserModel.storage_region == "us")
    )

    return {
        "users": {
            "total": total_users or 0,
            "active": active_users or 0,
            "inactive": (total_users or 0) - (active_users or 0),
            "by_plan": {
                "free": free_users or 0,
                "pro": pro_users or 0,
                "team": team_users or 0,
            },
            "by_region": {
                "eu": eu_users or 0,
                "us": us_users or 0,
            },
        },
        "organizations": {
            "total": total_orgs or 0,
        },
        "presentations": {
            "total": total_presentations or 0,
        },
        "custom_templates": {
            "total": total_custom_templates or 0,
            "users_with_templates": users_with_custom_templates or 0,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── Growth Stats ────────────────────────────────────────────────────────────

@ADMIN_ROUTER.get("/growth-stats")
async def get_growth_stats(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Detailed growth metrics for the admin analytics dashboard.
    Returns: daily signups (30d), activation rate, active users, UTM breakdown, MRR estimate.
    """
    from sqlalchemy import text
    from datetime import datetime as _dt

    # Use offset-naive UTC datetimes — the DB column is TIMESTAMP WITHOUT TIME ZONE
    now_aware = datetime.now(timezone.utc)   # kept for return value ISO string only
    now = _dt.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago  = now - timedelta(days=7)

    # ── Daily signups for last 30 days ────────────────────────────────────────
    # Use literal SQL for date_trunc so PostgreSQL sees one expression in SELECT/GROUP/ORDER
    signups_result = await session.execute(
        text("""
            SELECT date_trunc('day', created_at) AS day,
                   count(id) AS count
            FROM users
            WHERE created_at >= :start_date
            GROUP BY date_trunc('day', created_at)
            ORDER BY date_trunc('day', created_at)
        """),
        {"start_date": thirty_days_ago},
    )
    signups_by_day = [
        {"date": row.day.strftime("%Y-%m-%d"), "signups": row.count}
        for row in signups_result
    ]

    # Fill missing days with 0
    date_map = {d["date"]: d["signups"] for d in signups_by_day}
    signups_filled = []
    for i in range(30):
        d = (now - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        signups_filled.append({"date": d, "signups": date_map.get(d, 0)})

    # ── Active users (created or updated a presentation recently) ─────────────
    active_7d = await session.scalar(
        select(func.count(func.distinct(PresentationModel.user_id)))
        .where(PresentationModel.updated_at >= seven_days_ago)
    )
    active_30d = await session.scalar(
        select(func.count(func.distinct(PresentationModel.user_id)))
        .where(PresentationModel.updated_at >= thirty_days_ago)
    )

    # ── Activation rate: % of users who created at least 1 presentation ───────
    total_users = await session.scalar(select(func.count(UserModel.id)))
    activated_users = await session.scalar(
        select(func.count(func.distinct(PresentationModel.user_id)))
    )
    activation_rate = round((activated_users or 0) / max(total_users or 1, 1) * 100, 1)

    # ── Signups this month vs last month ──────────────────────────────────────
    start_of_month     = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_of_last_month = (start_of_month - timedelta(days=1)).replace(day=1)
    signups_this_month = await session.scalar(
        select(func.count(UserModel.id)).where(UserModel.created_at >= start_of_month)
    )
    signups_last_month = await session.scalar(
        select(func.count(UserModel.id))
        .where(UserModel.created_at >= start_of_last_month, UserModel.created_at < start_of_month)
    )

    # ── UTM source breakdown ──────────────────────────────────────────────────
    utm_result = await session.execute(
        select(UserModel.utm_source, func.count(UserModel.id).label("count"))
        .where(UserModel.utm_source.isnot(None))
        .group_by(UserModel.utm_source)
        .order_by(func.count(UserModel.id).desc())
        .limit(10)
    )
    utm_breakdown = [
        {"source": row.utm_source or "unknown", "count": row.count}
        for row in utm_result
    ]

    # ── Conversion: Free → Paid ───────────────────────────────────────────────
    total_free = await session.scalar(
        select(func.count(UserModel.id)).where(UserModel.plan == "free", UserModel.is_active == True)
    )
    total_paid = await session.scalar(
        select(func.count(UserModel.id))
        .where(UserModel.plan.in_(["pro", "team"]), UserModel.is_active == True)
    )
    conversion_rate = round((total_paid or 0) / max((total_free or 0) + (total_paid or 0), 1) * 100, 1)

    # ── MRR estimate from Stripe key-value config ─────────────────────────────
    # We don't store per-subscription MRR in our DB, so we estimate from plan pricing
    plan_pricing_kv = await session.scalar(
        select(KeyValueSqlModel.value).where(KeyValueSqlModel.key == "plan_pricing")
    )
    mrr_estimate: float = 0.0
    if plan_pricing_kv:
        import json as _json
        try:
            pricing = _json.loads(plan_pricing_kv)
            pro_price  = float(pricing.get("pro",  {}).get("price_monthly", 0))
            team_price = float(pricing.get("team", {}).get("price_monthly", 0))
            pro_count  = await session.scalar(
                select(func.count(UserModel.id)).where(UserModel.plan == "pro", UserModel.is_active == True)
            )
            team_count = await session.scalar(
                select(func.count(UserModel.id)).where(UserModel.plan == "team", UserModel.is_active == True)
            )
            mrr_estimate = round((pro_count or 0) * pro_price + (team_count or 0) * team_price, 2)
        except Exception:
            pass

    return {
        "signups_by_day": signups_filled,
        "signups_this_month": signups_this_month or 0,
        "signups_last_month": signups_last_month or 0,
        "active_users_7d": active_7d or 0,
        "active_users_30d": active_30d or 0,
        "activation_rate": activation_rate,
        "total_users": total_users or 0,
        "activated_users": activated_users or 0,
        "conversion_rate": conversion_rate,
        "total_free": total_free or 0,
        "total_paid": total_paid or 0,
        "utm_breakdown": utm_breakdown,
        "mrr_estimate": mrr_estimate,
        "generated_at": now_aware.isoformat(),
    }


# ─── User Management ─────────────────────────────────────────────────────────

@ADMIN_ROUTER.get("/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    plan: Optional[str] = None,
    search: Optional[str] = None,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    offset = (page - 1) * per_page
    query = select(UserModel)

    if plan:
        query = query.where(UserModel.plan == plan)
    if search:
        query = query.where(
            UserModel.email.ilike(f"%{search}%") | UserModel.full_name.ilike(f"%{search}%")
        )

    query = query.order_by(UserModel.created_at.desc()).offset(offset).limit(per_page)
    result = await session.execute(query)
    users = result.scalars().all()
    template_counts = await _get_template_counts_by_user(
        session, [u.id for u in users if u.id is not None]
    )

    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "plan": u.plan,
            "storage_region": u.storage_region,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "storage_used_bytes": u.storage_used_bytes,
            "custom_templates_count": template_counts.get(u.id, 0),
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@ADMIN_ROUTER.get("/users/{user_id}")
async def get_user(
    user_id: int,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    user = await session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    custom_templates_count = await session.scalar(
        select(func.count(TemplateModel.id)).where(TemplateModel.user_id == user.id)
    )

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "storage_region": user.storage_region,
        "stripe_customer_id": user.stripe_customer_id,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "storage_used_bytes": user.storage_used_bytes,
        "presentations_this_month": user.presentations_this_month,
        "custom_templates_count": custom_templates_count or 0,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }


@ADMIN_ROUTER.get("/users/{user_id}/templates")
async def get_user_templates(
    user_id: int,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    user = await session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await session.execute(
        select(TemplateModel)
        .where(TemplateModel.user_id == user_id)
        .order_by(TemplateModel.created_at.desc())
    )
    template_rows = result.scalars().all()
    template_ids = [template.id for template in template_rows]

    layout_stats: dict = {}
    if template_ids:
        stats_result = await session.execute(
            select(
                PresentationLayoutCodeModel.presentation,
                func.count(PresentationLayoutCodeModel.id).label("layout_count"),
                func.max(PresentationLayoutCodeModel.updated_at).label(
                    "last_updated_at"
                ),
            )
            .where(PresentationLayoutCodeModel.presentation.in_(template_ids))
            .group_by(PresentationLayoutCodeModel.presentation)
        )
        layout_stats = {
            row.presentation: {
                "layout_count": row.layout_count or 0,
                "last_updated_at": row.last_updated_at,
            }
            for row in stats_result
        }

    templates = []
    for template in template_rows:
        stats = layout_stats.get(template.id, {})
        last_updated_at = stats.get("last_updated_at")
        templates.append(
            {
                "id": template.id,
                "name": template.name,
                "description": template.description,
                "layout_count": stats.get("layout_count", 0),
                "created_at": template.created_at.isoformat()
                if template.created_at
                else None,
                "last_updated_at": last_updated_at.isoformat()
                if last_updated_at
                else None,
            }
        )

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
        "custom_templates_count": len(templates),
        "templates": templates,
    }


class ChangePlanRequest(BaseModel):
    plan: str


@ADMIN_ROUTER.put("/users/{user_id}/plan")
async def change_user_plan(
    user_id: int,
    body: ChangePlanRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    if body.plan not in ("free", "pro", "team"):
        raise HTTPException(status_code=400, detail="plan must be free, pro, or team")

    user = await session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_plan = user.plan
    user.plan = body.plan
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()

    return {"ok": True, "user_id": user_id, "old_plan": old_plan, "new_plan": body.plan}


@ADMIN_ROUTER.post("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user = await session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    return {"ok": True}


@ADMIN_ROUTER.post("/users/{user_id}/activate")
async def activate_user(
    user_id: int,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    user = await session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    return {"ok": True}


# ─── Org Management ───────────────────────────────────────────────────────────

@ADMIN_ROUTER.get("/orgs")
async def list_orgs(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    offset = (page - 1) * per_page
    result = await session.execute(
        select(OrganizationModel)
        .where(OrganizationModel.is_active == True)
        .order_by(OrganizationModel.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    orgs = result.scalars().all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "slug": o.slug,
            "plan": o.plan,
            "storage_used_bytes": o.storage_used_bytes,
            "created_at": o.created_at.isoformat(),
        }
        for o in orgs
    ]


# ─── AI Provider Catalog ─────────────────────────────────────────────────────

@ADMIN_ROUTER.get("/ai-providers")
async def get_ai_providers(admin: UserModel = Depends(require_admin)):
    """Return the full catalog of supported LLM and image providers with their models."""
    return get_catalog()


# ─── Per-Plan AI Model Configuration ─────────────────────────────────────────

def _serialise_plan_config(cfg: PlanAIConfig) -> dict:
    return {
        "plan": cfg.plan,
        "llm_provider": cfg.llm_provider,
        "llm_model": cfg.llm_model,
        # Never return raw API keys; mask them so the UI can show *** when set
        "llm_api_key_set": bool(cfg.llm_api_key),
        "llm_base_url": cfg.llm_base_url,
        "image_provider": cfg.image_provider,
        "image_model": cfg.image_model,
        "image_api_key_set": bool(cfg.image_api_key),
        "user_can_override_llm": cfg.user_can_override_llm,
        "user_can_override_image": cfg.user_can_override_image,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


@ADMIN_ROUTER.get("/ai-config")
async def get_ai_config(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Return AI model config for all plans (free, pro, team)."""
    configs = await get_all_plan_configs(session)
    return [_serialise_plan_config(c) for c in configs]


class UpdateAIConfigRequest(BaseModel):
    llm_provider: str                    # openai | google | anthropic | ollama | custom
    llm_model: str
    llm_api_key: Optional[str] = None   # None = keep existing; "" = clear
    llm_base_url: Optional[str] = None
    image_provider: str = "pexels"
    image_model: Optional[str] = None
    image_api_key: Optional[str] = None
    user_can_override_llm: bool = False
    user_can_override_image: bool = False


@ADMIN_ROUTER.put("/ai-config/{plan}")
async def update_ai_config(
    plan: str,
    body: UpdateAIConfigRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Update the AI model configuration for a specific plan tier."""
    if plan not in ("free", "pro", "team"):
        raise HTTPException(status_code=400, detail="plan must be free, pro, or team")

    VALID_LLM_PROVIDERS = {"openai", "google", "anthropic", "ollama", "custom", "codex"}
    if body.llm_provider not in VALID_LLM_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"llm_provider must be one of: {', '.join(VALID_LLM_PROVIDERS)}",
        )

    VALID_IMAGE_PROVIDERS = {"pexels", "pixabay", "dall-e-3", "gpt-image-1.5", "gemini_flash", "nanobanana_pro", "comfyui", "none"}
    if body.image_provider not in VALID_IMAGE_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"image_provider must be one of: {', '.join(VALID_IMAGE_PROVIDERS)}",
        )

    cfg = await upsert_plan_ai_config(
        plan=plan,
        llm_provider=body.llm_provider,
        llm_model=body.llm_model,
        llm_api_key=body.llm_api_key,
        llm_base_url=body.llm_base_url,
        image_provider=body.image_provider,
        image_model=body.image_model,
        image_api_key=body.image_api_key,
        admin_id=admin.id,
        session=session,
        user_can_override_llm=body.user_can_override_llm,
        user_can_override_image=body.user_can_override_image,
    )
    return _serialise_plan_config(cfg)


# ─── Plan Pricing Configuration ───────────────────────────────────────────────

@ADMIN_ROUTER.get("/plan-pricing")
async def get_plan_pricing(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Return pricing config for all plans."""
    return await _get_plan_pricing(session)


class PlanPricingEntry(BaseModel):
    price_monthly: float
    price_annual: float
    currency: str = "USD"
    stripe_price_id_monthly: str = ""
    stripe_price_id_annual: str = ""
    features: list[str]


class UpdatePlanPricingRequest(BaseModel):
    free: PlanPricingEntry
    pro: PlanPricingEntry
    team: PlanPricingEntry


@ADMIN_ROUTER.put("/plan-pricing")
async def update_plan_pricing(
    body: UpdatePlanPricingRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Save pricing config for all plans and update .env Stripe Price IDs."""
    import os
    pricing = {
        "free": body.free.model_dump(),
        "pro": body.pro.model_dump(),
        "team": body.team.model_dump(),
    }
    await _save_plan_pricing(pricing, session)

    # Sync Stripe Price IDs back to environment (runtime only — persist in .env manually)
    stripe_map = {
        "STRIPE_PRICE_PRO_MONTHLY": body.pro.stripe_price_id_monthly,
        "STRIPE_PRICE_PRO_ANNUAL": body.pro.stripe_price_id_annual,
        "STRIPE_PRICE_TEAM_MONTHLY": body.team.stripe_price_id_monthly,
        "STRIPE_PRICE_TEAM_ANNUAL": body.team.stripe_price_id_annual,
    }
    for k, v in stripe_map.items():
        if v:
            os.environ[k] = v

    return pricing


@ADMIN_ROUTER.get("/plan-pricing/public")
async def get_plan_pricing_public(
    session: AsyncSession = Depends(get_async_session),
):
    """Public endpoint — returns pricing for billing page (no auth needed)."""
    return await _get_plan_pricing(session)


# ─── Trial Package (Spark) Configuration ──────────────────────────────────────

class TrialConfigRequest(BaseModel):
    name: str = "Spark"
    days: int = 7
    price: float = 9.90
    currency: str = "USD"
    stripe_price_id: str = ""
    features: list[str] = []


@ADMIN_ROUTER.get("/trial-config")
async def get_trial_config(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Return the current trial package (Spark) configuration."""
    return await _get_trial_config(session)


@ADMIN_ROUTER.put("/trial-config")
async def update_trial_config(
    body: TrialConfigRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Save trial package configuration (name, days, price, Stripe price ID, features)."""
    config = body.model_dump()
    await _save_trial_config(config, session)
    return config


@ADMIN_ROUTER.get("/trial-config/public")
async def get_trial_config_public(
    session: AsyncSession = Depends(get_async_session),
):
    """Public endpoint — trial config for billing page (no auth needed)."""
    return await _get_trial_config(session)


# ─── Generated Template Limits ────────────────────────────────────────────────

class TemplateGenerationLimitsRequest(BaseModel):
    free: int = 5
    pro: int = -1
    team: int = -1


@ADMIN_ROUTER.get("/template-generation-limits")
async def get_generated_template_limits(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Return per-plan limits for generated/custom templates. -1 means unlimited."""
    return await get_template_generation_limits(session)


@ADMIN_ROUTER.put("/template-generation-limits")
async def update_generated_template_limits(
    body: TemplateGenerationLimitsRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Save per-plan limits for generated/custom templates. -1 means unlimited."""
    limits = body.model_dump()
    if any(value < -1 for value in limits.values()):
        raise HTTPException(status_code=400, detail="Limits must be -1 or greater")
    return await save_template_generation_limits(limits, session)


# ─── Presentation Generation Limits ──────────────────────────────────────────

class PresentationGenerationLimitsRequest(BaseModel):
    free: int = 5
    pro: int = -1
    team: int = -1


@ADMIN_ROUTER.get("/presentation-generation-limits")
async def get_generated_presentation_limits(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Return monthly per-plan presentation generation limits. -1 means unlimited."""
    return await get_presentation_generation_limits(session)


@ADMIN_ROUTER.put("/presentation-generation-limits")
async def update_generated_presentation_limits(
    body: PresentationGenerationLimitsRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Save monthly per-plan presentation generation limits. -1 means unlimited."""
    limits = body.model_dump()
    if any(value < -1 for value in limits.values()):
        raise HTTPException(status_code=400, detail="Limits must be -1 or greater")
    return await save_presentation_generation_limits(limits, session)


# ─── Billing Stats & Failed Payments ─────────────────────────────────────────

@ADMIN_ROUTER.get("/billing-stats")
async def get_billing_stats(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Billing KPIs: paid users, seats sold, past-due accounts."""
    from models.sql.organization import OrganizationModel

    pro_count = await session.scalar(
        select(func.count(UserModel.id)).where(
            UserModel.plan == "pro", UserModel.is_active == True
        )
    )
    team_users_count = await session.scalar(
        select(func.count(UserModel.id)).where(
            UserModel.plan == "team", UserModel.is_active == True
        )
    )
    past_due_count = await session.scalar(
        select(func.count(UserModel.id)).where(
            UserModel.subscription_status == "past_due", UserModel.is_active == True
        )
    )
    # Seats sold = sum of seats_purchased across all active team orgs
    seats_result = await session.execute(
        select(func.coalesce(func.sum(OrganizationModel.seats_purchased), 0)).where(
            OrganizationModel.is_active == True
        )
    )
    total_seats = seats_result.scalar() or 0

    return {
        "pro_users": pro_count or 0,
        "team_users": team_users_count or 0,
        "past_due_accounts": past_due_count or 0,
        "total_team_seats_sold": int(total_seats),
    }


@ADMIN_ROUTER.get("/failed-payments")
async def get_failed_payments(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """List users with past_due subscriptions for admin follow-up."""
    result = await session.execute(
        select(UserModel).where(
            UserModel.subscription_status == "past_due",
            UserModel.is_active == True,
        ).order_by(UserModel.updated_at.desc())
    )
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "plan": u.plan,
            "updated_at": u.updated_at.isoformat(),
        }
        for u in users
    ]


# ─── Stripe Configuration ─────────────────────────────────────────────────────

async def _get_stripe_config(session: AsyncSession) -> dict:
    """Load Stripe config from DB; fall back to env vars if not set."""
    import os
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == STRIPE_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    db = row.value if row else {}
    return {
        "publishable_key": db.get("publishable_key") or os.getenv("STRIPE_PUBLISHABLE_KEY", ""),
        # Secret key and webhook secret are returned as a boolean (set/not set) — never expose raw value
        "secret_key_set": bool(db.get("secret_key") or os.getenv("STRIPE_SECRET_KEY", "")),
        "webhook_secret_set": bool(db.get("webhook_secret") or os.getenv("STRIPE_WEBHOOK_SECRET", "")),
        "mode": db.get("mode", "test"),  # "test" or "live"
    }


async def _get_stripe_secrets(session: AsyncSession) -> dict:
    """Load decrypted Stripe secrets for internal use by billing logic."""
    import os
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == STRIPE_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    db = row.value if row else {}
    return {
        "secret_key": decrypt_value(db.get("secret_key", "")) or os.getenv("STRIPE_SECRET_KEY", ""),
        "webhook_secret": decrypt_value(db.get("webhook_secret", "")) or os.getenv("STRIPE_WEBHOOK_SECRET", ""),
        "publishable_key": db.get("publishable_key") or os.getenv("STRIPE_PUBLISHABLE_KEY", ""),
    }


class UpdateStripeConfigRequest(BaseModel):
    publishable_key: str = ""
    secret_key: Optional[str] = None          # None = keep existing
    webhook_secret: Optional[str] = None      # None = keep existing
    mode: str = "test"                        # "test" | "live"


@ADMIN_ROUTER.get("/stripe-config")
async def get_stripe_config(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Get Stripe configuration. Secret values are never returned — only a boolean indicating if they are set."""
    return await _get_stripe_config(session)


@ADMIN_ROUTER.put("/stripe-config")
async def update_stripe_config(
    body: UpdateStripeConfigRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Save Stripe configuration. Secret key and webhook secret are encrypted before storage."""
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == STRIPE_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    existing = row.value if row else {}

    new_value = {
        "publishable_key": body.publishable_key,
        "mode": body.mode,
        # Only overwrite secrets if a new value is explicitly provided
        "secret_key": encrypt_value(body.secret_key) if body.secret_key else existing.get("secret_key", ""),
        "webhook_secret": encrypt_value(body.webhook_secret) if body.webhook_secret else existing.get("webhook_secret", ""),
    }

    if row:
        row.value = new_value
        session.add(row)
    else:
        session.add(KeyValueSqlModel(key=STRIPE_CONFIG_KEY, value=new_value))
    await session.commit()

    return await _get_stripe_config(session)


# ─── Mailgun Email Configuration ──────────────────────────────────────────────

async def _get_mailgun_config(session: AsyncSession) -> dict:
    """Load Mailgun config from DB. API key is never returned — only a boolean."""
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == MAILGUN_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    db = row.value if row else {}
    return {
        "domain": db.get("domain", ""),
        "from_email": db.get("from_email", ""),
        "from_name": db.get("from_name", "Unslid"),
        "api_key_set": bool(db.get("api_key", "")),
        "region": db.get("region", "us"),   # "us" | "eu"
    }


async def get_mailgun_secrets(session: AsyncSession) -> dict:
    """Load decrypted Mailgun credentials for internal use by the email service."""
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == MAILGUN_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    db = row.value if row else {}
    return {
        "domain": db.get("domain", ""),
        "from_email": db.get("from_email", ""),
        "from_name": db.get("from_name", "Unslid"),
        "api_key": decrypt_value(db.get("api_key", "")),
        "region": db.get("region", "us"),
    }


class UpdateMailgunConfigRequest(BaseModel):
    domain: str = ""                   # e.g. mg.unslid.com
    from_email: str = ""               # e.g. noreply@unslid.com
    from_name: str = "Unslid"
    api_key: Optional[str] = None      # None = keep existing
    region: str = "us"                 # "us" | "eu"


@ADMIN_ROUTER.get("/mailgun-config")
async def get_mailgun_config(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Get Mailgun configuration. API key is never returned — only a boolean indicating if it is set."""
    return await _get_mailgun_config(session)


@ADMIN_ROUTER.put("/mailgun-config")
async def update_mailgun_config(
    body: UpdateMailgunConfigRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Save Mailgun configuration. API key is encrypted before storage."""
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == MAILGUN_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    existing = row.value if row else {}

    new_value = {
        "domain": body.domain,
        "from_email": body.from_email,
        "from_name": body.from_name,
        "region": body.region,
        "api_key": encrypt_value(body.api_key) if body.api_key else existing.get("api_key", ""),
    }

    if row:
        row.value = new_value
        session.add(row)
    else:
        session.add(KeyValueSqlModel(key=MAILGUN_CONFIG_KEY, value=new_value))
    await session.commit()

    return await _get_mailgun_config(session)


@ADMIN_ROUTER.post("/mailgun-config/test")
async def test_mailgun_config(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Send a test email to the admin's own address to verify Mailgun is configured correctly."""
    secrets = await get_mailgun_secrets(session)
    if not secrets["api_key"] or not secrets["domain"]:
        raise HTTPException(status_code=400, detail="Mailgun is not configured yet.")

    from services.emails.email_service import send_test_email
    ok = await send_test_email(admin.email, admin.full_name or "Admin", secrets)
    if not ok:
        raise HTTPException(status_code=502, detail="Test email failed — check your Mailgun credentials.")
    return {"ok": True, "message": f"Test email sent to {admin.email}"}


# ─── Template Tier Management ─────────────────────────────────────────────────

class UpdateTemplateTierRequest(BaseModel):
    tier: Optional[str] = None        # "free" | "premium"
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    name: Optional[str] = None


@ADMIN_ROUTER.get("/template-tiers")
async def get_template_tiers(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """List all template sets with their tier configuration."""
    result = await session.execute(
        select(TemplateTierModel).order_by(TemplateTierModel.sort_order)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "template_id": r.template_id,
            "name": r.name,
            "tier": r.tier,
            "is_active": r.is_active,
            "sort_order": r.sort_order,
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


@ADMIN_ROUTER.put("/template-tiers/{template_id}")
async def update_template_tier(
    template_id: str,
    body: UpdateTemplateTierRequest,
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
):
    """Update tier, visibility, sort order, or name for a template set."""
    result = await session.execute(
        select(TemplateTierModel).where(TemplateTierModel.template_id == template_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Template set not found")

    if body.tier is not None:
        if body.tier not in ("free", "premium"):
            raise HTTPException(status_code=400, detail="tier must be 'free' or 'premium'")
        row.tier = body.tier
    if body.is_active is not None:
        row.is_active = body.is_active
    if body.sort_order is not None:
        row.sort_order = body.sort_order
    if body.name is not None:
        row.name = body.name

    row.updated_at = datetime.utcnow()
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return {
        "id": row.id,
        "template_id": row.template_id,
        "name": row.name,
        "tier": row.tier,
        "is_active": row.is_active,
        "sort_order": row.sort_order,
        "updated_at": row.updated_at.isoformat(),
    }


# ─── Abuse / High-Usage Monitor ───────────────────────────────────────────────

@ADMIN_ROUTER.get("/usage-monitor")
async def get_usage_monitor(
    admin: UserModel = Depends(require_admin),
    session: AsyncSession = Depends(get_async_session),
    limit: int = 25,
):
    """
    Return the top users by activity this month for abuse detection.
    Shows: presentations, estimated tokens, image count, active sessions.
    """
    from utils.rate_limit import get_token_usage, get_image_usage, get_active_sessions

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    presentation_counts = (
        select(
            PresentationModel.user_id,
            func.count(PresentationModel.id).label("presentation_count"),
        )
        .where(PresentationModel.user_id.is_not(None))
        .group_by(PresentationModel.user_id)
        .subquery()
    )
    monthly_presentation_counts = (
        select(
            PresentationModel.user_id,
            func.count(PresentationModel.id).label("presentation_count"),
        )
        .where(PresentationModel.user_id.is_not(None))
        .where(PresentationModel.created_at >= month_start)
        .group_by(PresentationModel.user_id)
        .subquery()
    )

    # Top users by actual generated presentation count.
    result = await session.execute(
        select(
            UserModel,
            func.coalesce(presentation_counts.c.presentation_count, 0).label("presentation_count"),
            func.coalesce(monthly_presentation_counts.c.presentation_count, 0).label("monthly_presentation_count"),
        )
        .outerjoin(presentation_counts, presentation_counts.c.user_id == UserModel.id)
        .outerjoin(
            monthly_presentation_counts,
            monthly_presentation_counts.c.user_id == UserModel.id,
        )
        .where(UserModel.is_active == True)
        .order_by(
            func.coalesce(monthly_presentation_counts.c.presentation_count, 0).desc(),
            func.coalesce(presentation_counts.c.presentation_count, 0).desc(),
        )
        .limit(limit)
    )
    user_rows = result.all()
    users = [row[0] for row in user_rows]
    presentation_count_by_user = {
        row[0].id: int(row[1] or 0)
        for row in user_rows
        if row[0].id is not None
    }
    monthly_presentation_count_by_user = {
        row[0].id: int(row[2] or 0)
        for row in user_rows
        if row[0].id is not None
    }
    template_counts = await _get_template_counts_by_user(
        session, [u.id for u in users if u.id is not None]
    )

    rows = []
    for u in users:
        tokens = await get_token_usage(u.id)
        images = await get_image_usage(u.id)
        sessions = await get_active_sessions(u.id)
        rows.append({
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "plan": u.plan,
            "presentations_total": presentation_count_by_user.get(u.id, 0),
            "presentations_this_month": monthly_presentation_count_by_user.get(u.id, 0),
            "custom_templates_count": template_counts.get(u.id, 0),
            "tokens_estimated_this_month": tokens,
            "images_this_month": images,
            "active_ips": sessions,
            "active_session_count": len(sessions),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {"users": rows, "generated_at": datetime.utcnow().isoformat()}
