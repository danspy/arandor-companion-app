import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dotenv from 'dotenv';

dotenv.config();

// https://astro.build/config
export default defineConfig({
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
