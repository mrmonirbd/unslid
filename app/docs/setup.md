# Local Development Setup

## Prerequisites

Make sure you have these installed on your machine:

- **Git** — `git --version` (comes with macOS Xcode Command Line Tools)
- **Docker Desktop** — download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)

Verify Docker is running:
```bash
docker --version
docker compose version
```

## Step 1 — Clone the Repository

```bash
git clone https://github.com/your-org/aipresentation.git
cd aipresentation
```

## Step 2 — Create Your .env File

```bash
cp .env.example .env
```

Open `.env` and fill in the following required values (see [`environment.md`](./environment.md) for details on each):

**Required to start:**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase dashboard → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Settings → API
- `SUPABASE_JWT_SECRET` — from Supabase dashboard → Settings → API
- `DATABASE_URL` — from Supabase dashboard → Settings → Database → URI
- `WASABI_ACCESS_KEY_ID` — from your Wasabi account
- `WASABI_SECRET_ACCESS_KEY` — from your Wasabi account

**Optional (app works without these, but AI generation won't work):**
- `LLM` and the corresponding AI provider key

## Step 3 — Start the Services

```bash
docker compose up --build
```

First run takes 5–10 minutes as Docker builds the images. Subsequent starts are fast.

## Step 4 — Access the App

| Service | URL |
|---|---|
| App (Next.js) | http://localhost |
| API (FastAPI) | http://localhost/api/v1 |
| API Docs (Swagger) | http://localhost/docs |
| Traefik Dashboard | http://localhost:8080 |

## Day-to-Day Development (Without Docker)

For faster iteration during frontend development:

```bash
# Terminal 1 — Run Next.js directly
cd servers/nextjs
npm install
npm run dev
# Runs on http://localhost:3000

# Terminal 2 — Run FastAPI directly
cd servers/fastapi
pip install uv
uv sync
python server.py --port 8000 --reload true
# Runs on http://localhost:8000

# Terminal 3 — Run Redis
docker run -p 6379:6379 redis:7-alpine

# Terminal 4 — Run ARQ worker
cd servers/fastapi
python -m arq api.worker.WorkerSettings
```

## Running Database Migrations

Migrations run automatically on startup. To run manually:

```bash
docker compose exec fastapi python migrations.py
```

## Stopping the Services

```bash
docker compose down        # stop containers
docker compose down -v     # stop + delete volumes (fresh database)
```

## Troubleshooting

**Port 80 already in use:**
```bash
sudo lsof -i :80           # find what's using port 80
```
Or change the port in `docker-compose.yml` from `80:80` to `8888:80`.

**Database connection errors:**
Check your `DATABASE_URL` in `.env` — make sure the password is correct and the Supabase project is active.

**Docker build fails:**
```bash
docker compose build --no-cache   # force full rebuild
```
