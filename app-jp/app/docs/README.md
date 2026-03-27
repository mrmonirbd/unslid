# AI Presentation SaaS — Developer Documentation

Welcome to the project. This folder contains everything a new developer needs to understand, run, and contribute to the codebase.

## Quick Start (New Developer)

1. **Read this file first**, then read [`setup.md`](./setup.md) for step-by-step local setup
2. Read [`architecture.md`](./architecture.md) to understand how the system is structured
3. Read [`environment.md`](./environment.md) to understand every environment variable
4. Read [`decisions.md`](./decisions.md) to understand *why* things are built the way they are

## Documentation Index

| File | What it covers |
|---|---|
| [`setup.md`](./setup.md) | How to run the project locally from scratch |
| [`architecture.md`](./architecture.md) | System design, services, data flow diagrams |
| [`environment.md`](./environment.md) | All environment variables explained |
| [`database.md`](./database.md) | Database schema, models, migration guide |
| [`api.md`](./api.md) | API endpoint reference |
| [`deployment.md`](./deployment.md) | How to deploy to Linode and later AWS |
| [`decisions.md`](./decisions.md) | Architectural decision log (why things are done this way) |
| [`review/`](./review/) | Code review handoff files (completed-please-review, reviewed-please-update) |

## Project Overview

An AI-powered presentation SaaS built on top of the open-source [Presenton](https://github.com/presenton/presenton) codebase (Apache 2.0 license).

**What it does:** Users log in, generate AI-powered presentations from prompts or documents, edit slides, and export as PPTX or PDF.

**Tech stack at a glance:**
- Frontend: Next.js (TypeScript) + Tailwind CSS + shadcn/ui
- Backend: FastAPI (Python 3.11) + SQLModel + Alembic
- Auth: Supabase Auth
- Database: PostgreSQL (Supabase hosted)
- Storage: Wasabi S3 (geo-distributed buckets)
- Job queue: ARQ + Redis
- Reverse proxy: Traefik (local) → Nginx/ALB (production)
- Containerisation: Docker Compose
