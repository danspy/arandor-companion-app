import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import db from '@astrojs/db';
import node from '@astrojs/node';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  integrations: [
    tailwind(), 
    db({
      storage: '/srv/arandor/data/content.db', // set this path to your persistent server DB file!
    }),
    // Only enable PWA in production builds to avoid dev performance issues
    ...(process.env.NODE_ENV === 'production' ? [AstroPWA({
      base: '/',
      scope: '/',
      includeAssets: ['favicon.svg', 'map.png'],
      registerType: 'autoUpdate',
      manifest: {
        name: 'Arandor Companion App',
        short_name: 'Arandor',
        description: 'A modern D&D companion app for tracking your D&D adventures, characters, NPCs, locations, and more',
        theme_color: '#8b4545',
        background_color: '#8b5cf6',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Cache static assets only - don't cache HTML or API routes
        globPatterns: ['**/*.{css,js,svg,png,ico,txt,woff,woff2}'],
        // Don't use navigateFallback for SSR apps to prevent caching issues
        navigateFallback: undefined,
        // Simple runtime caching for external resources only
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })] : [])
  ],
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  experimental: {
    clientPrerender: true,
  },
});
