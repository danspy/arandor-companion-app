# Database Migration and Deployment Scripts

This directory contains database migration scripts and server management tools.

## Overview

**Important:** Database migrations are **MANUAL ONLY**. The deployment workflow never touches your production database automatically.

## Database Update Script

### update-database.sh

**Purpose:** Interactive script for manually updating the production database schema.

**When to use:**
- On first deployment to create the initial database
- When pulling code that includes database schema changes (new tables or columns)
- NEVER run automatically - always manual and explicit

**Features:**
- Interactive prompts with safety confirmations
- Automatic timestamped backups before changes
- Dry-run mode to preview changes
- Data integrity verification
- Shows before/after state

**Usage:**
```bash
# Preview what will happen (no changes made)
./scripts/update-database.sh --dry-run

# Apply database migration (interactive prompts)
./scripts/update-database.sh
```

**What it does:**
1. Checks if database exists
2. Shows current database state (tables, data count)
3. Asks for confirmation
4. Creates timestamped backup in `.astro/backups/`
5. Applies migration from `migrate-db.sql`
6. Verifies data integrity
7. Shows updated state

## Database Migrations

### migrate-db.sql

SQL migration script containing the database schema. This script is run **manually** using `update-database.sh`.

**Important:** Database migrations are never run automatically during deployment. You must manually run migrations when schema changes are needed.

### Adding New Migrations

When you add new tables or columns to `db/config.ts`:

1. Update `migrate-db.sql` to include the new schema changes
2. Use `CREATE TABLE IF NOT EXISTS` for new tables
3. Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` for new columns (SQLite 3.35.0+)
4. Test the migration locally first:
   ```bash
   sqlite3 /path/to/content.db < scripts/migrate-db.sql
   ```

### Testing Migrations Locally

To test a migration on a local database:

```bash
# Create a test database
cp .astro/content.db /tmp/test.db

# Run the migration
sqlite3 /tmp/test.db < scripts/migrate-db.sql

# Verify the changes
sqlite3 /tmp/test.db ".schema"
```

## Server Management Scripts

These scripts are designed to be installed on the production server to enable automated deployments.

### arandor-deploy-restart

**Purpose:** Wrapper script for restarting the Arandor systemd service during deployment.

**Installation:**
```bash
# On server as root
sudo cp /srv/arandor/scripts/arandor-deploy-restart /usr/local/sbin/
sudo chmod 755 /usr/local/sbin/arandor-deploy-restart
```

**Sudoers Configuration:**
Create `/etc/sudoers.d/arandor-deploy` with:
```
deploy ALL=(ALL) NOPASSWD: /usr/local/sbin/arandor-deploy-restart
deploy ALL=(ALL) NOPASSWD: /usr/local/sbin/arandor-deploy-status
```

**What it does:**
- Reloads systemd daemon
- Enables the arandor.service
- Restarts the arandor.service

**Usage:**
```bash
sudo /usr/local/sbin/arandor-deploy-restart
```

### arandor-deploy-status

**Purpose:** Wrapper script for checking the status of the Arandor systemd service.

**Installation:**
```bash
# On server as root
sudo cp /srv/arandor/scripts/arandor-deploy-status /usr/local/sbin/
sudo chmod 755 /usr/local/sbin/arandor-deploy-status
```

**What it does:**
- Shows the current status of arandor.service

**Usage:**
```bash
sudo /usr/local/sbin/arandor-deploy-status
```

## Automated Deployment Integration

The GitHub Actions deployment workflow (`../.github/workflows/deploy-production.yml`) does NOT run database migrations.

The workflow only:
1. Syncs code to the server (excluding `.astro/` directory)
2. Builds in a temporary directory with a temporary database
3. Copies compiled `dist/` to production
4. Ensures database directory exists (but never touches the database file)
5. Restarts the service

**Database migrations must be run manually** using the `update-database.sh` script when needed.

## Important Notes

- Migrations are idempotent - safe to run multiple times
- Always use `IF NOT EXISTS` clauses to prevent errors
- Never delete or modify existing data in migrations
- Test migrations locally before deploying
- Keep migration scripts even after they've been deployed (for historical reference)
