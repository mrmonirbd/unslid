"""
Stripe billing integration.

Endpoints:
- POST /billing/checkout      → create Stripe Checkout session
- POST /billing/portal        → create Stripe Customer Portal session
- GET  /billing/status        → get current plan and usage
- POST /webhooks/stripe       → handle Stripe webhook events
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlmodel.ext.asyncio.session import AsyncSession

from sqlmodel import select

from api.auth import get_current_user
from models.sql.user import UserModel
from models.sql.key_value import KeyValueSqlModel
from services.database import get_async_session
from utils.rate_limit import get_user_usage
from utils.presentation_generation_limits import (
    get_monthly_presentation_count,
    get_presentation_generation_limits,
)

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
    "free": {"price_monthly": 0, "price_annual": 0, "currency": "USD", "stripe_price_id_monthly": "", "stripe_price_id_annual": "", "features": ["5 presentations / month", "1 concurrent generation", "All templates", "PDF & PPTX export", "Community support"]},
    "pro": {"price_monthly": 19, "price_annual": 190, "currency": "USD", "stripe_price_id_monthly": "", "stripe_price_id_annual": "", "features": ["Unlimited presentations", "3 concurrent generations", "All templates", "PDF & PPTX export", "API access", "Priority support"]},
    "team": {"price_monthly": 49, "price_annual": 490, "currency": "USD", "stripe_price_id_monthly": "", "stripe_price_id_annual": "", "features": ["Unlimited presentations", "5 concurrent generations", "All templates", "PDF & PPTX export", "Team workspace", "API access", "Dedicated support"]},
}


async def _load_plan_pricing(session: AsyncSession) -> dict:
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == PLAN_PRICING_KEY)
    )
    row = result.scalar_one_or_none()
    if row:
        merged = {}
        for plan in ("free", "pro", "team"):
            merged[plan] = {**DEFAULT_PLAN_PRICING[plan], **row.value.get(plan, {})}
        return merged
    return DEFAULT_PLAN_PRICING


async def _load_trial_config(session: AsyncSession) -> dict:
    result = await session.execute(
        select(KeyValueSqlModel).where(KeyValueSqlModel.key == TRIAL_CONFIG_KEY)
    )
    row = result.scalar_one_or_none()
    if row and row.value:
        return {**DEFAULT_TRIAL_CONFIG, **row.value}
    return DEFAULT_TRIAL_CONFIG

logger = logging.getLogger(__name__)

BILLING_ROUTER = APIRouter(prefix="/billing", tags=["billing"])
WEBHOOK_ROUTER = APIRouter(prefix="/webhooks", tags=["webhooks"])

APP_DOMAIN = os.getenv("APP_DOMAIN", "localhost")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Stripe plan → price ID mapping
# These are read from env vars but can be overridden by the DB plan pricing config
PRICE_IDS = {
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", ""),
    "pro_annual": os.getenv("STRIPE_PRICE_PRO_ANNUAL", ""),
    "team_monthly": os.getenv("STRIPE_PRICE_TEAM_MONTHLY", ""),
    "team_annual": os.getenv("STRIPE_PRICE_TEAM_ANNUAL", ""),
}

STRIPE_CONFIG_KEY = "stripe_config"


def _stripe_object_to_dict(obj):
    """Normalize Stripe SDK objects across stripe-python versions."""
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "to_dict_recursive"):
        return obj.to_dict_recursive()
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if hasattr(obj, "to_json"):
        return json.loads(obj.to_json())
    return dict(obj)


async def _get_stripe_secrets_from_db(session: AsyncSession) -> dict:
    """Load decrypted Stripe secrets from DB; fall back to env vars."""
    from utils.crypto import decrypt_value
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


async def get_stripe_async(session: AsyncSession):
    """Get a configured Stripe client, reading secret from DB then env fallback."""
    secrets = await _get_stripe_secrets_from_db(session)
    if not secrets["secret_key"]:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please add your Stripe secret key in Admin → Payment Settings.",
        )
    stripe.api_key = secrets["secret_key"]
    return stripe


def get_stripe():
    """Legacy sync helper — reads from env only. Use get_stripe_async() for new endpoints."""
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please add your Stripe secret key in Admin → Payment Settings.",
        )
    stripe.api_key = key
    return stripe


def get_app_url() -> str:
    if ENVIRONMENT == "development":
        return "http://localhost"
    return f"https://{APP_DOMAIN}"


def _append_checkout_session_id(url: str) -> str:
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}session_id={{CHECKOUT_SESSION_ID}}"


# ─── Checkout ────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    price_id: str
    success_path: str = "/settings/billing?success=true"
    cancel_path: str = "/settings/billing?cancelled=true"


class CheckoutSyncRequest(BaseModel):
    session_id: str


class SubscriptionIntentRequest(BaseModel):
    price_id: str


class SubscriptionSyncRequest(BaseModel):
    subscription_id: str


@BILLING_ROUTER.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a Stripe Checkout session for upgrading a plan."""
    s = await get_stripe_async(session)
    base_url = get_app_url()

    # Ensure user has a Stripe customer record
    if not current_user.stripe_customer_id:
        customer = s.Customer.create(
            email=current_user.email,
            name=current_user.full_name,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        current_user.updated_at = datetime.now(timezone.utc)
        session.add(current_user)
        await session.commit()

    checkout = s.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": body.price_id, "quantity": 1}],
        mode="subscription",
        success_url=_append_checkout_session_id(f"{base_url}{body.success_path}"),
        cancel_url=f"{base_url}{body.cancel_path}",
        metadata={"user_id": str(current_user.id)},
    )
    return {"url": checkout.url}


def _get_subscription_plan(subscription: dict, plan_pricing: dict | None = None) -> str:
    price_id = subscription["items"]["data"][0]["price"]["id"]
    return _price_id_to_plan(price_id, plan_pricing)


def _subscription_client_secret(subscription: dict) -> str | None:
    invoice = subscription.get("latest_invoice")
    if isinstance(invoice, dict):
        payment_intent = invoice.get("payment_intent")
        if isinstance(payment_intent, dict):
            return payment_intent.get("client_secret")
        confirmation_secret = invoice.get("confirmation_secret")
        if isinstance(confirmation_secret, dict):
            return confirmation_secret.get("client_secret")
    return None


@BILLING_ROUTER.post("/subscription-intent")
async def create_subscription_intent(
    body: SubscriptionIntentRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create an incomplete subscription for in-page Stripe Payment Element confirmation."""
    s = await get_stripe_async(session)
    secrets = await _get_stripe_secrets_from_db(session)

    if not current_user.stripe_customer_id:
        customer = s.Customer.create(
            email=current_user.email,
            name=current_user.full_name,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        current_user.updated_at = datetime.now(timezone.utc)
        session.add(current_user)
        await session.commit()

    subscription = _stripe_object_to_dict(
        s.Subscription.create(
            customer=current_user.stripe_customer_id,
            items=[{"price": body.price_id}],
            payment_behavior="default_incomplete",
            payment_settings={"save_default_payment_method": "on_subscription"},
            metadata={"user_id": str(current_user.id)},
            expand=["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
        )
    )

    client_secret = _subscription_client_secret(subscription)
    if not client_secret:
        raise HTTPException(status_code=502, detail="Stripe did not return a payment intent for this subscription.")

    return {
        "client_secret": client_secret,
        "subscription_id": subscription["id"],
        "publishable_key": secrets["publishable_key"],
    }


@BILLING_ROUTER.post("/subscription/sync")
async def sync_subscription(
    body: SubscriptionSyncRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Sync a Stripe subscription after in-page Payment Element confirmation."""
    s = await get_stripe_async(session)
    subscription = _stripe_object_to_dict(
        s.Subscription.retrieve(body.subscription_id, expand=["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"])
    )

    if subscription.get("customer") != current_user.stripe_customer_id:
        raise HTTPException(status_code=403, detail="Subscription does not belong to this user.")

    status = subscription.get("status")
    if status not in ("active", "trialing"):
        return {"synced": False, "plan": current_user.plan, "status": status}

    plan_pricing = await _load_plan_pricing(session)
    current_user.plan = _get_subscription_plan(subscription, plan_pricing)
    current_user.subscription_status = "active"
    current_user.cancel_at_period_end = bool(subscription.get("cancel_at_period_end", False))
    cancel_at = subscription.get("cancel_at")
    current_user.subscription_ends_at = (
        datetime.fromtimestamp(cancel_at, tz=timezone.utc) if cancel_at else None
    )
    current_user.updated_at = datetime.now(timezone.utc)
    session.add(current_user)
    await session.commit()
    return {"synced": True, "plan": current_user.plan, "status": current_user.subscription_status}


@BILLING_ROUTER.post("/checkout/sync")
async def sync_checkout_session(
    body: CheckoutSyncRequest,
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Verify a completed Checkout session and sync the user plan.

    Stripe webhooks remain the source of truth in production, but local/dev flows
    often return to the app before the webhook is delivered or without webhook
    forwarding at all. This endpoint makes the success return path deterministic.
    """
    s = await get_stripe_async(session)

    checkout_session = _stripe_object_to_dict(
        s.checkout.Session.retrieve(body.session_id)
    )
    customer_id = checkout_session.get("customer")
    metadata = checkout_session.get("metadata", {}) or {}
    user_id_meta = metadata.get("user_id")

    belongs_to_current_user = (
        (customer_id and customer_id == current_user.stripe_customer_id)
        or (user_id_meta and str(user_id_meta) == str(current_user.id))
    )
    if not belongs_to_current_user:
        raise HTTPException(status_code=403, detail="Checkout session does not belong to this user.")

    if checkout_session.get("payment_status") not in ("paid", "no_payment_required"):
        return {"synced": False, "plan": current_user.plan, "status": checkout_session.get("payment_status")}

    mode = checkout_session.get("mode")
    if mode == "payment" and metadata.get("type") == "trial":
        await _handle_trial_payment_completed(session, checkout_session)
    elif mode == "subscription":
        await _handle_subscription_change(session, checkout_session, "checkout.session.sync")

    await session.refresh(current_user)
    return {"synced": True, "plan": current_user.plan, "status": current_user.subscription_status}


# ─── Trial Checkout (one-time payment) ───────────────────────────────────────

@BILLING_ROUTER.post("/checkout/trial")
async def create_trial_checkout_session(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Create a Stripe Checkout session for the Spark one-time trial (mode=payment).
    On completion, the webhook sets plan=pro and trial_expires_at=now+N days.
    """
    trial_config = await _load_trial_config(session)

    price_id = trial_config.get("stripe_price_id", "")
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail="Trial package is not configured yet. Please contact support.",
        )

    # Block if user already has an active subscription (they don't need a trial)
    if current_user.plan in ("pro", "team") and not current_user.trial_expires_at:
        raise HTTPException(
            status_code=400,
            detail="You already have an active plan. Upgrade from the billing page.",
        )

    s = await get_stripe_async(session)
    base_url = get_app_url()

    # Ensure Stripe customer exists
    if not current_user.stripe_customer_id:
        customer = s.Customer.create(
            email=current_user.email,
            name=current_user.full_name,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        current_user.updated_at = datetime.now(timezone.utc)
        session.add(current_user)
        await session.commit()

    checkout = s.checkout.Session.create(
        customer=current_user.stripe_customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="payment",
        success_url=_append_checkout_session_id(f"{base_url}/settings/billing?trial_success=1"),
        cancel_url=f"{base_url}/settings/billing?cancelled=true",
        metadata={
            "user_id": str(current_user.id),
            "type": "trial",
        },
    )
    return {"url": checkout.url}


# ─── Customer Portal ─────────────────────────────────────────────────────────

@BILLING_ROUTER.post("/portal")
async def create_portal_session(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Create a Stripe Customer Portal session to manage subscription."""
    s = await get_stripe_async(session)
    base_url = get_app_url()

    if not current_user.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No billing account found. Please subscribe first.",
        )

    portal = s.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{base_url}/settings/billing",
    )
    return {"url": portal.url}


# ─── Billing Status ───────────────────────────────────────────────────────────

@BILLING_ROUTER.get("/status")
async def get_billing_status(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return current plan, usage stats, available price IDs, plan pricing, and trial config."""
    usage = await get_user_usage(current_user.id, current_user.plan)
    presentation_limits = await get_presentation_generation_limits(session)
    usage["presentations_this_month"] = await get_monthly_presentation_count(
        current_user.id,
        session,
    )
    monthly_limit = presentation_limits.get(
        current_user.plan,
        presentation_limits["free"],
    )
    usage["monthly_limit"] = monthly_limit if monthly_limit >= 0 else None
    plan_pricing = await _load_plan_pricing(session)
    trial_config = await _load_trial_config(session)

    # Sync Stripe Price IDs from DB into PRICE_IDS runtime dict
    for plan_key in ("pro", "team"):
        for cadence in ("monthly", "annual"):
            pid = plan_pricing.get(plan_key, {}).get(f"stripe_price_id_{cadence}", "")
            if pid:
                PRICE_IDS[f"{plan_key}_{cadence}"] = pid

    # Compute days remaining for active trials
    trial_expires_at = current_user.trial_expires_at
    trial_days_remaining: int | None = None
    if trial_expires_at:
        remaining = (trial_expires_at - datetime.utcnow()).days
        trial_days_remaining = max(remaining, 0)

    return {
        "plan": current_user.plan,
        "storage_region": current_user.storage_region,
        "storage_used_bytes": current_user.storage_used_bytes,
        "usage": usage,
        "prices": PRICE_IDS,
        "plan_pricing": plan_pricing,
        "trial_config": trial_config,
        "trial_expires_at": trial_expires_at.isoformat() if trial_expires_at else None,
        "trial_days_remaining": trial_days_remaining,
        "has_billing": bool(current_user.stripe_customer_id),
        "subscription_status": current_user.subscription_status,
        "cancel_at_period_end": current_user.cancel_at_period_end,
        "subscription_ends_at": current_user.subscription_ends_at.isoformat() if current_user.subscription_ends_at else None,
    }


@BILLING_ROUTER.get("/invoices")
async def get_invoices(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return last 12 Stripe invoices for the current user."""
    s = await get_stripe_async(session)
    if not current_user.stripe_customer_id:
        return []

    invoices = s.Invoice.list(
        customer=current_user.stripe_customer_id,
        limit=12,
    )

    result = []
    for inv in invoices.data:
        result.append({
            "id": inv.id,
            "date": datetime.fromtimestamp(inv.created, tz=timezone.utc).isoformat(),
            "description": inv.lines.data[0].description if inv.lines.data else "Subscription",
            "amount": inv.amount_paid / 100,
            "currency": inv.currency.upper(),
            "status": inv.status,
            "pdf_url": inv.invoice_pdf,
            "hosted_url": inv.hosted_invoice_url,
        })
    return result


@BILLING_ROUTER.get("/payment-method")
async def get_payment_method(
    current_user: UserModel = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
):
    """Return the current default payment method for the customer."""
    s = await get_stripe_async(session)
    if not current_user.stripe_customer_id:
        return None

    try:
        customer = s.Customer.retrieve(
            current_user.stripe_customer_id,
            expand=["invoice_settings.default_payment_method"],
        )
        pm = customer.get("invoice_settings", {}).get("default_payment_method")
        if not pm or isinstance(pm, str):
            # Try fetching from subscriptions
            subs = s.Subscription.list(customer=current_user.stripe_customer_id, limit=1)
            if subs.data:
                pm_id = subs.data[0].get("default_payment_method")
                if pm_id:
                    pm = s.PaymentMethod.retrieve(pm_id)

        if pm and hasattr(pm, "card"):
            card = pm.card
            return {
                "brand": card.brand,
                "last4": card.last4,
                "exp_month": card.exp_month,
                "exp_year": card.exp_year,
            }
    except Exception as e:
        logger.warning(f"Could not fetch payment method: {e}")
    return None


@BILLING_ROUTER.get("/pricing")
async def get_public_pricing(
    session: AsyncSession = Depends(get_async_session),
):
    """Public endpoint — plan pricing for marketing/billing pages (no auth)."""
    return await _load_plan_pricing(session)


# ─── Stripe Webhooks ─────────────────────────────────────────────────────────

@WEBHOOK_ROUTER.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    session: AsyncSession = Depends(get_async_session),
):
    """Handle Stripe webhook events to sync subscription state."""
    secrets = await _get_stripe_secrets_from_db(session)
    webhook_secret = secrets["webhook_secret"]
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured. Add it in Admin → Payment Settings.")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = _stripe_object_to_dict(event["data"]["object"])

    logger.info(f"Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        # Route: one-time trial payment vs. subscription checkout
        if data.get("mode") == "payment" and data.get("metadata", {}).get("type") == "trial":
            await _handle_trial_payment_completed(session, data)
        else:
            await _handle_subscription_change(session, data, event_type)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_change(session, data, event_type)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_cancelled(session, data)
    elif event_type == "invoice.payment_failed":
        await _handle_payment_failed(session, data)
    elif event_type == "invoice.paid":
        await _handle_invoice_paid(session, data)

    return {"received": True}


async def _get_user_by_customer(session: AsyncSession, customer_id: str):
    result = await session.execute(
        select(UserModel).where(UserModel.stripe_customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def _handle_subscription_change(session: AsyncSession, data: dict, event_type: str):
    """Update user plan when subscription changes."""
    customer_id = data.get("customer")
    if not customer_id:
        return

    user = await _get_user_by_customer(session, customer_id)
    if not user:
        logger.warning(f"No user found for Stripe customer {customer_id}")
        return

    subscription_id = data.get("subscription") or data.get("id")
    if subscription_id:
        secrets = await _get_stripe_secrets_from_db(session)
        stripe.api_key = secrets["secret_key"]
        subscription = _stripe_object_to_dict(stripe.Subscription.retrieve(subscription_id))
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan_pricing = await _load_plan_pricing(session)
        new_plan = _price_id_to_plan(price_id, plan_pricing)
        # Sync cancel_at_period_end
        user.cancel_at_period_end = bool(subscription.get("cancel_at_period_end", False))
        cancel_at = subscription.get("cancel_at")
        if cancel_at:
            user.subscription_ends_at = datetime.fromtimestamp(cancel_at, tz=timezone.utc)
    else:
        new_plan = "pro"

    user.plan = new_plan
    user.subscription_status = "active"
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    logger.info(f"User {user.id} plan updated to {new_plan}")


async def _handle_subscription_cancelled(session: AsyncSession, data: dict):
    """Downgrade user to free plan when subscription is cancelled."""
    customer_id = data.get("customer")
    if not customer_id:
        return

    user = await _get_user_by_customer(session, customer_id)
    if not user:
        return

    user.plan = "free"
    user.subscription_status = "cancelled"
    user.cancel_at_period_end = False
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    logger.info(f"User {user.id} downgraded to free (subscription cancelled)")

    # Send cancellation email (non-blocking)
    try:
        from services.emails import send_subscription_cancelled_email
        await send_subscription_cancelled_email(user.email, user.full_name or user.email)
    except Exception as e:
        logger.warning(f"Failed to send cancellation email: {e}")


async def _handle_payment_failed(session: AsyncSession, data: dict):
    """Mark user as past_due and send a warning email."""
    customer_id = data.get("customer")
    if not customer_id:
        return

    user = await _get_user_by_customer(session, customer_id)
    if not user:
        return

    user.subscription_status = "past_due"
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    logger.info(f"User {user.id} marked past_due (payment failed)")

    try:
        from services.emails import send_payment_failed_email
        await send_payment_failed_email(user.email, user.full_name or user.email)
    except Exception as e:
        logger.warning(f"Failed to send payment failed email: {e}")


async def _handle_invoice_paid(session: AsyncSession, data: dict):
    """Clear past_due status when payment succeeds."""
    customer_id = data.get("customer")
    if not customer_id:
        return

    user = await _get_user_by_customer(session, customer_id)
    if not user:
        return

    if user.subscription_status == "past_due":
        user.subscription_status = "active"
        user.updated_at = datetime.now(timezone.utc)
        session.add(user)
        await session.commit()
        logger.info(f"User {user.id} payment recovered — status back to active")


async def _handle_trial_payment_completed(session: AsyncSession, data: dict):
    """Activate Spark trial: set plan=pro and trial_expires_at=now+N days."""
    customer_id = data.get("customer")
    user_id_meta = data.get("metadata", {}).get("user_id")

    user = None
    if customer_id:
        user = await _get_user_by_customer(session, customer_id)
    if not user and user_id_meta:
        result = await session.execute(
            select(UserModel).where(UserModel.id == int(user_id_meta))
        )
        user = result.scalar_one_or_none()

    if not user:
        logger.warning(f"Trial payment completed but no user found (customer={customer_id})")
        return

    trial_config = await _load_trial_config(session)
    days = int(trial_config.get("days", 7))

    user.plan = "pro"
    user.trial_expires_at = datetime.utcnow() + timedelta(days=days)
    user.subscription_status = "active"
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    logger.info(
        f"User {user.id} Spark trial activated — expires {user.trial_expires_at.date()} ({days} days)"
    )


def _price_id_to_plan(price_id: str, plan_pricing: dict | None = None) -> str:
    """Map a Stripe price ID to a plan name."""
    if plan_pricing:
        for plan_key in ("pro", "team"):
            for cadence in ("monthly", "annual"):
                if plan_pricing.get(plan_key, {}).get(f"stripe_price_id_{cadence}") == price_id:
                    return plan_key

    for plan_key, pid in PRICE_IDS.items():
        if pid == price_id:
            if "team" in plan_key:
                return "team"
            if "pro" in plan_key:
                return "pro"
    return "pro"  # Default to pro for unknown paid plans
