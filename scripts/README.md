# Database Migration Scripts

This directory contains database migration scripts and server management tools.

## Database Migrations

### migrate-db.sql
SQL migration script that is run automatically during deployment.

When you deploy new code with database schema changes:

1. The `migrate-db.sql` script is synced to the production server
2. The deployment workflow runs the migration script against the production database
3. The migration uses `CREATE TABLE IF NOT EXISTS` to safely add new tables
4. Existing data is preserved - migrations only add missing tables/columns

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

These scripts are used by the GitHub Actions deployment workflow. The workflow:

1. Syncs the repository to the server
2. Runs `npm install` and `npm run build` on the server
3. Applies database migrations
4. Uses systemd commands directly to restart the service

The deployment workflow does not use the wrapper scripts anymore - it directly executes systemd commands with sudo. However, the wrapper scripts remain available for manual operations if needed.

## Important Notes

- Migrations are idempotent - safe to run multiple times
- Always use `IF NOT EXISTS` clauses to prevent errors
- Never delete or modify existing data in migrations
- Test migrations locally before deploying
- Keep migration scripts even after they've been deployed (for historical reference)
