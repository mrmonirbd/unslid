# System Architecture

## Overview

```
Browser → Traefik (reverse proxy + SSL)
            ├── app.domain.com  → Next.js container (port 3000)
            └── api.domain.com  → FastAPI container (port 8000)

FastAPI → Redis (job queue)
        → ARQ Worker container (processes AI generation jobs)
        → Supabase PostgreSQL (user data, presentations, orgs)
        → Wasabi S3 (geo-distributed file storage)

All containers managed by Docker Compose (local) → ECS Fargate (AWS, future)
```

## Services

### Next.js (Frontend)
- **Port:** 3000
- **Framework:** Next.js 14 App Router (TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **State:** Redux
- **Auth:** Supabase SSR (`@supabase/ssr`) — JWT stored in httpOnly cookies
- **Route protection:** `middleware.ts` at the root redirects all unauthenticated requests to `/login`
- **Public routes:** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/s/[token]` (shared presentations)

### FastAPI (Backend API)
- **Port:** 8000
- **Framework:** FastAPI (Python 3.11)
- **ORM:** SQLModel + Alembic migrations
- **Auth validation:** Validates Supabase JWTs via JWKS endpoint — no shared secret needed
- **CORS:** Restricted to `APP_DOMAIN` only (not wildcard)
- **API versioning:** All routes under `/api/v1/`

### ARQ Worker
- **Same Docker image as FastAPI** — different startup command
- Processes long-running jobs: AI generation, PPTX export, PDF export
- Reads from Redis queue, writes results back to PostgreSQL + S3
- Prevents HTTP timeouts on expensive AI operations

### Redis
- **Image:** redis:7-alpine
- **Uses:** Job queue (ARQ), rate limiting per user, session caching
- **Local:** runs in Docker
- **Production:** AWS ElastiCache or Upstash Redis

### Supabase (Auth + Database)
- **Auth:** Manages user sessions, email/password, Google OAuth
- **Database:** PostgreSQL — hosted by Supabase, connected via `DATABASE_URL`
- **Migrations:** Alembic manages schema changes (not Supabase's built-in migrations)

### Wasabi S3 (File Storage)
- S3-compatible object storage — drop-in for AWS S3 with lower cost and no egress fees
- **Geo-distributed:** one bucket per region for GDPR compliance and performance
- Files served via pre-signed URLs (private buckets) or CDN (future)

## Storage Region Routing

At signup, user's country is detected from `CF-IPCountry` header (Cloudflare) or IP lookup.
Country maps to a storage region, stored permanently on `user.storage_region`.

| Region code | Countries | Wasabi bucket env var |
|---|---|---|
| `eu` | All EU + UK, CH, NO | `WASABI_BUCKET_EU` |
| `us` | US, CA, MX, LATAM | `WASABI_BUCKET_US` |
| `ap-se` | SG, MY, IN, AU, NZ, PH | `WASABI_BUCKET_AP_SE` |
| `ap-ne` | JP, KR, TW, HK | `WASABI_BUCKET_AP_NE` |
| `dev` | Local development | `WASABI_BUCKET_DEV` |

**GDPR rule:** EU users are hard-blocked from selecting non-EU buckets (enforced server-side).

## Authentication Flow

```
1. User visits app.domain.com
2. Next.js middleware.ts checks for Supabase session cookie
3. No session → redirect to /login
4. User logs in → Supabase issues JWT (stored in httpOnly cookie)
5. Next.js sends API requests with JWT in Authorization header
6. FastAPI validates JWT against Supabase JWKS endpoint
7. FastAPI extracts user_id from JWT → loads user from PostgreSQL
```

## Async Job Flow (Presentation Generation)

```
1. User clicks "Generate" → POST /api/v1/ppt/presentation/generate
2. FastAPI checks: user authenticated? plan allows it? concurrency limit not hit?
3. FastAPI enqueues job in Redis → returns {job_id} immediately (no waiting)
4. Frontend polls GET /api/v1/jobs/{job_id} every 2 seconds
5. ARQ Worker picks up job → runs AI generation pipeline
6. Worker updates job status in PostgreSQL (queued → processing → complete/failed)
7. Worker uploads generated files to user's Wasabi S3 bucket
8. Frontend detects "complete" → redirects to presentation editor
```

## Data Ownership

Every piece of data is scoped to either a user or an organisation:

- `presentation.user_id` + `presentation.org_id`
- `file.user_id` + `file.org_id`
- Users belong to organisations via `OrgMember`
- Org members can see all org-owned presentations based on their role

## Production Deployment (Linode → AWS migration path)

| Component | Linode (now) | AWS (future) |
|---|---|---|
| App containers | Docker Compose on VPS | ECS Fargate tasks |
| Reverse proxy | Traefik + Let's Encrypt | ALB + ACM certificates |
| Redis | Docker container | ElastiCache |
| PostgreSQL | Supabase cloud | Supabase cloud or RDS |
| File storage | Wasabi S3 | Wasabi S3 (unchanged) |
| SSL | Traefik auto | ACM |
