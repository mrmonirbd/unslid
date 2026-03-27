# Environment Variables Reference

All variables live in `.env` (copied from `.env.example`). Never commit `.env` to git.

## Core

| Variable | Required | Description |
|---|---|---|
| `ENVIRONMENT` | Yes | `development` or `production` |
| `APP_DOMAIN` | Yes | `localhost` locally, `app.yourdomain.com` in production |
| `API_DOMAIN` | Yes | `localhost` locally, `api.yourdomain.com` in production |

## Supabase

| Variable | Required | Where to find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase dashboard → Settings → API → service_role secret |
| `SUPABASE_JWT_SECRET` | Yes | Supabase dashboard → Settings → API → JWT secret |
| `DATABASE_URL` | Yes | Supabase dashboard → Settings → Database → URI (replace password) |

## Wasabi S3 Storage

| Variable | Required | Description |
|---|---|---|
| `WASABI_ACCESS_KEY_ID` | Yes | Wasabi account → Access Keys |
| `WASABI_SECRET_ACCESS_KEY` | Yes | Wasabi account → Access Keys |
| `WASABI_ENDPOINT_URL` | Yes | `https://s3.{region}.wasabisys.com` |
| `WASABI_BUCKET_DEV` | Yes | Bucket used in development (default: `aipresentation`) |
| `WASABI_BUCKET_EU` | Production | EU bucket — required for GDPR |
| `WASABI_BUCKET_US` | Production | US bucket |
| `WASABI_BUCKET_AP_SE` | Production | Asia Pacific SE bucket |
| `WASABI_BUCKET_AP_NE` | Production | Asia Pacific NE bucket |

## AI Providers (at least one required for generation to work)

| Variable | Description |
|---|---|
| `LLM` | Active LLM: `openai`, `google`, `anthropic`, `ollama`, `custom` |
| `IMAGE_PROVIDER` | Image source: `dall-e-3`, `gemini_flash`, `pexels`, `pixabay` |
| `OPENAI_API_KEY` | Required if `LLM=openai` or `IMAGE_PROVIDER=dall-e-3` |
| `OPENAI_MODEL` | Default: `gpt-4.1` |
| `GOOGLE_API_KEY` | Required if `LLM=google` or `IMAGE_PROVIDER=gemini_flash` |
| `GOOGLE_MODEL` | Default: `models/gemini-2.0-flash` |
| `ANTHROPIC_API_KEY` | Required if `LLM=anthropic` |
| `ANTHROPIC_MODEL` | Default: `claude-3-5-sonnet-20241022` |
| `PEXELS_API_KEY` | Required if `IMAGE_PROVIDER=pexels` (free, recommended) |

## Infrastructure (auto-set by Docker Compose — don't change for local dev)

| Variable | Value | Description |
|---|---|---|
| `REDIS_URL` | `redis://redis:6379` | Redis connection (Docker internal) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI base URL for Next.js |

## Billing (add when implementing billing phase)

| Variable | Where to find |
|---|---|
| `STRIPE_PUBLISHABLE_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Developers → Webhooks → signing secret |

## Email (add when implementing email phase)

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `EMAIL_FROM` | Sender address (must match verified domain in Resend) |

## Error Monitoring (add before production)

| Variable | Description |
|---|---|
| `SENTRY_DSN_FASTAPI` | Sentry → Projects → FastAPI project → DSN |
| `SENTRY_DSN_NEXTJS` | Sentry → Projects → Next.js project → DSN |
