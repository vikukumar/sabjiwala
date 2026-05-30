#!/usr/bin/env bash
# Database Backup Script
set -e

BACKUP_DIR="/app/storage/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="sabjiwala_backup_${TIMESTAMP}.sql"

echo "Creating database backup..."
mkdir -p "${BACKUP_DIR}"
docker compose exec postgres pg_dump -U postgres sbjiwala > "${BACKUP_DIR}/${FILENAME}"
echo "Backup created at ${BACKUP_DIR}/${FILENAME}"
