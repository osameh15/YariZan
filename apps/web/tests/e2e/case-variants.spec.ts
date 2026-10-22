import { test, expect } from '@playwright/test';

// GHSA-vjh5-4x84-xrqp: page routing is case-insensitive, and Nitro routeRules could be skipped for
// letter-case variants. Protected pages and the API proxy must keep their cache, indexing and
// security headers for every variant, from the server middleware, not from routeRules alone.
const pages = [
  '/ACCOUNT',
  '/Account/',
  '/ZANYARI',
  '/ZanYari/products',
  '/CHECKOUT',
  '/Checkout?sku=YARIZAN-G1',
  '/PAYMENT/return',
  '/LOGIN',
  '/Connect',
  '/RESET-PASSWORD',
  '/Support-Reset',
];
const api: [string, string][] = [
  ['GET', '/API/v2/account'],
  ['GET', '/Api/V2/account/licenses'],
  ['GET', '/api/V2/admin/customers'],
  ['POST', '/API/v2/auth/login'],
  ['POST', '/api/v2/AUTH/OTP/request'],
];

function secure(headers: Record<string, string>, url: string) {
  expect(headers['cache-control'], url).toContain('no-store');
  expect(headers['x-robots-tag'], url).toBe('noindex, nofollow');
  expect(headers['x-content-type-options'], url).toBe('nosniff');
  expect(headers['x-frame-options'], url).toBe('DENY');
  expect(headers['referrer-policy'], url).toBe('no-referrer');
  expect(headers['content-security-policy'], url).toContain("frame-ancestors 'none'");
}

test('letter-case variants of protected pages are never cacheable or indexable', async ({
  request,
}) => {
  for (const url of pages) {
    const response = await request.get(url, {
      headers: { Accept: 'text/html' },
      maxRedirects: 0,
    });
    expect(response.status(), url).toBeLessThan(500);
    secure(response.headers(), url);
    // An anonymous visit never receives a session.
    expect(response.headers()['set-cookie'] ?? '', url).not.toMatch(/yz_(customer|admin)=/);
  }
});

test('letter-case variants of API paths never bypass the proxy allowlist or cache policy', async ({
  request,
}) => {
  for (const [method, url] of api) {
    const response = await request.fetch(url, {
      method,
      headers: {
        Origin: 'http://localhost:3200',
        Cookie: 'yz_customer=' + 'a'.repeat(43),
        'X-CSRF-Token': 'b'.repeat(43),
      },
      data: method === 'POST' ? { username: 'x', password: 'y' } : undefined,
    });
    // Never served as data: refused by the allowlist, authentication or as unknown.
    expect([401, 403, 404, 405], `${method} ${url}`).toContain(response.status());
    expect(response.headers()['cache-control'], url).toContain('no-store');
    expect(response.headers()['set-cookie'] ?? '', url).not.toMatch(/yz_(customer|admin)=/);
  }
});
