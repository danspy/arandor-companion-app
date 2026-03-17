import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import db from '@astrojs/db';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dotenv from 'dotenv';

dotenv.config();

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind(),
    db({
      storage: process.env.ASTRO_DATABASE_FILE || '/srv/arandor/data/content.db',
    })
  ],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [basicSsl()],
    server: { https: true },
  },
  security: {
    checkOrigin: false,
  },
  experimental: {
    clientPrerender: true,
  },
});
