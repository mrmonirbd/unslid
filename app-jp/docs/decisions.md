# Architectural Decision Log

This file records significant architectural decisions — what was decided, why, and what alternatives were considered. New team members should read this before asking "why is it done this way?".

---

## Decision 1 — Base codebase: Presenton (open source)

**Date:** March 2026
**Decision:** Fork and extend [Presenton](https://github.com/presenton/presenton) (Apache 2.0) rather than build from scratch.
**Why:** The core AI presentation generation engine, slide editor UI, PPTX/PDF export pipeline, and multi-LLM support are all complete and production-quality. Building these from scratch would take 6+ months. Presenton gives us this for free under a license that permits commercial use and modification.
**Trade-off:** We inherit the original codebase structure and must work within it when adding SaaS features.

---

## Decision 2 — Auth: Supabase Auth (not fastapi-users or Clerk)

**Date:** March 2026
**Decision:** Use Supabase Auth for user authentication.
**Why:**
- Provides hosted PostgreSQL alongside auth — one less service to manage
- Open source and self-hostable if needed in future
- Next.js SDK (`@supabase/ssr`) is excellent
- JWT validation in FastAPI via JWKS endpoint requires no secret sharing
- Faster to implement than building from scratch with `fastapi-users`
- Cheaper and more controllable than Clerk for long-term
**Alternatives considered:** Clerk (rejected: third-party dependency, higher cost at scale), fastapi-users (rejected: more implementation time)

---

## Decision 3 — File storage: Wasabi S3 (not AWS S3)

**Date:** March 2026
**Decision:** Use Wasabi as the S3-compatible file storage provider.
**Why:**
- S3-compatible API — `boto3`/`aioboto3` works identically
- No egress fees (AWS S3 charges per GB downloaded — significant at scale)
- ~80% cheaper than AWS S3 for storage
- Supports all required regions including EU (GDPR compliant)
**Migration path:** If AWS S3 is ever needed, the `storage_service.py` abstraction layer means only the endpoint URL and credentials change — no code refactoring.

---

## Decision 4 — Geo-distributed storage regions (GDPR compliance)

**Date:** March 2026
**Decision:** Assign each user a permanent storage region at signup based on their IP country.
**Why:**
- GDPR legally requires EU user data to remain within the EU
- Proximity to storage improves upload/download performance
- Region is disclosed to user and acknowledged before account creation (transparency requirement)
**Implementation:** `CF-IPCountry` header (Cloudflare) maps to region code stored on `user.storage_region`. EU users are hard-blocked from selecting non-EU buckets server-side.

---

## Decision 5 — Async job queue: ARQ + Redis (not Celery)

**Date:** March 2026
**Decision:** Use ARQ (async Redis queue) for background job processing.
**Why:**
- `redis` was already in Presenton's dependencies
- ARQ is async-native (works naturally with FastAPI's async architecture)
- Simpler than Celery for this use case — no separate broker configuration
- Presentation generation can take 30–90 seconds — must not block HTTP connections
**Alternative considered:** Celery (rejected: more complex setup, synchronous by default)

---

## Decision 6 — Containerisation: Docker Compose (not bare metal)

**Date:** March 2026
**Decision:** Run all services in Docker Compose on Linode VPS.
**Why:**
- Presenton requires system dependencies (LibreOffice, Chromium) that are painful to manage on bare metal
- Docker provides identical environments across dev, staging, production
- Docker Compose → ECS Fargate migration is straightforward (1:1 container mapping)
- Easy rollbacks via image tags
**Migration path:** When moving to AWS, each Docker Compose service becomes an ECS task definition.

---

## Decision 7 — Separate containers per service (not monolithic Docker)

**Date:** March 2026
**Decision:** Run Next.js, FastAPI, Worker, and Redis in separate containers (not bundled in one).
**Why:**
- Original Presenton runs everything in one container (design choice for desktop/self-hosted use)
- For SaaS: services need to scale independently (e.g. run 3 worker containers during peak load without scaling the web frontend)
- Separate containers = separate resource limits, separate crash isolation, separate logs
- Worker (AI generation) is CPU/memory heavy — must not compete with API container

---

## Decision 8 — Traefik as reverse proxy (not Nginx)

**Date:** March 2026
**Decision:** Use Traefik for local development reverse proxy instead of the original Nginx.
**Why:**
- Traefik automatically handles SSL certificates via Let's Encrypt (zero manual config)
- Docker-native: reads container labels to configure routing automatically
- When containers are added, routing configures itself — no manual Nginx config edits
- Nginx is used in production behind a cloud load balancer
**Note:** The original Presenton `nginx.conf` is preserved for reference but not used in the SaaS setup.

---

## Decision 9 — Teams/Orgs included in v1 (not deferred)

**Date:** March 2026
**Decision:** Include multi-tenant organisation support in the first version.
**Why:** Adding org/team models after the fact requires migrating all existing user data. Building the data model correctly from the start (with `org_id` on all entities) costs little extra effort upfront but saves significant refactoring later.

---

## Decision 10 — Desktop sync deferred to post-launch

**Date:** March 2026
**Decision:** The Electron desktop app cloud sync feature is planned but not built in v1.
**Why:** Core SaaS must be stable and generating revenue before adding sync complexity. Sync requires additional API endpoints, conflict resolution logic, and thorough testing across offline/online state transitions.
