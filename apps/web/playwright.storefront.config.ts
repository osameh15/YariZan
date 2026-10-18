import { defineConfig } from '@playwright/test';
// Public storefront acceptance: the storefront build runs with no Backend, no PostgreSQL and
// no secrets, and shows only the owner-approved informational prices.
// A tripwire listens on the API port and records any request the website makes to it.
process.env.YARIZAN_PUBLIC_PROFILE = 'storefront';
export default defineConfig({
  testDir: './tests/brochure',
  outputDir: './test-results/storefront',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/storefront' }]],
  use: {
    baseURL: 'http://localhost:3201',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tests/brochure/tripwire.mjs',
      url: 'http://127.0.0.1:3101/tripwire',
      reuseExistingServer: false,
      timeout: 15000,
    },
    {
      command: 'node .output-storefront/server/index.mjs',
      url: 'http://localhost:3201/healthz',
      env: {
        PORT: '3201',
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        YARIZAN_SITE_MODE: 'storefront',
        NUXT_WEB_ORIGIN: 'http://localhost:3201',
        // Points at the tripwire: the storefront must never contact it.
        NUXT_API_BASE: 'http://127.0.0.1:3101/api/v2/',
      },
      reuseExistingServer: false,
      timeout: 45000,
    },
  ],
});
