# HP Fields Migration Guide

This guide helps you add the new HP (Hit Points) fields to your production database for the D&D Beyond HP sync feature.

## What This Adds

The migration adds three new columns to the `Character` table:
- `hp` - Current hit points (integer, nullable)
- `maxHp` - Maximum hit points (integer, nullable)
- `tempHp` - Temporary hit points (integer, nullable)

## Quick Start

### Method 1: Using the Shell Script (Recommended)

The easiest way to run the migration:

```bash
# Navigate to the scripts directory
cd scripts

# Run the migration (uses default database path: ./data/content.db)
./add-hp-fields.sh

# Or specify a custom database path
./add-hp-fields.sh /path/to/your/database.db
```

The script will:
- ✓ Automatically create a backup before making changes
- ✓ Add all three HP fields to the Character table
- ✓ Verify the migration succeeded
- ✓ Show you the backup location for rollback if needed

### Method 2: Manual SQL Execution

If you prefer to run SQL directly:

```bash
# Using sqlite3 command line
sqlite3 /path/to/your/database.db < scripts/add-hp-fields.sql
```

Or connect to your database and run these commands individually:

```sql
ALTER TABLE "Character" ADD COLUMN "hp" integer;
ALTER TABLE "Character" ADD COLUMN "maxHp" integer;
ALTER TABLE "Character" ADD COLUMN "tempHp" integer;
```

## After Migration

Once the migration is complete:

1. **Restart your application** - The app will now recognize the HP fields
2. **HP Auto-Sync** - Characters with D&D Beyond URLs will automatically sync HP when combat is active
3. **Manual HP Entry** - You can also manually set HP values in the character editor

## Verification

To verify the migration worked:

```bash
# Check if columns exist
sqlite3 your-database.db "PRAGMA table_info(Character);" | grep -E "(hp|maxHp|tempHp)"

# Should show:
# 20|hp|integer|0||0
# 21|maxHp|integer|0||0
# 22|tempHp|integer|0||0
```

## Rollback

If you need to rollback the migration:

1. The shell script automatically creates a backup before migrating
2. Find the backup file (shown in the script output)
3. Restore it:
   ```bash
   cp ./data/content.db.backup-YYYYMMDD-HHMMSS ./data/content.db
   ```

## Troubleshooting

### "Column already exists" error
This is normal if you run the migration twice. The columns won't be added again, and your data is safe.

### "Database is locked"
Stop your application before running the migration:
```bash
# On Uberspace or systemd
systemctl --user stop arandor
./add-hp-fields.sh
systemctl --user start arandor
```

### sqlite3 command not found
Install sqlite3:
```bash
# Ubuntu/Debian
sudo apt-get install sqlite3

# macOS
brew install sqlite3

# Uberspace (already installed)
```

## Production Deployment

For production deployments:

1. **Stop the application** first to avoid database locks
2. **Run the migration script**
3. **Verify success** (script does this automatically)
4. **Restart the application**

Example for systemd:
```bash
systemctl --user stop arandor
cd /path/to/arandor-companion-app
./scripts/add-hp-fields.sh ./data/content.db
systemctl --user start arandor
```

## Safety Features

The migration script includes several safety features:

- ✓ Automatic backup before any changes
- ✓ Checks if database exists before running
- ✓ Handles existing columns gracefully (won't fail if already migrated)
- ✓ Verifies migration succeeded
- ✓ Clear output with success/error messages
- ✓ Exit codes for automation (0 = success, 1 = error)

## Need Help?

If you encounter issues:

1. Check that you're using the correct database path
2. Ensure the application is stopped during migration
3. Look at the backup file location from the script output
4. Check the script output for specific error messages

## Technical Details

### Why These Fields?

The HP fields enable:
- Real-time HP syncing from D&D Beyond during combat
- Automatic HP updates every 10 seconds when combat is active
- Persistent HP storage across sessions
- Manual HP management in the character editor

### Database Schema

```sql
-- Character table with HP fields
CREATE TABLE "Character" (
  -- ... existing fields ...
  "hp" integer,        -- Current HP
  "maxHp" integer,     -- Maximum HP
  "tempHp" integer,    -- Temporary HP
  -- ... more fields ...
);
```

### Integration

The HP fields integrate with:
- D&D Beyond API sync (`/api/initiative/sync-hp`)
- Initiative Tracker display
- Character management UI
- Combat state tracking

## See Also

- [D&D Beyond HP Sync Documentation](../docs/DnD-Beyond-Sync.md)
- [Deployment Guide](../docs/Deployment.md)
- Main README: [../README.md](../README.md)
