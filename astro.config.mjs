import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dotenv from 'dotenv';

dotenv.config();

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Astro 7 defaults to JSX-style whitespace stripping; keep the HTML-aware behaviour of Astro 6.
  compressHTML: true,
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [basicSsl(), tailwindcss()],
    server: { https: true },
  },
  security: {
    checkOrigin: false,
    // Domains Caddy forwards to the app. Without this, Astro ignores the Host and
    // X-Forwarded-* headers and Astro.url falls back to http://localhost:<port>.
    allowedDomains: [
      { hostname: 'arandor.app', protocol: 'https' },
      { hostname: 'www.arandor.app', protocol: 'https' },
      { hostname: 'future.arandor.app', protocol: 'https' },
    ],
  },
  experimental: {
    clientPrerender: true,
  },
});
