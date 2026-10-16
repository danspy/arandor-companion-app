import { defineConfig } from 'drizzle-kit';
import { resolve } from 'node:path';

// drizzle-kit is for the local development database only (npm run db:dev).
// It must never point at a server database: live schema changes are reviewed
// SQL migrations, applied to preview first (see deploy/README.md).
const databaseFile = process.env.DATABASE_FILE || './data/dev.db';
if (resolve(databaseFile).startsWith('/srv/')) {
  throw new Error(`Refusing to use ${resolve(databaseFile)}: drizzle-kit is for local development databases only.`);
}

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dbCredentials: { url: `file:${databaseFile}` },
});
