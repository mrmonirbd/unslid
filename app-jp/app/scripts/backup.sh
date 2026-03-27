#!/bin/sh
# Automated PostgreSQL backup script
# Runs inside the db-backup container via crond.
# Keeps backups for BACKUP_RETAIN_DAYS (default 14).

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/db_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
RETAIN="${BACKUP_RETAIN_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup of ${POSTGRES_DB} at $(date)"

pg_dump \
  -h postgres \
  -U "${POSTGRES_USER:-postgres}" \
  "${POSTGRES_DB:-aipresentation}" \
  | gzip > "$FILENAME"

if [ $? -eq 0 ]; then
  echo "[backup] Backup saved: $FILENAME ($(du -sh "$FILENAME" | cut -f1))"
else
  echo "[backup] ERROR: pg_dump failed"
  rm -f "$FILENAME"
  exit 1
fi

# Remove backups older than RETAIN days
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$RETAIN" -delete
echo "[backup] Removed backups older than ${RETAIN} days"
echo "[backup] Current backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none)"
