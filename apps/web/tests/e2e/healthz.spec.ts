import { test, expect } from '@playwright/test';

// The infrastructure health checker must not depend on Backend/DB availability.
test('Nuxt healthz serves plain text without cacheable content', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('ok');
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['content-type']).toMatch(/^text\/plain\b/i);
});
