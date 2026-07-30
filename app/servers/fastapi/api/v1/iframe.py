import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel.ext.asyncio.session import AsyncSession

from api.auth import _create_access_token
from models.sql.iframe_customer import IframeCustomer
from models.sql.user import UserModel
from services.database import get_async_session
from utils.crypto import encrypt_value


IFRAME_ROUTER = APIRouter(prefix="/iframe", tags=["iframe"])


class IframeValidateRequest(BaseModel):
    site_domain: str = Field(min_length=1)
    api_key: str = Field(min_length=1)
    customer_key: str = Field(min_length=1)
    domain: str | None = None
    customer_api_key: str | None = None


def _clean_domain(value: str) -> str:
    return value.strip().lower().strip("/")


def _as_customer_payload(data: dict[str, Any]) -> dict[str, Any]:
    if isinstance(data.get("customer"), dict):
        return data["customer"]
    if isinstance(data.get("data"), dict):
        return data["data"]
    return data


def _crm_value(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return None


def _crm_base_url() -> str:
    base_url = os.getenv("IFRAME_CRM_BASE_URL", "").strip()
    if not base_url:
        return ""
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return base_url.rstrip("/")


def _crm_headers(api_key: str) -> dict[str, str]:
    headers = {"Accept": "application/json", "Content-Type": "application/json"}

    bearer = os.getenv("IFRAME_CRM_AUTH_TOKEN", "").strip()
    header_api_key = os.getenv("IFRAME_CRM_API_KEY", "").strip() or api_key.strip()
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    if header_api_key:
        headers["x-api-key"] = header_api_key
    return headers


async def _lookup_zettable_orders(body: IframeValidateRequest) -> dict[str, Any]:
    customer_api_key = (body.customer_api_key or body.customer_key).strip()
    base_url = _crm_base_url()
    if not customer_api_key:
        raise HTTPException(status_code=404, detail="Iframe customer not found.")
    if not base_url:
        raise HTTPException(status_code=502, detail="CRM base URL is not configured.")

    url = f"{base_url}/api/customers/{quote(customer_api_key, safe='')}/orders"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, headers=_crm_headers(body.api_key))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"CRM validation failed: {exc}") from exc

    if response.status_code in {401, 403, 404}:
        raise HTTPException(status_code=404, detail="Iframe customer not found.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="CRM validation failed.")

    data = response.json()
    if not isinstance(data, dict) or data.get("status") is not True:
        raise HTTPException(status_code=404, detail="Iframe customer not found.")

    orders = data.get("data") if isinstance(data.get("data"), list) else []
    first_order = orders[0] if orders and isinstance(orders[0], dict) else {}
    profile = data.get("customer") if isinstance(data.get("customer"), dict) else {}
    if not profile and isinstance(first_order.get("customer"), dict):
        profile = first_order["customer"]

    return {
        **profile,
        "customer_id": _crm_value(profile, "customer_id", "id") or customer_api_key,
        "customer_api_key": customer_api_key,
        "domain": body.site_domain,
        "customer_domain": body.site_domain,
        "crm_base_url": base_url,
        "orders": orders,
        "order_count": len(orders),
        "crm_response": data,
    }


async def _lookup_crm(body: IframeValidateRequest) -> dict[str, Any]:
    if body.customer_api_key or os.getenv("IFRAME_CRM_BASE_URL", "").strip():
        return await _lookup_zettable_orders(body)

    url = os.getenv("IFRAME_CRM_VALIDATE_URL", "").strip()
    if not url:
        raise HTTPException(status_code=404, detail="Iframe customer not found.")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=body.model_dump(), headers=_crm_headers(body.api_key))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"CRM validation failed: {exc}") from exc

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Iframe customer not found.")
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="CRM validation failed.")

    data = response.json()
    customer = _as_customer_payload(data if isinstance(data, dict) else {})
    if not customer or customer.get("found") is False or customer.get("exists") is False:
        raise HTTPException(status_code=404, detail="Iframe customer not found.")
    return customer


async def _get_or_create_iframe_user(
    session: AsyncSession,
    site_domain: str,
    customer_key: str,
    crm_payload: dict[str, Any],
) -> UserModel:
    customer_hash = IframeCustomer.hash_secret(customer_key)[:16]
    subject = _crm_value(crm_payload, "supabase_id", "user_id", "id", "customer_id", "customer_api_key")
    supabase_id = f"iframe:{site_domain}:{subject or customer_hash}"

    existing = await UserModel.get_by_supabase_id(session, supabase_id)
    if existing:
        existing.email = _crm_value(crm_payload, "email", "user_email") or existing.email
        existing.full_name = _crm_value(crm_payload, "full_name", "name", "customer_name") or existing.full_name
        plan = _crm_value(crm_payload, "plan", "tier")
        if plan in {"free", "pro", "team"}:
            existing.plan = plan
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        return existing

    email = _crm_value(crm_payload, "email", "user_email")
    if not email:
        email = f"{customer_hash}@{site_domain.replace('.', '-')}.iframe.local"
    plan = _crm_value(crm_payload, "plan", "tier")
    if plan not in {"free", "pro", "team"}:
        plan = "free"

    user = UserModel(
        supabase_id=supabase_id,
        email=str(email).lower(),
        full_name=_crm_value(crm_payload, "full_name", "name", "customer_name") or site_domain,
        storage_region=_crm_value(crm_payload, "storage_region", "region") or "eu",
        plan=plan,
        terms_accepted_at=datetime.now(timezone.utc),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


def _user_payload(user: UserModel) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "storage_region": user.storage_region,
        "plan": user.plan,
        "is_admin": user.is_admin,
    }


@IFRAME_ROUTER.post("/validate")
async def validate_iframe_customer(
    body: IframeValidateRequest,
    session: AsyncSession = Depends(get_async_session),
):
    site_domain = _clean_domain(body.site_domain)
    api_key = body.api_key.strip()
    customer_key = body.customer_key.strip()
    customer_api_key = (body.customer_api_key or "").strip()

    iframe_customer = await IframeCustomer.get_active(
        session,
        site_domain=site_domain,
        api_key=api_key,
        customer_key=customer_key,
    )

    if iframe_customer:
        user = await session.get(UserModel, iframe_customer.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Iframe customer user not found.")
        iframe_customer.last_seen_at = datetime.now(timezone.utc)
        session.add(iframe_customer)
        await session.commit()
    else:
        crm_payload = await _lookup_crm(
            IframeValidateRequest(
                site_domain=site_domain,
                api_key=api_key,
                customer_key=customer_key,
                domain=body.domain,
                customer_api_key=customer_api_key or None,
            )
        )
        user = await _get_or_create_iframe_user(session, site_domain, customer_key, crm_payload)
        now = datetime.now(timezone.utc)
        iframe_customer = IframeCustomer(
            site_domain=site_domain,
            api_key_hash=IframeCustomer.hash_secret(api_key),
            customer_key_hash=IframeCustomer.hash_secret(customer_key),
            customer_api_key_hash=IframeCustomer.hash_secret(customer_api_key) if customer_api_key else None,
            customer_api_key_encrypted=encrypt_value(customer_api_key) if customer_api_key else None,
            crm_customer_id=_crm_value(crm_payload, "customer_id", "id"),
            user_id=user.id,
            crm_payload=crm_payload,
            created_at=now,
            updated_at=now,
            last_seen_at=now,
        )
        session.add(iframe_customer)
        await session.commit()
        await session.refresh(iframe_customer)

    return {
        "access_token": _create_access_token(user),
        "user": _user_payload(user),
        "iframe": {
            "site_domain": iframe_customer.site_domain,
            "customer_id": iframe_customer.crm_customer_id,
        },
    }
