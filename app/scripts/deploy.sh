#!/bin/bash
# ============================================================
#  deploy.sh — Deploy / update the app on the Linode VPS
#  Run from the project root: bash scripts/deploy.sh
# ============================================================
set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Presentation — Production Deploy"
echo "  $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check .env exists
if [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Copy .env.production.example → .env and fill in all values."
  exit 1
fi

# Check MySQL passwords are not missing/default placeholders
MYSQL_ROOT_PASS=$(grep "^MYSQL_ROOT_PASSWORD=" .env | cut -d= -f2- || true)
MYSQL_PASS=$(grep "^MYSQL_PASSWORD=" .env | cut -d= -f2- || true)
if [ "$MYSQL_ROOT_PASS" = "localdevpass" ] || [ "$MYSQL_ROOT_PASS" = "CHANGE_ME_STRONG_ROOT_PASSWORD" ] || [ -z "$MYSQL_ROOT_PASS" ]; then
  echo "ERROR: MYSQL_ROOT_PASSWORD is missing or still a default placeholder. Set a strong password in .env before deploying."
  exit 1
fi
if [ "$MYSQL_PASS" = "localdevpass" ] || [ "$MYSQL_PASS" = "CHANGE_ME_STRONG_APP_PASSWORD" ] || [ -z "$MYSQL_PASS" ]; then
  echo "ERROR: MYSQL_PASSWORD is missing or still a default placeholder. Set a strong password in .env before deploying."
  exit 1
fi

SECRET_KEY=$(grep "^SECRET_KEY=" .env | cut -d= -f2- || true)
if [ "$SECRET_KEY" = "CHANGE_ME_LONG_RANDOM_SECRET" ] || [ -z "$SECRET_KEY" ]; then
  echo "ERROR: SECRET_KEY is missing or still a default placeholder. Generate a long random SECRET_KEY before deploying."
  exit 1
fi

# Create backups dir (needs to exist for the volume mount)
mkdir -p backups

# Pull latest code (if in git repo)
if [ -d ".git" ]; then
  echo "→ Pulling latest code..."
  git pull --ff-only
fi

echo "→ Building images..."
docker compose -f docker-compose.prod.yml build --parallel

echo "→ Starting services..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "→ Waiting for FastAPI health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "  FastAPI is healthy ✓"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "  WARNING: FastAPI did not become healthy after 30 attempts"
    docker compose -f docker-compose.prod.yml logs fastapi --tail=30
  fi
  sleep 2
done

echo "→ Running any pending database migrations..."
docker compose -f docker-compose.prod.yml exec fastapi alembic upgrade head || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy complete ✓"
echo "  App:    https://$(grep '^APP_DOMAIN=' .env | cut -d= -f2)"
echo "  Logs:   docker compose -f docker-compose.prod.yml logs -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
