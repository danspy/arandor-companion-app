import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import db from '@astrojs/db';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config();

// Astro DB recreates this file on `astro build`, `astro dev` and `astro db`.
// Default to a throwaway local file and refuse any database on the server.
const databaseFile = process.env.ASTRO_DATABASE_FILE || './data/dev.db';
if (resolve(databaseFile).startsWith('/srv/')) {
  throw new Error(
    `Refusing to use ${resolve(databaseFile)}: astro build/dev/db would recreate it. ` +
    'Build in CI or on your own machine, never on the server.'
  );
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    db({
      storage: databaseFile,
    })
  ],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [basicSsl(), tailwindcss()],
    server: { https: true },
  },
  security: {
    checkOrigin: false,
  },
  experimental: {
    clientPrerender: true,
  },
});
