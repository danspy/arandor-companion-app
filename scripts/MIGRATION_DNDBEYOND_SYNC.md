# D&D Beyond Sync Fields Migration

## Database Commands - Run on Production Server

### Prerequisites
1. SSH into your production server
2. Locate your Astro DB SQLite database file (usually at `.astro/content.db`)
3. Back up your database before running any commands

### Backup Command
```bash
# Backup the database
cp .astro/content.db .astro/content.db.backup-$(date +%Y%m%d-%H%M%S)
```

### Migration Commands

Run these commands directly with `sqlite3`:

```bash
# Navigate to your app directory
cd /srv/arandor

# Run migration using sqlite3
sqlite3 .astro/content.db << 'EOF'
-- Add lastSyncedAt column (timestamp of last D&D Beyond sync)
ALTER TABLE "Character" ADD COLUMN "lastSyncedAt" text;

-- Add statsManuallyEdited column (protects manual stat edits from sync override)
ALTER TABLE "Character" ADD COLUMN "statsManuallyEdited" integer NOT NULL DEFAULT 0;

-- Verify the columns were added
PRAGMA table_info("Character");

-- Show count
SELECT COUNT(*) as total_characters FROM "Character";
EOF
```

### Individual Commands (if you prefer to run one at a time)

```bash
sqlite3 .astro/content.db
```

Then run inside sqlite3:

```sql
-- Add lastSyncedAt column
ALTER TABLE "Character" ADD COLUMN "lastSyncedAt" text;

-- Add statsManuallyEdited column  
ALTER TABLE "Character" ADD COLUMN "statsManuallyEdited" integer NOT NULL DEFAULT 0;

-- Verify
PRAGMA table_info("Character");

-- Exit
.quit
```

### Verification

Check that the columns were added successfully:

```bash
sqlite3 .astro/content.db "PRAGMA table_info('Character');" | grep -E "lastSyncedAt|statsManuallyEdited"
```

Expected output should include:
```
48|lastSyncedAt|text|0||0
49|statsManuallyEdited|integer|1|0|0
```

### What These Columns Do

- **`lastSyncedAt`**: Stores the timestamp when character was last synced from D&D Beyond
  - Type: text (ISO 8601 date string)
  - Nullable: yes
  - Used for: 24-hour auto-sync cooldown

- **`statsManuallyEdited`**: Boolean flag to protect manually edited ability scores
  - Type: integer (0=false, 1=true)
  - Default: 0 (false)
  - Used for: Preventing sync from overriding user's manual stat corrections

### Post-Migration

After running the migration:

1. Restart your application:
   ```bash
   sudo systemctl restart arandor
   ```

2. Verify the app is running:
   ```bash
   sudo systemctl status arandor
   ```

3. Test the sync functionality with a character that has a D&D Beyond URL

### Rollback (if needed)

If you need to rollback, you can remove the columns:

```bash
sqlite3 .astro/content.db << 'EOF'
-- SQLite doesn't support DROP COLUMN easily, so you'd need to restore from backup
.quit
EOF

# Restore from backup
cp .astro/content.db.backup-TIMESTAMP .astro/content.db
sudo systemctl restart arandor
```

## Troubleshooting

### Column already exists error
If you see "duplicate column name" error, the column already exists. This is safe to ignore.

### Permission denied
Make sure you have write permissions to the database file:
```bash
ls -l .astro/content.db
sudo chown $(whoami):$(whoami) .astro/content.db
```

### Database locked
If database is locked, stop the app first:
```bash
sudo systemctl stop arandor
# Run migration
sqlite3 .astro/content.db < scripts/add-sync-fields.sql
sudo systemctl start arandor
```

## Questions?

If you encounter any issues, check:
1. Database file location is correct
2. You have write permissions
3. App is stopped if database is locked
4. Backup was created successfully
