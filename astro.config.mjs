import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dotenv from 'dotenv';

dotenv.config();

// Set by the arandor-dev service: `astro dev` runs behind Caddy on https://dev.arandor.app
// (see deploy/README.md). Caddy terminates TLS, so the dev server speaks plain HTTP and the
// browser's live-reload connection goes back through Caddy on port 443.
const devPublicHost = process.env.DEV_PUBLIC_HOST;

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Astro 7 defaults to JSX-style whitespace stripping; keep the HTML-aware behaviour of Astro 6.
  compressHTML: true,
  // The dev toolbar is for local development; on dev.arandor.app it only covers the page.
  devToolbar: { enabled: !devPublicHost },
  adapter: node({
    mode: 'standalone'
  }),
  vite: {
    plugins: [...(devPublicHost ? [] : [basicSsl()]), tailwindcss()],
    // Pre-bundle client libraries at dev-server start; discovering them on first use
    // made the browser request a stale bundle (504 "Outdated Optimize Dep").
    optimizeDeps: { include: ['@3d-dice/dice-box', 'marked'] },
    server: devPublicHost
      ? { allowedHosts: [devPublicHost], ws: { protocol: 'wss', host: devPublicHost, clientPort: 443 } }
      : { https: true },
  },
  security: {
    checkOrigin: false,
    // Domains Caddy forwards to the app. Without this, Astro ignores the Host and
    // X-Forwarded-* headers and Astro.url falls back to http://localhost:<port>.
    allowedDomains: [
      { hostname: 'arandor.app', protocol: 'https' },
      { hostname: 'www.arandor.app', protocol: 'https' },
      { hostname: 'future.arandor.app', protocol: 'https' },
      { hostname: 'dev.arandor.app', protocol: 'https' },
    ],
  },
  experimental: {
    clientPrerender: true,
  },
});
