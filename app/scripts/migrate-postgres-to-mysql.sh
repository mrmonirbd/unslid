#!/bin/sh
set -eu

# Usage:
#   SOURCE_DATABASE_URL='postgresql://user:pass@host:5432/db' \
#   TARGET_DATABASE_URL='mysql://user:pass@host:3306/db' \
#   ./scripts/migrate-postgres-to-mysql.sh
#
# Requires Docker. Uses pgloader in a temporary container.

if [ -z "${SOURCE_DATABASE_URL:-}" ]; then
  echo "SOURCE_DATABASE_URL is required"
  exit 1
fi

if [ -z "${TARGET_DATABASE_URL:-}" ]; then
  echo "TARGET_DATABASE_URL is required"
  exit 1
fi

echo "[migrate] Migrating PostgreSQL/Supabase data to MySQL..."
docker run --rm dimitri/pgloader:latest pgloader "$SOURCE_DATABASE_URL" "$TARGET_DATABASE_URL"
echo "[migrate] Done."
