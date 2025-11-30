import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import db from '@astrojs/db';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind(), 
    db({
      storage: '/srv/arandor/data/content.db', // set this path to your persistent server DB file!
    })
  ],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
});
