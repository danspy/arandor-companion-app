#!/bin/bash
set -e

# ---- CONFIG ----
DB_FILE="/srv/arandor/data/content.db"
MIGRATION_SQL="scripts/migrate-db.sql"
SERVICE="arandor.service"      # Name of your systemd service (change if needed)
BACKUP_DIR="/srv/arandor/data/db_backups"
DATE="$(date +%Y%m%d_%H%M%S)"

# ---- PREP ----
echo ">> Creating DB backup directory (if missing)..."
mkdir -p "$BACKUP_DIR"

echo ">> Backing up current database to $BACKUP_DIR/content.db.$DATE.bak"
cp "$DB_FILE" "$BACKUP_DIR/content.db.$DATE.bak"
echo "   - Backup complete."

# ---- MIGRATION ----
if [ ! -f "$MIGRATION_SQL" ]; then
  echo "ERROR: Migration SQL file not found: $MIGRATION_SQL"
  exit 1
fi

echo ">> Running migration SQL: $MIGRATION_SQL"
sqlite3 "$DB_FILE" < "$MIGRATION_SQL"
echo "   - Migration complete."

# ---- VERIFY ----
echo ">> Listing current tables in database:"
sqlite3 "$DB_FILE" ".tables"

echo ">> Printing latest schema for Faction table:"
sqlite3 "$DB_FILE" ".schema Faction"

# ---- OPTIONAL: RESTART SSR SERVICE ----
read -p "Restart $SERVICE for changes to take effect? [y/N]: " RESP
if [[ "$RESP" =~ ^[Yy]$ ]]; then
  echo ">> Restarting $SERVICE ..."
  sudo systemctl restart "$SERVICE"
fi

echo ">> Done! Your Astro DB schema has been updated and backed up."