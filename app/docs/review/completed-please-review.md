# Completed — Please Review

This file is updated by the builder agent when a phase is complete.
The reviewer agent reads this file and writes feedback to `reviewed-please-update.md`.

---

## Phase 4 — Frontend: Settings, Admin, Share Viewer + DB wiring

**Completed:** March 2026

### What was built

**Backend additions:**
- Added `user_id` + `org_id` columns to `PresentationModel` — with a safe `_run_safe_migrations()` function that adds missing columns at startup without losing data (works on both SQLite and PostgreSQL)
- Added `ApiKeyModel`, `PresentationShareModel` to the `create_db_and_tables()` call
- New `GET /api/v1/s/{token}` and `POST /api/v1/s/{token}/unlock` endpoints for unauthenticated share viewing
- Usage warning email (80% limit) triggered on job completion inside the ARQ worker

**Frontend — utilities:**
- `lib/api.ts` — typed authenticated API client (reads Supabase session token, attaches as Bearer)
- `app/hooks/useUser.ts` — `useUser()` hook + `signOut()` helper

**Frontend — DashboardSidebar (updated):**
- User avatar with initials at bottom of sidebar
- Plan badge (Free / Pro / Team) with correct color
- Dropdown menu: Account, Billing, Team, Admin (if is_admin), Sign Out
- "Upgrade to Pro" CTA in dropdown for free users
- Preserved `defaultNavItems` export used by `DashboardNav.tsx`

**Frontend — Settings pages:**
- `/settings/account` — profile name edit, storage region display, API key management (create/revoke, shows key once), GDPR account deletion with confirmation
- `/settings/billing` — current plan + usage progress bar, upgrade cards for Pro/Team (Stripe Checkout), Customer Portal link for paid users
- `/settings/team` — org list, create org, select org → view members, invite by email+role, remove member

**Frontend — Share viewer (`/s/[token]`):**
- Public page (no auth required) — fetches share metadata, shows slide list from `structure`
- Password-protected shares show a password gate first
- View count displayed in header

**Frontend — Admin (`/admin`):**
- Guards against non-admin users (redirects to `/dashboard`)
- Stats cards: total/active users, orgs, presentations
- Plan breakdown (Free/Pro/Team count)
- Users table: search, plan filter, inline plan change (select dropdown), deactivate/activate
- No sidebar — standalone admin layout

**Tests:**
- Python: 71 files, zero syntax errors
- TypeScript: zero errors (fixed `defaultNavItems` export regression)

### Files created/changed
- `servers/fastapi/models/sql/presentation.py` — added `user_id`, `org_id` FK columns
- `servers/fastapi/services/database.py` — added `_run_safe_migrations()`, new model tables
- `servers/fastapi/api/v1/account/share_viewer.py` — new
- `servers/fastapi/api/worker.py` — usage warning email on job completion
- `servers/fastapi/api/main.py` — added `SHARE_VIEWER_ROUTER`
- `servers/nextjs/lib/api.ts` — new
- `servers/nextjs/app/hooks/useUser.ts` — new
- `servers/nextjs/app/(presentation-generator)/(dashboard)/Components/DashboardSidebar.tsx` — rewritten
- `servers/nextjs/app/(presentation-generator)/(dashboard)/settings/account/page.tsx` — new
- `servers/nextjs/app/(presentation-generator)/(dashboard)/settings/billing/page.tsx` — new
- `servers/nextjs/app/(presentation-generator)/(dashboard)/settings/team/page.tsx` — new
- `servers/nextjs/app/s/[token]/page.tsx` — new
- `servers/nextjs/app/admin/page.tsx` — new

### Ready for first test run
The full SaaS is now structurally complete. To do the first end-to-end test:
1. `docker compose up` in the workspace root
2. Open http://localhost — should redirect to /login
3. Sign up → GDPR region page → email confirmation → redirect to /dashboard
4. Check sidebar: avatar, plan badge, dropdown with Account/Billing/Team
5. Go to /settings/account, /settings/billing, /settings/team
6. Test admin at /admin (first user needs `is_admin=true` set manually in Supabase)

---

## Phase 3 — Full SaaS backend + all features

**Completed:** March 2026

### What was built

**ARQ Async Worker (`api/worker.py`, `api/v1/jobs/router.py`, `utils/rate_limit.py`)**
- ARQ worker container with `WorkerSettings` — processes generation jobs, daily cleanup cron
- Job status API: `GET /api/v1/jobs/{task_id}`, `DELETE /api/v1/jobs/{task_id}`
- Redis rate limiter: per-user concurrent job limits (free=1, pro=3, team=5) + monthly presentation limits (free=5, paid=unlimited)

**Stripe Billing (`api/v1/billing/router.py`)**
- `POST /api/v1/billing/checkout` — creates Checkout session for plan upgrades
- `POST /api/v1/billing/portal` — Customer Portal for managing subscriptions
- `GET /api/v1/billing/status` — current plan, usage, and price IDs
- `POST /api/v1/webhooks/stripe` — verified webhook handler updating user plan on subscription changes

**Resend Emails (`services/emails/`)**
- `welcome`, `usage_warning`, `org_invite`, `payment_receipt`, `subscription_cancelled`
- In development: logs instead of sending. In production: calls Resend API
- Beautiful branded HTML template with consistent styling

**Account API (`api/v1/account/router.py`)**
- Profile CRUD: `GET /account/me`, `PUT /account/me`
- API keys (Pro+): list, create (key shown once), revoke
- Presentation sharing: create public or password-protected share links
- GDPR account deletion: purges all S3 files + soft-deletes user record
- GDPR data export: `GET /account/export` returns JSON with all user data

**Organizations (`api/v1/org/router.py`)**
- Create org, list user's orgs, get org details
- Invite member (email + role), accept invite via token
- List members, remove member (owner/admin only)

**Admin Panel (`api/v1/admin/router.py`)**
- `GET /admin/stats` — platform-wide: user counts by plan/region, org count, presentation count
- `GET /admin/users` — paginated list with search + plan filter
- `GET /admin/users/{id}` — full user details
- `PUT /admin/users/{id}/plan` — manually change plan
- `POST /admin/users/{id}/deactivate` / `activate` — account suspension
- `GET /admin/orgs` — list all organizations

**New SQL models**
- `ApiKeyModel` — hashed API keys with label + prefix shown in UI
- `PresentationShareModel` — share tokens with public/password modes

**Sentry**
- FastAPI: `sentry_sdk.init()` in `main.py` (skipped if `SENTRY_DSN` not set)
- Next.js: `instrumentation.ts` with `register()` hook (optional, try/catch)

**Tests run:**
- `python3 -c "ast.parse()"` on all 70 FastAPI Python files → ZERO errors
- `npx tsc --noEmit` on all Next.js files → ZERO errors
- Wasabi S3 live connectivity test → PASSED (connect, upload, download, delete)
- TypeScript type check → PASSED

### Files created/changed (this phase)
- `api/worker.py`
- `api/main.py` (updated — new routers, Sentry init, CORS lock)
- `api/v1/jobs/router.py`, `__init__.py`
- `api/v1/billing/router.py`, `__init__.py`
- `api/v1/account/router.py`, `__init__.py`
- `api/v1/org/router.py`, `__init__.py`
- `api/v1/admin/router.py`, `__init__.py`
- `models/sql/api_key.py`
- `models/sql/presentation_share.py`
- `services/database.py` (updated — 2 more tables)
- `services/emails/__init__.py`
- `services/emails/email_service.py`
- `utils/rate_limit.py`
- `servers/nextjs/instrumentation.ts`

### What's still needed before first user can sign up
1. Connect `generate_presentation_job` in worker to actual generation logic
2. Add `user_id` column to existing `PresentationModel` so presentations are owned by users
3. Add Stripe price IDs to `.env` (they're blank — billing won't work until filled)
4. Build Next.js frontend pages for: Settings, Billing, Team/Org, Admin dashboard, Share viewer (`/s/[token]`)
5. Wire up usage warning emails to be triggered at 80% of monthly limit

---

## Phase 2 — Supabase Auth + DB models

**Completed:** March 2026

### What was done

1. Installed `@supabase/supabase-js` and `@supabase/ssr` in Next.js
2. Created Supabase client utilities:
   - `lib/supabase/client.ts` — browser client
   - `lib/supabase/server.ts` — server-side client (for server components)
3. Created `middleware.ts` at Next.js root — protects all routes, redirects unauthenticated users to `/login`
4. Created auth pages:
   - `/login` — email/password, Google OAuth button (disabled, coming soon)
   - `/signup` — 2-step: account details → GDPR region disclosure with acknowledgment checkbox
   - `/forgot-password` — sends reset email via Supabase
   - `/reset-password` — updates password after email link
5. Created `app/api/auth/callback/route.ts` — handles OAuth code exchange
6. Created FastAPI `api/auth.py` — JWT validation dependency using Supabase JWT secret; auto-provisions user record on first authenticated request
7. Created new SQLModel tables: `UserModel`, `OrganizationModel`, `OrgMemberModel`, `OrgInvitationModel`
8. Updated `services/database.py` to create new tables on startup
9. Tightened FastAPI CORS — locked to `APP_DOMAIN` only (not wildcard `*`)
10. Removed Presenton branding from `layout.tsx`
11. TypeScript check: 0 errors. Python syntax check: 0 errors.

### Files changed
- `servers/nextjs/lib/supabase/client.ts` — new
- `servers/nextjs/lib/supabase/server.ts` — new
- `servers/nextjs/middleware.ts` — new
- `servers/nextjs/app/(auth)/layout.tsx` — new
- `servers/nextjs/app/(auth)/login/page.tsx` — new
- `servers/nextjs/app/(auth)/signup/page.tsx` — new
- `servers/nextjs/app/(auth)/forgot-password/page.tsx` — new
- `servers/nextjs/app/(auth)/reset-password/page.tsx` — new
- `servers/nextjs/app/api/auth/callback/route.ts` — new
- `servers/nextjs/app/layout.tsx` — updated (metadata)
- `servers/fastapi/api/auth.py` — new
- `servers/fastapi/api/main.py` — updated (CORS)
- `servers/fastapi/models/sql/user.py` — new
- `servers/fastapi/models/sql/organization.py` — new
- `servers/fastapi/models/sql/org_member.py` — new
- `servers/fastapi/services/database.py` — updated (new tables)

### Next phase
Wasabi S3 geo-routing `storage_service.py` — replace all local disk file references.

---

## Phase 1a — Project scaffold and infrastructure setup

**Completed:** March 2026
**Built by:** Builder agent

### What was done

1. Cloned Presenton open-source repo as the base codebase
2. Replaced monolithic `docker-compose.yml` with separate service containers:
   - `traefik` — reverse proxy + SSL
   - `nextjs` — frontend (port 3000)
   - `fastapi` — backend API (port 8000)
   - `worker` — ARQ async job processor (same image as fastapi, different command)
   - `redis` — job queue and rate limiting
3. Created individual Dockerfiles:
   - `servers/nextjs/Dockerfile` — multi-stage Next.js build
   - `servers/fastapi/Dockerfile` — Python 3.11 with LibreOffice, Chromium, all deps
4. Created `.env.example` with all variables documented
5. Created `docs/` folder with:
   - `README.md` — developer entry point
   - `setup.md` — local dev instructions
   - `architecture.md` — system design and data flows
   - `environment.md` — all env vars explained
   - `decisions.md` — architectural decision log
   - `review/` — this handoff folder

### Files changed

- `docker-compose.yml` — rewritten
- `servers/nextjs/Dockerfile` — new
- `servers/fastapi/Dockerfile` — new
- `.env.example` — new
- `docs/` — all new

### Known issues / things to verify

- The `servers/nextjs/Dockerfile` uses `standalone` output mode — `next.config.mjs` needs `output: 'standalone'` added
- The worker command `python -m arq api.worker.WorkerSettings` references `api/worker.py` which doesn't exist yet — needs to be created in next phase
- FastAPI Dockerfile installs all packages via `pip` — should be migrated to use `uv` from `pyproject.toml` for consistency
- `.python-version` file in `servers/fastapi/` pins Python 3.11 — Dockerfile matches this

### Next phase

Supabase Auth integration — Next.js middleware route protection, login/signup pages, FastAPI JWT validation.
