# Migration Guide: Adding isActive Field to Character Table

This guide explains how to add the new `isActive` field to your existing Character table on your production server.

## Quick Summary

The `isActive` field is a new boolean column that tracks whether a player character is currently active in the campaign. All existing characters will default to active.

## Migration Methods

You have **two options** to apply this migration:

### Option 1: Using the Automated Update Script (Recommended)

This is the easiest and safest method. The script handles backups automatically.

```bash
# SSH into your server
ssh deploy@your-server.com

# Navigate to your application directory
cd /srv/arandor

# Pull the latest code (includes migration script updates)
git pull

# Run the update script
./scripts/update-database.sh
```

The script will:
1. ✅ Show you the current database state
2. ✅ Create an automatic backup before making changes
3. ✅ Add the `isActive` column to the Character table
4. ✅ Set all existing characters to active (isActive = 1)
5. ✅ Verify your data is preserved

After the migration completes, restart your application:
```bash
sudo systemctl restart arandor.service
```

### Option 2: Manual Migration with SQL

If you prefer to apply the migration manually:

```bash
# SSH into your server
ssh deploy@your-server.com

# Navigate to your application directory
cd /srv/arandor

# Create a backup first (IMPORTANT!)
mkdir -p .astro/backups
cp .astro/content.db .astro/backups/content.db.backup.$(date +%Y%m%d_%H%M%S)

# Apply the migration manually
sqlite3 .astro/content.db "ALTER TABLE Character ADD COLUMN isActive integer NOT NULL DEFAULT 1;"

# Verify the column was added
sqlite3 .astro/content.db "PRAGMA table_info(Character);"

# Restart the application
sudo systemctl restart arandor.service
```

## What Changes?

**Database Schema:**
- Adds `isActive` column to the `Character` table
- Type: Integer (0 = inactive, 1 = active)
- Default value: 1 (active)
- All existing characters will be set to active

**Application Behavior:**
- You'll see new "Active Players" statistics
- Filter buttons (Active/Inactive/All) on the Characters page
- Inactive characters display with a gray header and "Inactive" badge
- Dashboard shows only "Active Party Members"

## Verifying the Migration

After applying the migration, verify it worked:

```bash
# Check the Character table schema
sqlite3 .astro/content.db "PRAGMA table_info(Character);"

# You should see the isActive column in the output
# It should show: isActive | integer | 1 | 1

# Check that existing characters are active
sqlite3 .astro/content.db "SELECT name, isActive FROM Character;"

# All existing characters should show isActive = 1
```

## Rollback (If Needed)

If something goes wrong, you can restore from the backup:

```bash
# Stop the service
sudo systemctl stop arandor.service

# Restore from backup (replace TIMESTAMP with your backup timestamp)
cp .astro/backups/content.db.backup.TIMESTAMP .astro/content.db

# Start the service
sudo systemctl start arandor.service
```

## Troubleshooting

**Error: "duplicate column name: isActive"**
- This means the column already exists. You can safely ignore this error.
- The migration script handles this automatically.

**Error: "no such table: Character"**
- Your database might not be initialized yet
- Run the full migration: `./scripts/update-database.sh`

**Application won't start after migration:**
- Check logs: `sudo journalctl -u arandor.service -n 50`
- Verify database file permissions: `ls -l .astro/content.db`
- Try restoring from backup (see Rollback section above)

## Need Help?

If you encounter issues:
1. Check the backup was created before migration
2. Review the logs: `sudo journalctl -u arandor.service -n 100`
3. Open an issue on GitHub with the error details

## Technical Details

**SQL Changes:**
```sql
-- Adds the isActive column to the Character table
ALTER TABLE "Character" ADD COLUMN "isActive" integer NOT NULL DEFAULT 1;
```

**Default Behavior:**
- New characters: Active by default (checkbox is checked)
- Existing characters: Set to active (isActive = 1)
- Value 1 = active, 0 = inactive (SQLite boolean representation)

**Application Logic:**
- Filters use `isActive !== false` pattern for null-safe handling
- Dashboard filters: `characters.filter(c => c.isActive !== false)`
- Character form: Checkbox labeled "Active Player"
