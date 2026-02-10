# DATABASE MIGRATION COMMANDS - D&D Beyond Sync

## ONLY COMMANDS (Copy & Paste Ready)

### On Your Production Server

#### Step 1: Backup
```bash
cp .astro/content.db .astro/content.db.backup-$(date +%Y%m%d-%H%M%S)
```

#### Step 2: Add Columns (Choose ONE method)

**Method A: Two separate commands**
```bash
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"lastSyncedAt\" text;"
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"statsManuallyEdited\" integer NOT NULL DEFAULT 0;"
```

**Method B: Single command**
```bash
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"lastSyncedAt\" text; ALTER TABLE \"Character\" ADD COLUMN \"statsManuallyEdited\" integer NOT NULL DEFAULT 0;"
```

**Method C: Interactive**
```bash
sqlite3 .astro/content.db
```
Then type:
```sql
ALTER TABLE "Character" ADD COLUMN "lastSyncedAt" text;
ALTER TABLE "Character" ADD COLUMN "statsManuallyEdited" integer NOT NULL DEFAULT 0;
.quit
```

#### Step 3: Verify
```bash
sqlite3 .astro/content.db "PRAGMA table_info('Character');" | grep -E "lastSyncedAt|statsManuallyEdited"
```

#### Step 4: Restart
```bash
sudo systemctl restart arandor
```

#### Step 5: Check Status
```bash
sudo systemctl status arandor
```

---

## If Database is Locked

```bash
sudo systemctl stop arandor
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"lastSyncedAt\" text; ALTER TABLE \"Character\" ADD COLUMN \"statsManuallyEdited\" integer NOT NULL DEFAULT 0;"
sudo systemctl start arandor
```

---

## Rollback (If Something Goes Wrong)

```bash
sudo systemctl stop arandor
cp .astro/content.db.backup-TIMESTAMP .astro/content.db
sudo systemctl start arandor
```

---

## All-In-One Script

```bash
cd /srv/arandor && \
cp .astro/content.db .astro/content.db.backup-$(date +%Y%m%d-%H%M%S) && \
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"lastSyncedAt\" text; ALTER TABLE \"Character\" ADD COLUMN \"statsManuallyEdited\" integer NOT NULL DEFAULT 0;" && \
sqlite3 .astro/content.db "PRAGMA table_info('Character');" | grep -E "lastSyncedAt|statsManuallyEdited" && \
sudo systemctl restart arandor && \
sudo systemctl status arandor
```

---

## Expected Output After Verification

```
48|lastSyncedAt|text|0||0
49|statsManuallyEdited|integer|1|0|0
```

The numbers (48, 49) may vary depending on your schema.

---

## That's It!

After running these commands:
1. Database is updated ✅
2. App is restarted ✅
3. D&D Beyond sync features will work ✅
