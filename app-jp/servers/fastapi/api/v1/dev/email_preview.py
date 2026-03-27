"""
Email preview router — development only.
Renders every email template as HTML so you can inspect them in the browser.

Access via: http://localhost:8000/dev/email-preview
"""

import html as html_module

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from services.emails.email_service import (
    _base_template, _h1, _p, _button, _get_app_url,
)

EMAIL_PREVIEW_ROUTER = APIRouter(prefix="/dev", tags=["Dev"])


def _build_templates() -> list[tuple[str, str, str]]:
    """Return (slug, label, rendered_html) for every email template."""
    url = _get_app_url()
    templates: list[tuple[str, str, str]] = []

    # 1. Welcome
    body = (
        _h1("Welcome to Unslid, Alex!")
        + _p("Your account is ready. Start creating AI-powered presentations in seconds.")
        + _button(url, "Create your first presentation")
        + _p("If you have any questions, just reply to this email.")
    )
    templates.append(("welcome", "Welcome email", _base_template(body)))

    # 2. Monthly usage warning
    body = (
        _h1("You're approaching your monthly limit")
        + _p("Hi Alex, you've used <strong style='color:#1e293b'>8 of 10</strong> presentations "
             "this month on the <strong style='color:#1e293b'>Pro</strong> plan.")
        + _p("Upgrade to Pro for unlimited presentations and priority generation.")
        + _button(f"{url}/settings/billing", "Upgrade to Pro")
    )
    templates.append(("usage-warning", "Monthly usage warning", _base_template(body)))

    # 3. Team invite
    body = (
        _h1("You're invited to join Acme Corp")
        + _p("<strong style='color:#1e293b'>Jordan Lee</strong> has invited you to collaborate "
             "on <strong style='color:#1e293b'>Acme Corp</strong> on Unslid.")
        + _button(f"{url}/accept-invite/sample-token-abc123", "Accept invitation")
        + _p("This invitation link expires in 7 days. "
             "If you did not expect this invitation, you can ignore this email.")
    )
    templates.append(("team-invite", "Team invite", _base_template(body)))

    # 4. Payment receipt
    body = (
        _h1("Payment confirmed")
        + _p("Hi Alex, thank you for your payment. "
             "Your <strong style='color:#1e293b'>Pro</strong> plan is now active.")
        + """
        <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;">
          <tr style="background:#f1f5f9;">
            <td style="padding:12px 16px;color:#64748b;font-size:14px;">Plan</td>
            <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;text-align:right;">Pro</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:12px 16px;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Amount</td>
            <td style="padding:12px 16px;color:#1e293b;font-size:14px;font-weight:600;text-align:right;border-top:1px solid #e2e8f0;">$19.00</td>
          </tr>
        </table>
        """
        + _button(f"{url}/settings/billing", "Manage billing")
    )
    templates.append(("payment-receipt", "Payment receipt", _base_template(body)))

    # 5. Subscription cancelled
    body = (
        _h1("Subscription cancelled")
        + _p("Hi Alex, your subscription has been cancelled. "
             "You'll keep access to your current plan until the end of your billing period.")
        + _p("After that, your account will move to the free plan.")
        + _button(f"{url}/settings/billing", "Reactivate subscription")
    )
    templates.append(("subscription-cancelled", "Subscription cancelled", _base_template(body)))

    # 6. Payment failed
    body = (
        _h1("Payment failed")
        + _p("Hi Alex, we couldn't process your last payment. "
             "Please update your payment method to keep access to your current plan.")
        + _p("You have a 7-day grace period before your account is downgraded to the free plan.")
        + _button(f"{url}/settings/billing", "Update payment method")
    )
    templates.append(("payment-failed", "Payment failed", _base_template(body)))

    # 7. Invite accepted
    body = (
        _h1("Sam Rivera joined your team")
        + _p("Hi Alex, <strong style='color:#1e293b'>Sam Rivera</strong> has accepted your "
             "invitation and joined <strong style='color:#1e293b'>Acme Corp</strong>.")
        + _button(f"{url}/settings/team", "View team")
    )
    templates.append(("invite-accepted", "Invite accepted (owner notif.)", _base_template(body)))

    # 8. Member removed
    body = (
        _h1("You've been removed from a team")
        + _p("Hi Sam, you have been removed from "
             "<strong style='color:#1e293b'>Acme Corp</strong> on Unslid.")
        + _p("Your personal presentations are still available in your account. "
             "If you think this was a mistake, please contact the team owner.")
        + _button(url, "Go to your dashboard")
    )
    templates.append(("member-removed", "Member removed", _base_template(body)))

    # 9. Presentation viewed (share analytics)
    body = (
        _h1("Someone viewed your presentation")
        + _p("Your presentation <strong style='color:#1e293b'>Q3 Sales Strategy</strong> "
             "was just viewed from Germany.")
        + _button(f"{url}/settings/analytics", "View analytics")
    )
    templates.append(("share-viewed", "Presentation viewed (share)", _base_template(body)))

    # 10. Comment added
    body = (
        _h1("New comment on your presentation")
        + _p("<strong style='color:#1e293b'>Jamie Chen</strong> left a comment on slide 3 of "
             "<strong style='color:#1e293b'>Q3 Sales Strategy</strong>:")
        + """
        <blockquote style="margin:12px 0;padding:14px 18px;background:#f8fafc;
                           border-left:3px solid #6366f1;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:14px;color:#475569;font-style:italic;">
            "Can we update the revenue chart to include Q2 actuals?"
          </p>
        </blockquote>
        """
        + _button(f"{url}/dashboard", "Open presentation")
    )
    templates.append(("comment-added", "Comment added", _base_template(body)))

    # 11. Team at capacity
    body = (
        _h1("Your team is at full capacity")
        + _p("Hi Alex, <strong style='color:#1e293b'>Acme Corp</strong> has used all "
             "<strong style='color:#1e293b'>5 seats</strong>.")
        + _p("Add more seats to invite additional team members.")
        + _button(f"{url}/settings/team", "Manage seats")
    )
    templates.append(("team-full", "Team at capacity", _base_template(body)))

    # 12. Test email
    body = (
        _h1("Mailgun is working!")
        + _p("Hi Admin, this is a test email from your Unslid admin panel.")
        + _p("If you received this, your Mailgun configuration is correct.")
    )
    templates.append(("test", "Test email (admin panel)", _base_template(body)))

    return templates


def _render_page(templates: list[tuple[str, str, str]]) -> str:
    nav_items = "".join(
        f'<a href="#preview-{slug}" style="display:block;padding:8px 12px;border-radius:6px;'
        f'text-decoration:none;color:#475569;font-size:13px;font-weight:500;">'
        f'{label}</a>'
        for slug, label, _ in templates
    )

    sections = "".join(
        f"""
        <section id="preview-{slug}" style="margin-bottom:64px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;
                      padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
            <h2 style="margin:0;font-size:16px;font-weight:700;color:#1e293b;">{label}</h2>
            <code style="font-size:11px;background:#f1f5f9;color:#64748b;
                         padding:2px 8px;border-radius:4px;border:1px solid #e2e8f0;">{slug}</code>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;
                      box-shadow:0 1px 4px rgba(0,0,0,.06);">
            <iframe
              srcdoc="{html_module.escape(html_body)}"
              style="width:100%;height:480px;border:none;display:block;"
              title="Email preview: {label}"
            ></iframe>
          </div>
        </section>
        """
        for slug, label, html_body in templates
    )

    count = len(templates)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Email Preview — Unslid Dev</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            background:#f8fafc; color:#1e293b; }}
    aside a:hover {{ background:#f1f5f9 !important; }}
  </style>
</head>
<body>
  <div style="display:flex;min-height:100vh;">
    <aside style="width:230px;flex-shrink:0;background:#fff;border-right:1px solid #e2e8f0;
                  padding:24px 12px;position:sticky;top:0;height:100vh;overflow-y:auto;">
      <div style="padding:0 4px 20px;border-bottom:1px solid #e2e8f0;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:800;color:#1e1b4b;letter-spacing:-0.5px;">Unslid</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:2px;font-weight:600;
                    text-transform:uppercase;letter-spacing:.06em;">Email Previews</div>
      </div>
      <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;
                  letter-spacing:.08em;padding:0 8px;margin-bottom:6px;">Templates ({count})</div>
      {nav_items}
    </aside>

    <main style="flex:1;padding:40px 48px;max-width:960px;">
      <div style="margin-bottom:40px;">
        <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#1e293b;">Email Templates</h1>
        <p style="margin:0;color:#64748b;font-size:14px;">
          {count} templates &nbsp;·&nbsp; Dev-only &nbsp;·&nbsp;
          <span style="color:#f59e0b;font-weight:600;">
            Emails are suppressed in development (only logged to console)
          </span>
        </p>
      </div>
      {sections}
    </main>
  </div>
</body>
</html>"""


@EMAIL_PREVIEW_ROUTER.get("/email-preview", response_class=HTMLResponse, include_in_schema=False)
async def email_preview():
    """Render all email templates for visual review. Development only."""
    templates = _build_templates()
    return HTMLResponse(_render_page(templates))
