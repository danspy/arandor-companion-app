#!/bin/bash
# update-database.sh
# Manual database migration script for production
# 
# This script should be run manually on the production server when database
# schema changes are needed. It will never be run automatically during deployments.
#
# Usage:
#   chmod +x scripts/update-database.sh
#   ./scripts/update-database.sh [--dry-run]
#
# Options:
#   --dry-run    Show what would be done without making changes
#

set -e

# Configuration
DB_PATH="${ASTRO_DATABASE_FILE:-/srv/arandor/.astro/content.db}"
MIGRATE_SQL="$(dirname "$0")/migrate-db.sql"
BACKUP_DIR="$(dirname "$DB_PATH")/backups"
DRY_RUN=false

# Parse arguments
if [ "$1" = "--dry-run" ]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE - No changes will be made ==="
  echo ""
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Arandor Database Update Script"
echo "=============================="
echo ""
echo "Database path: $DB_PATH"
echo "Migration script: $MIGRATE_SQL"
echo ""

# Check if sqlite3 is installed
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo -e "${RED}Error: sqlite3 is not installed${NC}"
  echo "Install it with: sudo apt update && sudo apt install -y sqlite3"
  exit 1
fi

# Check if migration script exists
if [ ! -f "$MIGRATE_SQL" ]; then
  echo -e "${RED}Error: Migration script not found at $MIGRATE_SQL${NC}"
  exit 1
fi

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo -e "${YELLOW}Warning: Database does not exist at $DB_PATH${NC}"
  echo "This will create a new database with empty tables."
  echo ""
  read -p "Do you want to create the database? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would create database at $DB_PATH"
    exit 0
  fi
  
  # Ensure directory exists
  mkdir -p "$(dirname "$DB_PATH")"
  
  # Create database and run migration
  echo -e "${GREEN}Creating new database...${NC}"
  sqlite3 "$DB_PATH" < "$MIGRATE_SQL"
  echo -e "${GREEN}Database created successfully!${NC}"
  echo ""
  echo "Tables created:"
  sqlite3 "$DB_PATH" ".tables"
  exit 0
fi

# Database exists - show current state
echo "Current database state:"
echo "----------------------"
echo "Size: $(du -h "$DB_PATH" | cut -f1)"
echo ""
echo "Tables:"
sqlite3 "$DB_PATH" ".tables"
echo ""

# Check if database has data
USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
echo "User count: $USER_COUNT"
echo ""

if [ "$USER_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNING: Database contains data ($USER_COUNT users)${NC}"
  echo ""
  echo "The migration script uses 'CREATE TABLE IF NOT EXISTS' which is safe,"
  echo "but you should review the migration script before proceeding."
  echo ""
  echo "Migration script contents:"
  echo "-------------------------"
  head -20 "$MIGRATE_SQL"
  echo "... (showing first 20 lines only)"
  echo ""
fi

# Ask for confirmation
read -p "Do you want to apply the migration? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would backup database and apply migration"
  exit 0
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
BACKUP_FILE="$BACKUP_DIR/content.db.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "${GREEN}Creating backup...${NC}"
cp "$DB_PATH" "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"
echo ""

# Apply migration
echo -e "${GREEN}Applying migration...${NC}"
sqlite3 "$DB_PATH" < "$MIGRATE_SQL"
echo -e "${GREEN}Migration applied successfully!${NC}"
echo ""

# Show updated state
echo "Updated database state:"
echo "----------------------"
echo "Tables:"
sqlite3 "$DB_PATH" ".tables"
echo ""

# Verify data is still there
USER_COUNT_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM User;" 2>/dev/null || echo "0")
echo "User count after migration: $USER_COUNT_AFTER"

if [ "$USER_COUNT" != "$USER_COUNT_AFTER" ]; then
  echo -e "${RED}⚠️  WARNING: User count changed! ($USER_COUNT -> $USER_COUNT_AFTER)${NC}"
  echo "You may want to restore from backup: $BACKUP_FILE"
else
  echo -e "${GREEN}✓ Data preserved successfully${NC}"
fi

echo ""
echo "Done! Remember to restart the application:"
echo "  sudo systemctl restart arandor.service"
