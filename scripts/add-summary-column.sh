#!/bin/bash
# add-summary-column.sh
# Adds the 'summary' column to the DiaryEntry table
# Safe to run on production - will only add if column doesn't exist
#
# Usage:
#   chmod +x scripts/add-summary-column.sh
#   ./scripts/add-summary-column.sh
#
# Note: Uses ASTRO_DATABASE_FILE environment variable if set,
#       otherwise defaults to /srv/arandor/data/content.db
#       Set ASTRO_DATABASE_FILE before running if your database is elsewhere:
#       ASTRO_DATABASE_FILE=/path/to/your/db.db ./scripts/add-summary-column.sh

set -e

# Configuration
DB_PATH="${ASTRO_DATABASE_FILE:-/srv/arandor/data/content.db}"
BACKUP_DIR="$(dirname "$DB_PATH")/backups"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Arandor Database Migration: Add Summary Column"
echo "=============================================="
echo ""
echo "Database path: $DB_PATH"
echo ""

# Check if sqlite3 is installed
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo -e "${RED}Error: sqlite3 is not installed${NC}"
  echo "Install it with: sudo apt update && sudo apt install -y sqlite3"
  exit 1
fi

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  echo -e "${RED}Error: Database does not exist at $DB_PATH${NC}"
  echo "Run the main update-database.sh script first."
  exit 1
fi

# Check if column already exists
COLUMN_EXISTS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(DiaryEntry);" | grep -c "summary" || true)

if [ "$COLUMN_EXISTS" -gt 0 ]; then
  echo -e "${GREEN}✓ Summary column already exists in DiaryEntry table${NC}"
  echo "No migration needed."
  exit 0
fi

echo "Current DiaryEntry table schema:"
echo "-------------------------------"
sqlite3 "$DB_PATH" "PRAGMA table_info(DiaryEntry);"
echo ""

# Count existing diary entries
ENTRY_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM DiaryEntry;" 2>/dev/null || echo "0")
echo "Diary entries in database: $ENTRY_COUNT"
echo ""

if [ "$ENTRY_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Database contains $ENTRY_COUNT diary entries${NC}"
  echo "The summary column will be added with NULL values."
  echo "You can generate summaries for existing entries from the web UI."
  echo ""
fi

# Ask for confirmation
read -p "Do you want to add the summary column? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
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

# Add the column
echo -e "${GREEN}Adding summary column...${NC}"
sqlite3 "$DB_PATH" "ALTER TABLE DiaryEntry ADD COLUMN summary text;"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Summary column added successfully!${NC}"
else
  echo -e "${RED}Error: Failed to add summary column${NC}"
  echo "You can restore from backup: $BACKUP_FILE"
  exit 1
fi

echo ""
echo "Updated DiaryEntry table schema:"
echo "-------------------------------"
sqlite3 "$DB_PATH" "PRAGMA table_info(DiaryEntry);"
echo ""

# Verify data is still there
ENTRY_COUNT_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM DiaryEntry;" 2>/dev/null || echo "0")
echo "Diary entries after migration: $ENTRY_COUNT_AFTER"

if [ "$ENTRY_COUNT" != "$ENTRY_COUNT_AFTER" ]; then
  echo -e "${RED}⚠️  WARNING: Entry count changed! ($ENTRY_COUNT -> $ENTRY_COUNT_AFTER)${NC}"
  echo "You may want to restore from backup: $BACKUP_FILE"
else
  echo -e "${GREEN}✓ Data preserved successfully${NC}"
fi

echo ""
echo "Done! Remember to restart the application:"
echo "  sudo systemctl restart arandor.service"
echo ""
echo "You can now generate AI summaries for your diary entries from the web UI."
