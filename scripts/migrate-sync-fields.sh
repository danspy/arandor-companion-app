#!/bin/bash
# D&D Beyond Sync Migration - Quick Reference
# Run these commands on your production server

# 1. BACKUP
cp .astro/content.db .astro/content.db.backup-$(date +%Y%m%d-%H%M%S)

# 2. ADD COLUMNS
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"lastSyncedAt\" text;"
sqlite3 .astro/content.db "ALTER TABLE \"Character\" ADD COLUMN \"statsManuallyEdited\" integer NOT NULL DEFAULT 0;"

# 3. VERIFY
sqlite3 .astro/content.db "PRAGMA table_info('Character');" | grep -E "lastSyncedAt|statsManuallyEdited"

# 4. RESTART
sudo systemctl restart arandor

# 5. CHECK STATUS
sudo systemctl status arandor
