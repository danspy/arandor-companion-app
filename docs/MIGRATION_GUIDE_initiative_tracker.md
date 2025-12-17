# Initiative Tracker Migration Guide

This guide explains how to migrate your database to support the Initiative Tracker feature.

## Overview

The Initiative Tracker feature adds two new tables to the database:
- `InitiativeTracker` - Stores combat initiative entries
- `CombatState` - Stores current round and turn index for real-time sync

## Automatic Migration (Development)

In development mode, Astro DB automatically creates new tables when you run:

```bash
npm run dev
```

The database will be seeded with initial data automatically.

## Manual Migration (Production)

For production environments, follow these steps:

### Step 1: Backup Your Database

Before making any changes, backup your existing database:

```bash
# If using SQLite file
cp /srv/arandor/data/content.db /srv/arandor/data/content.db.backup

# Or use the backup script if available
npm run backup
```

### Step 2: Update Schema

The new tables are already defined in `db/config.ts`:

```typescript
const InitiativeTracker = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    name: column.text(),
    initiative: column.number(),
    type: column.text(),
    hp: column.number({ optional: true }),
    maxHp: column.number({ optional: true }),
    ac: column.number({ optional: true }),
    notes: column.text({ optional: true }),
    isActive: column.boolean({ default: true }),
    createdAt: column.date({ default: new Date() }),
    updatedAt: column.date({ default: new Date() }),
  }
});

const CombatState = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    currentRound: column.number({ default: 1 }),
    currentTurnIndex: column.number({ default: 0 }),
    updatedAt: column.date({ default: new Date() }),
  }
});
```

### Step 3: Deploy

Deploy your application with the updated schema:

```bash
# Build the application
npm run build

# Restart your service (systemd example)
sudo systemctl restart arandor.service
```

### Step 4: Verify

After deployment, verify the tables were created:

```bash
# Connect to your database
sqlite3 /srv/arandor/data/content.db

# Check for new tables
.tables

# You should see: InitiativeTracker and CombatState

# Exit
.quit
```

## Manual SQL Migration (If Needed)

If automatic migration doesn't work, you can manually create the tables:

```sql
-- Create InitiativeTracker table
CREATE TABLE IF NOT EXISTS InitiativeTracker (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initiative INTEGER NOT NULL,
  type TEXT NOT NULL,
  hp INTEGER,
  maxHp INTEGER,
  ac INTEGER,
  notes TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- Create CombatState table
CREATE TABLE IF NOT EXISTS CombatState (
  id TEXT PRIMARY KEY,
  currentRound INTEGER DEFAULT 1,
  currentTurnIndex INTEGER DEFAULT 0,
  updatedAt TEXT NOT NULL
);

-- Insert default combat state
INSERT INTO CombatState (id, currentRound, currentTurnIndex, updatedAt)
VALUES ('current-combat', 1, 0, datetime('now'))
ON CONFLICT(id) DO NOTHING;
```

Apply the SQL:

```bash
sqlite3 /srv/arandor/data/content.db < migration.sql
```

## Rollback

If you need to rollback, remove the new tables:

```sql
DROP TABLE IF EXISTS InitiativeTracker;
DROP TABLE IF EXISTS CombatState;
```

## Troubleshooting

### Tables Not Created

If tables aren't created automatically:
1. Check that `db/config.ts` includes both tables in the `defineDb` export
2. Ensure you're running the latest code version
3. Try deleting `.astro` directory and rebuilding

### Permission Issues

If you get permission errors:
1. Check database file permissions: `ls -la /srv/arandor/data/content.db`
2. Ensure your app user has write access
3. Update permissions: `chmod 660 /srv/arandor/data/content.db`

### Data Loss

If you lose existing data:
1. Restore from backup: `cp /srv/arandor/data/content.db.backup /srv/arandor/data/content.db`
2. Check Astro DB documentation for recovery options

## Support

For issues or questions:
- Check Astro DB docs: https://docs.astro.build/en/guides/astro-db/
- Open an issue in the repository
- Contact the development team
