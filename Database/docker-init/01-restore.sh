#!/bin/sh
# Runs automatically on first container start (empty data dir only), via
# postgres's docker-entrypoint-initdb.d mechanism. The backup file is a
# pg_dump custom-format archive (despite the .sql extension) so it needs
# pg_restore, not psql -f.
set -e

DUMP_FILE="/backup/WorldWatcher_DB_Backup_v1.sql"

if [ ! -f "$DUMP_FILE" ]; then
  echo "WorldWatcher: no backup file at $DUMP_FILE, skipping restore."
  exit 0
fi

echo "WorldWatcher: restoring database from $DUMP_FILE ..."
pg_restore \
  --create \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --no-password \
  --username "$POSTGRES_USER" \
  --dbname postgres \
  --verbose \
  "$DUMP_FILE"
echo "WorldWatcher: restore complete."
