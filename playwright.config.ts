import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4323',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'ASTRO_DATABASE_FILE=./data/content.db HOST=0.0.0.0 PORT=4323 node dist/server/entry.mjs',
    url: 'http://localhost:4323',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
