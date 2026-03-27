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
                &middot; このメールはUnslidアカウントをお持ちのため送信されました。
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
        {_h1("Mailgunが正常に動作しています！")}
        {_p(f"こんにちは{name}さん、これはUnslidの管理パネルからのテストメールです。")}
        {_p("このメールを受信された場合、Mailgunの設定が正しいことを確認しました。")}
    """
    return await _send_email(
        to, "Mailgunテスト — Unslid",
        _base_template(content), config=config
    )


async def send_welcome_email(to: str, name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1(f"Unslidへようこそ、{name}さん！")}
        {_p("アカウントの準備が整いました。今すぐAIを使ったプレゼンを作成しましょう。")}
        {_button(url, "最初のプレゼンを作成")}
        {_p("ご不明な点がございましたら、このメールにご返信ください。")}
    """
    return await _send_email(to, "Unslidへようこそ", _base_template(content))


async def send_usage_warning_email(
    to: str, name: str, current_count: int, limit: int, plan: str
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("月間利用上限に近づいています")}
        {_p(f"{name}さん、今月は<strong style='color:#1e293b'>{plan.title()}</strong>プランで<strong style='color:#1e293b'>{current_count}/{limit}</strong>プレゼンを使用しました。")}
        {_p("Proプランにアップグレードして、無制限のプレゼン作成と優先生成をお楽しみください。")}
        {_button(f"{url}/settings/billing", "Proにアップグレード")}
    """
    return await _send_email(
        to, "月間利用上限アラート — Unslid", _base_template(content)
    )


async def send_org_invite_email(
    to: str, inviter_name: str, org_name: str, invite_token: str
) -> bool:
    url = _get_app_url()
    invite_url = f"{url}/accept-invite/{invite_token}"
    content = f"""
        {_h1(f"{org_name}に招待されました")}
        {_p(f"<strong style='color:#1e293b'>{inviter_name}</strong>さんから<strong style='color:#1e293b'>{org_name}</strong>への共同作業の招待が届いています。")}
        {_button(invite_url, "招待を受け入れる")}
        {_p("この招待リンクは7日間有効です。心当たりのない場合は、このメールを無視してください。")}
    """
    return await _send_email(
        to,
        f"{inviter_name}さんから{org_name}への招待 — Unslid",
        _base_template(content),
    )


async def send_payment_receipt_email(
    to: str, name: str, plan: str, amount_cents: int, currency: str
) -> bool:
    url = _get_app_url()
    amount = f"{amount_cents / 100:.2f} {currency.upper()}"
    content = f"""
        {_h1("お支払いが確認されました")}
        {_p(f"{name}さん、お支払いありがとうございます。<strong style='color:#1e293b'>{plan.title()}</strong>プランが有効になりました。")}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;">
          <tr style="background:#f1f5f9;">
            <td style="padding:12px 16px;color:#64748b;font-size:14px;">プラン</td>
            <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">{plan.title()}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">金額</td>
            <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">{amount}</td>
          </tr>
        </table>
        {_button(f"{url}/settings/billing", "請求を管理")}
    """
    return await _send_email(
        to, "お支払い領収書 — Unslid", _base_template(content)
    )


async def send_subscription_cancelled_email(to: str, name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("サブスクリプションがキャンセルされました")}
        {_p(f"{name}さん、サブスクリプションがキャンセルされました。請求期間終了まで引き続きご利用いただけます。")}
        {_p("その後、アカウントは無料プランに移行します。")}
        {_button(f"{url}/settings/billing", "サブスクリプションを再開")}
    """
    return await _send_email(
        to, "サブスクリプションキャンセル — Unslid", _base_template(content)
    )


async def send_payment_failed_email(to: str, name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("お支払いに失敗しました")}
        {_p(f"{name}さん、最後のお支払いを処理できませんでした。現在のプランを継続するには、お支払い方法を更新してください。")}
        {_p("アカウントが無料プランにダウングレードされるまで7日間の猶予期間があります。")}
        {_button(f"{url}/settings/billing", "お支払い方法を更新")}
    """
    return await _send_email(
        to, "要対応：お支払い失敗 — Unslid", _base_template(content)
    )


async def send_invite_accepted_email(
    to: str, owner_name: str, member_name: str, org_name: str
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1(f"{member_name}がチームに参加しました")}
        {_p(f"{owner_name}さん、<strong style='color:#1e293b'>{member_name}</strong>さんが招待を受け入れ、<strong style='color:#1e293b'>{org_name}</strong>に参加しました。")}
        {_button(f"{url}/settings/team", "チームを表示")}
    """
    return await _send_email(
        to,
        f"{member_name}が{org_name}に参加しました — Unslid",
        _base_template(content),
    )


async def send_member_removed_email(to: str, member_name: str, org_name: str) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("チームから削除されました")}
        {_p(f"{member_name}さん、Unslid上の<strong style='color:#1e293b'>{org_name}</strong>から削除されました。")}
        {_p("個人のプレゼンは引き続きご利用いただけます。心当たりのない場合は、チームオーナーにお問い合わせください。")}
        {_button(url, "ダッシュボードに移動")}
    """
    return await _send_email(
        to,
        f"{org_name}から削除されました — Unslid",
        _base_template(content),
    )


async def notify_share_viewed(
    to: str,
    presentation_title: str,
    viewer_country: Optional[str] = None,
) -> bool:
    url = _get_app_url()
    country_info = f"（{viewer_country}から）" if viewer_country else ""
    content = f"""
        {_h1("プレゼンが閲覧されました")}
        {_p(f"あなたのプレゼン<strong style='color:#1e293b'>{presentation_title}</strong>が閲覧されました{country_info}。")}
        {_button(f"{url}/settings/analytics", "分析を表示")}
    """
    return await _send_email(
        to,
        f"新しい閲覧：{presentation_title} — Unslid",
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
        {_h1("プレゼンに新しいコメントがあります")}
        {_p(f"<strong style='color:#1e293b'>{commenter_name}</strong>さんが<strong style='color:#1e293b'>{presentation_title}</strong>のスライド{slide_number}にコメントしました：")}
        <blockquote style="margin:12px 0;padding:14px 18px;background:#f8fafc;border-left:3px solid #6366f1;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#475569;font-style:italic;">"{comment_preview}"</p>
        </blockquote>
        {_button(f"{url}/dashboard", "プレゼンを開く")}
    """
    return await _send_email(
        to,
        f"{presentation_title}に新しいコメント — Unslid",
        _base_template(content),
    )


async def send_seat_limit_warning_email(
    to: str, owner_name: str, org_name: str, seats_purchased: int
) -> bool:
    url = _get_app_url()
    content = f"""
        {_h1("チームの定員に達しました")}
        {_p(f"{owner_name}さん、<strong style='color:#1e293b'>{org_name}</strong>の全<strong style='color:#1e293b'>{seats_purchased}シート</strong>が使用されています。")}
        {_p("追加のチームメンバーを招待するには、シートを追加してください。")}
        {_button(f"{url}/settings/team", "シートを管理")}
    """
    return await _send_email(
        to,
        f"定員超過：{org_name}の全シートが使用されています — Unslid",
        _base_template(content),
    )
