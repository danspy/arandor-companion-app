// Database client. Replaces the former `astro:db` virtual module with the same exports.
//
// The database file is opened relative to the process working directory, which systemd
// sets per environment (/srv/arandor for live, /srv/arandor-preview for preview).
// DATABASE_FILE overrides it, e.g. for tests.

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as schema from './schema';

const file = process.env.DATABASE_FILE || (import.meta.env?.DEV ? './data/dev.db' : './data/content.db');

export const db = drizzle(createClient({ url: pathToFileURL(resolve(file)).href }), { schema });

export * from './schema';
export { and, eq, inArray, isNull, sql } from 'drizzle-orm';
