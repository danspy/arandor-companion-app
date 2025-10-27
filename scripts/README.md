# Database Migration Scripts

This directory contains database migration scripts that are run automatically during deployment.

## How Migrations Work

When you deploy new code with database schema changes:

1. The `migrate-db.sql` script is synced to the production server
2. The deployment workflow runs the migration script against the production database
3. The migration uses `CREATE TABLE IF NOT EXISTS` to safely add new tables
4. Existing data is preserved - migrations only add missing tables/columns

## Current Migrations

### migrate-db.sql
Adds the `LibraryEntry` table introduced in the markdown library feature.

## Adding New Migrations

When you add new tables or columns to `db/config.ts`:

1. Update `migrate-db.sql` to include the new schema changes
2. Use `CREATE TABLE IF NOT EXISTS` for new tables
3. Use `ALTER TABLE ADD COLUMN IF NOT EXISTS` for new columns (SQLite 3.35.0+)
4. Test the migration locally first:
   ```bash
   sqlite3 /path/to/content.db < scripts/migrate-db.sql
   ```

## Testing Migrations Locally

To test a migration on a local database:

```bash
# Create a test database
cp .astro/content.db /tmp/test.db

# Run the migration
sqlite3 /tmp/test.db < scripts/migrate-db.sql

# Verify the changes
sqlite3 /tmp/test.db ".schema"
```

## Important Notes

- Migrations are idempotent - safe to run multiple times
- Always use `IF NOT EXISTS` clauses to prevent errors
- Never delete or modify existing data in migrations
- Test migrations locally before deploying
- Keep migration scripts even after they've been deployed (for historical reference)
