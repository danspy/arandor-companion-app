#!/bin/bash
# Script to add HP fields to the Character table in production database
# Usage: ./add-hp-fields.sh [database-path]
# Default database path: ./data/content.db

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database path (default or provided as argument)
DB_PATH="${1:-./data/content.db}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Add HP Fields Migration Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
    echo "Please specify the correct path to your database:"
    echo "  ./add-hp-fields.sh /path/to/your/database.db"
    exit 1
fi

echo -e "${YELLOW}Database:${NC} $DB_PATH"
echo ""

# Backup database
BACKUP_PATH="${DB_PATH}.backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}Creating backup...${NC}"
cp "$DB_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✓ Backup created: $BACKUP_PATH${NC}"
echo ""

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}Error: sqlite3 command not found${NC}"
    echo "Please install sqlite3:"
    echo "  Ubuntu/Debian: sudo apt-get install sqlite3"
    echo "  macOS: brew install sqlite3"
    exit 1
fi

# Run migration
echo -e "${YELLOW}Running migration...${NC}"
echo ""

# Run each ALTER TABLE statement separately to handle existing columns gracefully
sqlite3 "$DB_PATH" "ALTER TABLE Character ADD COLUMN hp integer;" 2>/dev/null || echo "Column 'hp' may already exist"
sqlite3 "$DB_PATH" "ALTER TABLE Character ADD COLUMN maxHp integer;" 2>/dev/null || echo "Column 'maxHp' may already exist"
sqlite3 "$DB_PATH" "ALTER TABLE Character ADD COLUMN tempHp integer;" 2>/dev/null || echo "Column 'tempHp' may already exist"

# Verify migration
echo ""
echo -e "${YELLOW}Verifying migration...${NC}"
RESULT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM pragma_table_info('Character') WHERE name IN ('hp', 'maxHp', 'tempHp');")

if [ "$RESULT" -eq 3 ]; then
    echo -e "${GREEN}✓ Migration successful! All HP fields added.${NC}"
    echo ""
    
    # Show table structure
    echo -e "${YELLOW}Current Character table structure:${NC}"
    sqlite3 "$DB_PATH" "PRAGMA table_info(Character);" | grep -E "(hp|maxHp|tempHp)" || true
    
    # Show character count
    CHAR_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM Character;")
    echo ""
    echo -e "${GREEN}Total characters in database: $CHAR_COUNT${NC}"
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Migration Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Restart your application"
    echo "2. Characters with D&D Beyond URLs will auto-sync HP when combat starts"
    echo "3. You can also manually set HP values in the character editor"
    echo ""
    echo -e "${YELLOW}Backup location: $BACKUP_PATH${NC}"
    
else
    echo -e "${RED}✗ Migration may have failed. Only $RESULT/3 columns found.${NC}"
    echo ""
    echo "You can restore from backup if needed:"
    echo "  cp $BACKUP_PATH $DB_PATH"
    exit 1
fi
