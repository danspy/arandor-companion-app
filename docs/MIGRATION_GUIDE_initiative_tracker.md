# Initiative Tracker Migration Guide

This guide explains how to migrate your database to support the Initiative Tracker feature with real-time synchronization and combat control system.

## Overview

The Initiative Tracker feature adds two new tables to the database:
- `InitiativeTracker` - Stores combat initiative entries (name, initiative, HP, AC, notes, active status)
- `CombatState` - Stores current round, turn index, and combat status for real-time sync

## What's New

### Combat Control System
- **Start/Pause/Stop buttons** - DM/Admin can control when real-time tracking is active
- **Status field** - CombatState table now includes a `status` column ('active', 'paused', or 'stopped')
- **Polling control** - Real-time updates only occur when combat status is 'active'

### Real-Time Data Synchronization
- All combat data (HP, AC, notes, active status) syncs automatically every 2 seconds
- Turn indicator and round counter update in real-time for all users
- Dashboard shows active combat indicator for logged-in users

### Dashboard Integration
- Active combat banner appears on dashboard when combat is active
- Click banner to navigate directly to initiative tracker
- Banner hides automatically when combat is paused or stopped

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
    status: column.text({ default: 'stopped' }), // NEW: 'active' | 'paused' | 'stopped'
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
  status TEXT DEFAULT 'stopped',
  updatedAt TEXT NOT NULL
);

-- Insert default combat state
INSERT INTO CombatState (id, currentRound, currentTurnIndex, status, updatedAt)
VALUES ('current-combat', 1, 0, 'stopped', datetime('now'))
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

## Updating Existing Installation

If you already have the Initiative Tracker installed **before** the combat control system was added:

### Option 1: Add Status Column (Recommended)

Add the `status` column to existing CombatState table:

```sql
-- Add status column if it doesn't exist
ALTER TABLE CombatState ADD COLUMN status TEXT DEFAULT 'stopped';

-- Update existing rows to have default status
UPDATE CombatState SET status = 'stopped' WHERE status IS NULL;
```

### Option 2: Recreate CombatState Table

If you prefer a clean slate:

```sql
-- Backup current round/turn data
CREATE TABLE CombatState_backup AS SELECT * FROM CombatState;

-- Drop and recreate with new schema
DROP TABLE CombatState;

CREATE TABLE CombatState (
  id TEXT PRIMARY KEY,
  currentRound INTEGER DEFAULT 1,
  currentTurnIndex INTEGER DEFAULT 0,
  status TEXT DEFAULT 'stopped',
  updatedAt TEXT NOT NULL
);

-- Restore data with default status
INSERT INTO CombatState (id, currentRound, currentTurnIndex, status, updatedAt)
SELECT id, currentRound, currentTurnIndex, 'stopped', updatedAt FROM CombatState_backup;

-- Clean up
DROP TABLE CombatState_backup;
```

## Feature Usage

### Combat Control Buttons (DM/Admin Only)

- **Start Combat (▶ Active)** - Green button, enables real-time tracking for all users
- **Pause Combat (⏸ Paused)** - Yellow button, temporarily disables polling (manual refresh needed)
- **Stop Combat (⏹ Stopped)** - Red button, stops tracking and resets combat state

### Real-Time Updates

When combat is **active**, all users automatically see:
- HP and AC changes within 2 seconds
- Turn indicator movement (yellow border)
- Round counter updates
- Notes updates (DM/Admin only)
- Active/inactive status changes (opacity)

### Dashboard Integration

Logged-in users see an active combat banner on the dashboard:
- Only appears when combat status is 'active'
- Red gradient background with animated shield icon
- Click banner to navigate to initiative tracker
- Polls every 5 seconds to check status

## Troubleshooting

### Tables Not Created

If tables aren't created automatically:
1. Check that `db/config.ts` includes both tables in the `defineDb` export
2. Ensure you're running the latest code version
3. Try deleting `.astro` directory and rebuilding

### Status Column Missing

If you get errors about missing `status` column:
1. Check if column exists: `PRAGMA table_info(CombatState);`
2. Add it manually using SQL from "Updating Existing Installation" section
3. Restart your application

### Real-Time Updates Not Working

If data doesn't sync in real-time:
1. Check that combat status is 'active' (click Start Combat button)
2. Verify `/api/combat-state` endpoint is accessible
3. Check browser console for polling errors
4. Ensure multiple users are on the initiative tracker page

### Dashboard Banner Not Showing

If combat banner doesn't appear on dashboard:
1. Ensure you're logged in
2. Start combat from initiative tracker (green Start button)
3. Check that combat status is 'active' in database
4. Clear browser cache and reload

### Permission Issues

If you get permission errors:
1. Check database file permissions: `ls -la /srv/arandor/data/content.db`
2. Ensure your app user has write access
3. Update permissions: `chmod 660 /srv/arandor/data/content.db`

### Data Loss

If you lose existing data:
1. Restore from backup: `cp /srv/arandor/data/content.db.backup /srv/arandor/data/content.db`
2. Check Astro DB documentation for recovery options

## API Changes

### Combat State API

The `/api/combat-state` endpoint now accepts an optional `status` parameter:

**GET** - Retrieve current combat state:
```json
{
  "id": "current-combat",
  "currentRound": 1,
  "currentTurnIndex": 0,
  "status": "active"
}
```

**PUT** - Update combat state:
```json
{
  "round": 2,
  "turnIndex": 3,
  "status": "active"  // Optional: 'active' | 'paused' | 'stopped'
}
```

### Initiative Tracker API

Real-time polling fetches all initiative entries:
- DM/Admin see: HP, AC, notes, active status
- Players see: HP as health status badges, no AC/notes

## Performance Notes

### Polling Rates

- **Initiative Tracker**: Polls every 2 seconds when status is 'active'
- **Dashboard**: Polls every 5 seconds to check combat status
- All polling automatically stops when combat is 'paused' or 'stopped'

### Server Load

The combat control system reduces server load:
- No polling during breaks or planning (paused/stopped)
- Efficient queries (only fetches what's needed)
- Automatic cleanup on page navigation (View Transitions compatible)

## Support

For issues or questions:
- Check Astro DB docs: https://docs.astro.build/en/guides/astro-db/
- Review this migration guide
- Open an issue in the repository
- Contact the development team
