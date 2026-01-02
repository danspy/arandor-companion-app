# Migration Guide: Timer Fields

This guide explains how to update your production database to add timer functionality to the DM Screen.

## What's Being Added

The timer feature adds 5 new fields to the `DMScreenState` table:
- `showTimer` - Boolean flag to control timer visibility on player display
- `timerDuration` - Timer duration in seconds (integer)
- `timerStartedAt` - Unix timestamp when timer started (integer, nullable)
- `timerPausedAt` - Unix timestamp when timer was paused (integer, nullable)
- `timerStatus` - Current timer status: 'running', 'paused', or 'stopped' (text)

## Migration Command

On your production server, run:

```bash
sqlite3 /srv/arandor/data/content.db < scripts/add-timer-fields.sql
```

Or if your database is in a different location:

```bash
sqlite3 /path/to/your/content.db < scripts/add-timer-fields.sql
```

## Step-by-Step Instructions

### 1. Backup Your Database (IMPORTANT!)

Before making any changes, create a backup:

```bash
cp /srv/arandor/data/content.db /srv/arandor/data/content.db.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. Upload Migration Script

Upload the `scripts/add-timer-fields.sql` file to your production server in the same location as your other scripts.

### 3. Run the Migration

Execute the migration:

```bash
cd /srv/arandor
sqlite3 data/content.db < scripts/add-timer-fields.sql
```

Expected output:
```
Timer fields migration complete
total_dm_screen_states|states_with_showTimer|states_with_timerDuration|states_with_timerStatus
1|1|1|1
```

### 4. Verify the Migration

Check that the columns were added:

```bash
sqlite3 /srv/arandor/data/content.db "PRAGMA table_info(DMScreenState);"
```

You should see the new timer fields in the output.

### 5. Restart the Application

```bash
sudo systemctl restart arandor.service
```

## Alternative: Manual SQL Commands

If you prefer to run commands one at a time:

```bash
sqlite3 /srv/arandor/data/content.db
```

Then in the SQLite prompt:

```sql
ALTER TABLE "DMScreenState" ADD COLUMN "showTimer" integer NOT NULL DEFAULT 0;
ALTER TABLE "DMScreenState" ADD COLUMN "timerDuration" integer NOT NULL DEFAULT 0;
ALTER TABLE "DMScreenState" ADD COLUMN "timerStartedAt" integer;
ALTER TABLE "DMScreenState" ADD COLUMN "timerPausedAt" integer;
ALTER TABLE "DMScreenState" ADD COLUMN "timerStatus" text NOT NULL DEFAULT 'stopped';

-- Verify
SELECT * FROM "DMScreenState";
.quit
```

## Rollback (If Needed)

If something goes wrong, restore from backup:

```bash
# Stop the service
sudo systemctl stop arandor.service

# Restore backup
cp /srv/arandor/data/content.db.backup.YYYYMMDD_HHMMSS /srv/arandor/data/content.db

# Start the service
sudo systemctl start arandor.service
```

## Notes

- The migration is **safe to run multiple times** - if columns already exist, SQLite will return an error but won't damage existing data
- The default values ensure existing DM Screen states will have the timer disabled (`showTimer = 0`, `timerStatus = 'stopped'`)
- No data loss will occur - this only adds new columns
- The migration does not require downtime, but restarting the application is recommended after migration

## Troubleshooting

### Error: "duplicate column name"
This means the column already exists. This is safe - your database is already up to date.

### Error: "no such table: DMScreenState"
The DMScreenState table doesn't exist yet. Run the full database migration first:
```bash
sqlite3 /srv/arandor/data/content.db < scripts/migrate-db.sql
```

### Permission denied
Make sure you have write permissions to the database file:
```bash
sudo chown $(whoami) /srv/arandor/data/content.db
```
