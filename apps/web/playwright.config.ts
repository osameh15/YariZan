import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 12000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3200',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'node tools/test-api.mjs',
      url: 'http://127.0.0.1:3100/ready',
      reuseExistingServer: false,
      timeout: 45000,
    },
    {
      command: 'node .output/server/index.mjs',
      url: 'http://localhost:3200',
      env: {
        PORT: '3200',
        HOST: '127.0.0.1',
        NUXT_WEB_ORIGIN: 'http://localhost:3200',
        NUXT_API_BASE: 'http://127.0.0.1:3100/api/v2/',
      },
      reuseExistingServer: false,
      timeout: 45000,
    },
  ],
});
