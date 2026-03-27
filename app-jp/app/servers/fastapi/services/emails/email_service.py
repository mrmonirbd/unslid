"""
Transactional email service using Mailgun.

Configuration is stored in the database (admin → Email Settings).
The API key is encrypted at rest using Fernet (SECRET_KEY env var).

In development (ENVIRONMENT=development) emails are logged but NOT sent.
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
APP_DOMAIN = os.getenv("APP_DOMAIN", "localhost")

# Mailgun base URLs
_MG_US_URL = "https://api.mailgun.net/v3"
_MG_EU_URL = "https://api.eu.mailgun.net/v3"


def _get_app_url() -> str:
    if ENVIRONMENT == "development":
        return "http://localhost:3000"
    return f"https://{APP_DOMAIN}"


async def _load_mailgun_config() -> dict:
    """Load Mailgun credentials from the database (live, no cache)."""
    try:
        from services.database import async_session_maker
        from api.v1.admin.router import get_mailgun_secrets
        async with async_session_maker() as session:
            return await get_mailgun_secrets(session)
    except Exception as exc:
        logger.warning("Could not load Mailgun config from DB: %s", exc)
        return {}


async def _send_email(to: str, subject: str, html: str, config: Optional[dict] = None) -> bool:
    """
    Send an email via Mailgun.
    `config` can be pre-loaded to avoid a redundant DB round-trip when sending
    multiple emails in one request.
    """
    cfg = config or await _load_mailgun_config()
    api_key = cfg.get("api_key", "")
    domain = cfg.get("domain", "")
    from_email = cfg.get("from_email", f"noreply@{domain}") if domain else ""
    from_name = cfg.get("from_name", "Unslid")
    region = cfg.get("region", "us")

    if not api_key or not domain:
        logger.warning(
            "Mailgun not configured — skipping email to %s: %s. "
            "Configure it in Admin → Email Settings.",
            to, subject,
        )
        return False

    if ENVIRONMENT == "development":
        logger.info(
            "[DEV] Email suppressed (set ENVIRONMENT=production to send)\n"
            "  To: %s\n  Subject: %s", to, subject
        )
        return True

    base_url = _MG_EU_URL if region == "eu" else _MG_US_URL
    url = f"{base_url}/{domain}/messages"
    sender = f"{from_name} <{from_email}>"

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                auth=("api", api_key),
                data={"from": sender, "to": to, "subject": subject, "html": html},
                timeout=15,
            )
        if resp.status_code in (200, 201):
            logger.info("Email sent to %s: %s", to, subject)
            return True
        else:
            logger.error("Mailgun error %s: %s", resp.status_code, resp.text)
            return False
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


# ─── Email HTML Template ──────────────────────────────────────────────────────

def _base_template(content: str, app_url: Optional[str] = None) -> str:
    url = app_url or _get_app_url()
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 40px 24px;border-bottom:1px solid #e2e8f0;background:#1e1b4b;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Unslid</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              {content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Unslid &middot;
                <a href="{url}" style="color:#6366f1;text-decoration:none;">unslid.com</a>
                &middot; You received this email because you have an account with us.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _button(url: str, text: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;padding:13px 28px;'
        f'background:#4f46e5;color:#ffffff;font-weight:600;font-size:14px;'
        f'text-decoration:none;border-radius:8px;margin:16px 0;">{text}</a>'
    )


def _h1(text: str) -> str:
    return f'<h1 style="margin:0 0 10px;font-size:24px;font-weight:700;color:#1e293b;">{text}</h1>'


def _p(text: str) -> str:
    return f'<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#475569;">{text}</p>'


# ─── Individual Email Functions ───────────────────────────────────────────────

async def send_test_email(to: str, name: str, config: dict) -> bool:
    """Send a test email to verify Mailgun is working. Uses pre-loaded config."""
    content = f"""
        {_h1("Mailgun is working!")}
        {_p(f"Hi {name}, this is a test email from your Unslid admin panel.")}
        {_p("If you received this, your Mailgun configuration is correct.")}
    """
    return await _send_email(
        to, "Mailgun test — Unslid",
        _base_template(content), config=config
    )


async def send_welcome_email(to: str, name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1(f"Welcome to Unslid, {name}!")}
        {_p("Your account is ready. Start creating AI-powered presentations in seconds.")}
        {_button(url, "Create your first presentation")}
        {_p("If you have any questions, just reply to this email.")}
    """
    return await _send_email(to, "Welcome to Unslid", _base_template(content))


async def send_usage_warning_email(
    to: str, name: str, current_count: int, limit: int, plan: str
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("You're approaching your monthly limit")}
        {_p(f"Hi {name}, you've used <strong style='color:#1e293b'>{current_count} of {limit}</strong> presentations this month on the <strong style='color:#1e293b'>{plan.title()}</strong> plan.")}
        {_p("Upgrade to Pro for unlimited presentations and priority generation.")}
        {_button(f"{url}/settings/billing", "Upgrade to Pro")}
    """
    return await _send_email(
        to, "Monthly limit alert — Unslid", _base_template(content)
    )


async def send_org_invite_email(
    to: str, inviter_name: str, org_name: str, invite_token: str
) -> bool:
    url = _get_app_url()
    invite_url = f"{url}/accept-invite/{invite_token}"
    content = f"""
        {_h1(f"You're invited to join {org_name}")}
        {_p(f"<strong style='color:#1e293b'>{inviter_name}</strong> has invited you to collaborate on <strong style='color:#1e293b'>{org_name}</strong> on Unslid.")}
        {_button(invite_url, "Accept invitation")}
        {_p("This invitation link expires in 7 days. If you did not expect this invitation, you can ignore this email.")}
    """
    return await _send_email(
        to,
        f"{inviter_name} invited you to {org_name} — Unslid",
        _base_template(content),
    )


async def send_payment_receipt_email(
    to: str, name: str, plan: str, amount_cents: int, currency: str
) -> bool:
    url = _get_app_url()
    amount = f"{amount_cents / 100:.2f} {currency.upper()}"
    content = f"""
        {_h1("Payment confirmed")}
        {_p(f"Hi {name}, thank you for your payment. Your <strong style='color:#1e293b'>{plan.title()}</strong> plan is now active.")}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;">
          <tr style="background:#f1f5f9;">
            <td style="padding:12px 16px;color:#64748b;font-size:14px;">Plan</td>
            <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">{plan.title()}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Amount</td>
            <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">{amount}</td>
          </tr>
        </table>
        {_button(f"{url}/settings/billing", "Manage billing")}
    """
    return await _send_email(
        to, "Payment receipt — Unslid", _base_template(content)
    )


async def send_subscription_cancelled_email(to: str, name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("Subscription cancelled")}
        {_p(f"Hi {name}, your subscription has been cancelled. You'll keep access to your current plan until the end of your billing period.")}
        {_p("After that, your account will move to the free plan.")}
        {_button(f"{url}/settings/billing", "Reactivate subscription")}
    """
    return await _send_email(
        to, "Subscription cancelled — Unslid", _base_template(content)
    )


async def send_payment_failed_email(to: str, name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("Payment failed")}
        {_p(f"Hi {name}, we couldn't process your last payment. Please update your payment method to keep access to your current plan.")}
        {_p("You have a 7-day grace period before your account is downgraded to the free plan.")}
        {_button(f"{url}/settings/billing", "Update payment method")}
    """
    return await _send_email(
        to, "Action required: payment failed — Unslid", _base_template(content)
    )


async def send_invite_accepted_email(
    to: str, owner_name: str, member_name: str, org_name: str
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1(f"{member_name} joined your team")}
        {_p(f"Hi {owner_name}, <strong style='color:#1e293b'>{member_name}</strong> has accepted your invitation and joined <strong style='color:#1e293b'>{org_name}</strong>.")}
        {_button(f"{url}/settings/team", "View team")}
    """
    return await _send_email(
        to,
        f"{member_name} joined {org_name} — Unslid",
        _base_template(content),
    )


async def send_member_removed_email(to: str, member_name: str, org_name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("You've been removed from a team")}
        {_p(f"Hi {member_name}, you have been removed from <strong style='color:#1e293b'>{org_name}</strong> on Unslid.")}
        {_p("Your personal presentations are still available in your account. If you think this was a mistake, please contact the team owner.")}
        {_button(url, "Go to your dashboard")}
    """
    return await _send_email(
        to,
        f"You've been removed from {org_name} — Unslid",
        _base_template(content),
    )


async def notify_share_viewed(
    to: str,
    presentation_title: str,
    viewer_country: Optional[str] = None,
) -> bool:
    url = _get_app_url()
    country_info = f" from {viewer_country}" if viewer_country else ""
    content = f"""
        {_h1("Someone viewed your presentation")}
        {_p(f"Your presentation <strong style='color:#1e293b'>{presentation_title}</strong> was just viewed{country_info}.")}
        {_button(f"{url}/settings/analytics", "View analytics")}
    """
    return await _send_email(
        to,
        f"New view: {presentation_title} — Unslid",
        _base_template(content),
    )


async def notify_comment_added(
    to: str,
    presentation_title: str,
    commenter_name: str,
    comment_preview: str,
    slide_number: int,
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("New comment on your presentation")}
        {_p(f"<strong style='color:#1e293b'>{commenter_name}</strong> left a comment on slide {slide_number} of <strong style='color:#1e293b'>{presentation_title}</strong>:")}
        <blockquote style="margin:12px 0;padding:14px 18px;background:#f8fafc;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#475569;font-style:italic;">"{comment_preview}"</p>
        </blockquote>
        {_button(f"{url}/dashboard", "Open presentation")}
    """
    return await _send_email(
        to,
        f"New comment on {presentation_title} — Unslid",
        _base_template(content),
    )


async def send_seat_limit_warning_email(
    to: str, owner_name: str, org_name: str, seats_purchased: int
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("Your team is at full capacity")}
        {_p(f"Hi {owner_name}, <strong style='color:#1e293b'>{org_name}</strong> has used all <strong style='color:#1e293b'>{seats_purchased} seats</strong>.")}
        {_p("Add more seats to invite additional team members.")}
        {_button(f"{url}/settings/team", "Manage seats")}
    """
    return await _send_email(
        to,
        f"Team full: {org_name} has used all seats — Unslid",
        _base_template(content),
    )
