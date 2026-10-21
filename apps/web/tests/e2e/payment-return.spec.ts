import { test, expect } from '@playwright/test';
import { sql } from '../../tools/test-fixtures.mjs';

// The Nuxt /payment/return handler against the real Backend. An authority that passes the web
// validation is forwarded to the Backend (which counts the request in its rate bucket and answers
// "unknown authority"); one that fails never leaves the web layer. Both end in a 400 for the browser,
// so the Backend bucket count is what proves which layer decided.
const forwarded = async () =>
  Number((await sql('SELECT COALESCE(sum(count),0)::int n FROM rate_buckets')).rows[0].n);
const get = (request: import('@playwright/test').APIRequestContext, authority: string) =>
  request.get('/payment/return?Authority=' + encodeURIComponent(authority) + '&Status=OK', {
    maxRedirects: 0,
  });

test('real 36-character production and sandbox authorities reach the Backend; malformed ones never do', async ({
  request,
}) => {
  const accepted = ['A' + '0'.repeat(35), 'S' + '0'.repeat(35), 'A' + '1'.repeat(32)];
  for (const authority of accepted) {
    await sql('DELETE FROM rate_buckets');
    const response = await get(request, authority);
    expect(response.status(), authority).toBe(400); // unknown to the Backend, so no order is revealed
    expect(await forwarded(), 'forwarded to the Backend: ' + authority).toBeGreaterThan(0);
  }
  const rejected = [
    'A' + '0'.repeat(31),
    'A' + '0'.repeat(41),
    'B' + '0'.repeat(35),
    'A' + '0'.repeat(34) + '/',
    'A' + '0'.repeat(34) + '%2F',
  ];
  for (const authority of rejected) {
    await sql('DELETE FROM rate_buckets');
    const response = await get(request, authority);
    expect(response.status(), authority).toBe(400);
    expect(await forwarded(), 'rejected by the web layer: ' + authority).toBe(0);
  }
  const missing = await request.get('/payment/return', { maxRedirects: 0 });
  expect(missing.status()).toBe(400);
});
