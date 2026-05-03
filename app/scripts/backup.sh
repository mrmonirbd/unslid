#!/bin/sh
# Automated MySQL backup script
# Runs inside the db-backup container via crond.
# Keeps backups for BACKUP_RETAIN_DAYS (default 14).

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/db_${MYSQL_DATABASE:-aipresentation}_${TIMESTAMP}.sql.gz"
RETAIN="${BACKUP_RETAIN_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup of ${MYSQL_DATABASE:-aipresentation} at $(date)"

mysqldump \
  -h mysql \
  -u "${MYSQL_USER:-presenton}" \
  "${MYSQL_DATABASE:-aipresentation}" \
  | gzip > "$FILENAME"

if [ $? -eq 0 ]; then
  echo "[backup] Backup saved: $FILENAME ($(du -sh "$FILENAME" | cut -f1))"
else
  echo "[backup] ERROR: mysqldump failed"
  rm -f "$FILENAME"
  exit 1
fi

# Remove backups older than RETAIN days
find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +"$RETAIN" -delete
echo "[backup] Removed backups older than ${RETAIN} days"
echo "[backup] Current backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none)"
