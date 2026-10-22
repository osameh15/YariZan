import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { stubEnamadSeal } from '../support/third-party';

// Acceptance for the public-only builds (brochure and storefront). The server runs without
// Backend, PostgreSQL, SMS, payment or signing configuration; see playwright.brochure.config.ts
// and playwright.storefront.config.ts. The storefront additionally shows approved prices.
const profile = process.env.YARIZAN_PUBLIC_PROFILE === 'storefront' ? 'storefront' : 'brochure';
const storefront = profile === 'storefront';
const images = path.resolve('.local/screenshots/' + profile);
const publicPages = [
  '/',
  '/products',
  '/products/grade-1',
  '/products/grade-4',
  '/support',
  '/download',
  '/legal',
  '/legal/privacy',
  '/legal/terms',
  '/legal/refund',
  '/legal/delivery',
  '/legal/disputes',
  '/legal/merchant-info',
];
const disabledPages = [
  '/account',
  '/account/orders',
  '/account/orders/00000000-0000-4000-8000-000000000000',
  '/login',
  '/connect',
  '/zanyari',
  '/zanyari/login',
  '/zanyari/commerce',
  '/checkout',
  '/checkout?sku=YARIZAN-G1',
  '/payment/result',
  '/payment/simulate',
  '/payment/return?Authority=A00000000000000000000000000000000',
  '/reset-password',
  '/support-reset',
  '/ACCOUNT',
];
const disabledApi: [string, string][] = [
  ['POST', '/api/v2/auth/login'],
  ['POST', '/api/v2/auth/claim'],
  ['POST', '/api/v2/auth/otp/request'],
  ['POST', '/api/v2/auth/claim/otp/request'],
  ['POST', '/api/v2/admin/auth/login'],
  ['GET', '/api/v2/admin/customers'],
  ['GET', '/api/v2/account'],
  ['GET', '/api/v2/account/licenses'],
  ['GET', '/api/v2/products'],
  ['GET', '/api/v2/commerce/capabilities'],
  ['POST', '/api/v2/orders'],
  ['POST', '/api/v2/discounts/quote'],
  ['POST', '/api/v2/device-pairings/00000000-0000-4000-8000-000000000000/confirm'],
  // Desktop routes: in Stage A these reach the website, never an API container.
  ['POST', '/api/v2/devices/challenges'],
  ['POST', '/api/v2/devices/authenticate'],
  ['POST', '/api/v2/device-pairings'],
  ['POST', '/api/v2/device-pairings/00000000-0000-4000-8000-000000000000/pickup'],
  ['POST', '/api/v2/desktop/trials/YARIZAN-G1/start'],
  ['GET', '/api/v2/desktop/trials/YARIZAN-G1/status'],
  ['POST', '/api/v2/desktop/licenses/pickup'],
  ['POST', '/api/v2/desktop/licenses/sync'],
  ['POST', '/api/v2/desktop/activation-codes/redeem'],
  ['GET', '/api/v2/desktop/entitlements'],
  ['DELETE', '/api/v2/account'],
  ['OPTIONS', '/api/v2/auth/login'],
  ['GET', '/api'],
  ['GET', '/API/V2/products'],
  ['GET', '/api/v2/%2e%2e/products'],
];
const bypasses = [
  '/products/',
  '/support/',
  '/products/yarizan-g1',
  '/products/grade-7',
  '/Support',
  '//account',
  '/./account',
  '/%61ccount',
  '/products%2fgrade-1',
  '/products/..%2f..%2faccount',
  '/__nuxt_error',
  '/_payload.json',
  '/healthz/',
];

// Third-party seal requests are answered locally so these tests never depend on that host.
test.beforeEach(async ({ page }) => {
  await stubEnamadSeal(page);
});

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration/i.test(message.text()))
      problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}
async function shot(page: Page, name: string) {
  await mkdir(images, { recursive: true });
  await page.screenshot({ path: path.join(images, name + '.png'), fullPage: true });
}

test('public pages render in Persian RTL with no API, console errors or broken links', async ({
  page,
}) => {
  const problems = watchConsole(page);
  for (const url of publicPages) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.brochure-notice[role="note"]')).toContainText(
      storefront ? 'قیمت‌ها رسمی و به تومان است' : 'برای تهیه و فعال‌سازی برنامه',
    );
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    for (const href of hrefs)
      expect(href, `${url} links to a disabled route`).not.toMatch(
        /^\/(?:account|login|connect|zanyari|checkout|payment|reset-password|support-reset)/,
      );
    for (const font of ['Shabnam', 'Shabnam-Bold'])
      await expect(
        page.locator(`link[rel="preload"][as="font"][href="/fonts/${font}.woff2"]`),
      ).toHaveCount(1);
    const html = await page.content();
    for (const secret of ['3101', 'apiBase', 'NUXT_API', 'local-disposable', 'PRIVATE KEY'])
      expect(html, `${url} exposes ${secret}`).not.toContain(secret);
  }
  expect(problems).toEqual([]);
});

test('catalog shows six grades, Grade 1 information and Coming Soon without live checkout', async ({
  page,
}) => {
  await page.goto('/products');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await expect(page.locator('.product-card.coming-soon')).toHaveCount(5);
  if (storefront) {
    // Every grade shows the approved price; availability is shown separately from price.
    await expect(page.locator('.product-card .price')).toHaveText(Array(6).fill('۱٬۲۹۹٬۰۰۰ تومان'));
    await expect(page.locator('.product-card .badge').first()).toHaveText('تهیه از راه پشتیبانی');
    await expect(page.locator('.product-card.coming-soon .badge')).toHaveText(
      Array(5).fill('به‌زودی'),
    );
  } else {
    await expect(page.getByText('قیمت هنگام آغاز فروش اعلام می‌شود').first()).toBeVisible();
    await expect(page.getByText('تومان')).toHaveCount(0);
  }
  await page.goto('/products/grade-1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('یاریزان پایه اول دبستان');
  await expect(page.getByText(storefront ? 'تهیه از راه پشتیبانی' : 'معرفی محصول')).toBeVisible();
  if (storefront) await expect(page.locator('.detail-price')).toHaveText('۱٬۲۹۹٬۰۰۰ تومان');
  await expect(page.getByText('برای تهیه و فعال‌سازی این پایه')).toBeVisible();
  await expect(page.getByRole('link', { name: /خرید/ })).toHaveCount(0);
  await page.goto('/products/grade-3');
  await expect(page.getByText('این پایه هنوز عرضه نشده است.')).toBeVisible();
  if (storefront) await expect(page.locator('.detail-price')).toHaveText('۱٬۲۹۹٬۰۰۰ تومان');
});

test('disabled pages return a Persian 503 page that is never cached', async ({ request }) => {
  for (const url of disabledPages) {
    const response = await request.get(url, { headers: { Accept: 'text/html' } });
    expect(response.status(), url).toBe(503);
    expect(response.headers()['cache-control'], url).toBe('no-store');
    expect(response.headers()['retry-after'], url).toBe('3600');
    expect(response.headers()['content-type'], url).toMatch(/^text\/html/);
    expect(await response.text(), url).toContain('این بخش در این نسخهٔ سایت در دسترس نیست.');
  }
});

test('every API call fails closed with the shared 503 JSON contract', async ({ request }) => {
  for (const [method, url] of disabledApi) {
    const response = await request.fetch(url, {
      method,
      headers: {
        Origin: 'http://localhost:3201',
        Cookie: 'yz_customer=' + 'a'.repeat(43),
        'X-CSRF-Token': 'b'.repeat(43),
        Authorization: 'Bearer ' + 'c'.repeat(43),
      },
      data: method === 'GET' || method === 'OPTIONS' ? undefined : { username: 'x' },
    });
    expect(response.status(), `${method} ${url}`).toBe(503);
    expect(response.headers()['content-type'], url).toMatch(/^application\/json/);
    expect(response.headers()['cache-control'], url).toBe('no-store');
    expect(response.headers()['retry-after'], url).toBe('3600');
    expect(response.headers()['set-cookie'], url).toBeUndefined();
    expect(await response.json(), url).toEqual({ error: { code: 'SERVICE_UNAVAILABLE' } });
  }
});

test('path aliases, encodings and trailing slashes do not bypass the allowlist', async ({
  request,
}) => {
  for (const url of bypasses) {
    // Absolute string: a relative "//account" would otherwise become a different host.
    const response = await request.get('http://localhost:3201' + url, {
      headers: { Accept: 'text/html' },
    });
    expect([404, 503], url).toContain(response.status());
    expect(response.headers()['cache-control'], url).toBe('no-store');
  }
  for (const url of ['/', '/products', '/support']) {
    const response = await request.post(url, { data: {} });
    expect(response.status(), url).toBe(405);
    expect(response.headers()['allow']).toBe('GET, HEAD');
  }
  const head = await request.head('/products');
  expect(head.status()).toBe(200);
});

test('unknown pages return a Persian 404 with correct status', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('این صفحه پیدا نشد.');
});

test('healthz satisfies the infrastructure contract without dependencies', async ({ request }) => {
  const response = await request.get('/healthz');
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('ok');
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['content-type']).toMatch(/^text\/plain/);
});

test('security headers and cache policy are present on public pages', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();
  expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['set-cookie']).toBeUndefined();
});

test('restrictions hold with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  expect((await page.goto('/checkout'))?.status()).toBe(503);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'این بخش در این نسخهٔ سایت در دسترس نیست.',
  );
  expect((await page.goto('/products'))?.status()).toBe(200);
  await expect(page.locator('.product-card')).toHaveCount(6);
  await context.close();
});

test('client-side navigation to a disabled route is refused', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#__nuxt'));
  await page.evaluate(() => {
    const app = (
      document.querySelector('#__nuxt') as unknown as {
        __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => void } } } };
      }
    ).__vue_app__;
    app.config.globalProperties.$router.push('/account');
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'این بخش در این نسخهٔ سایت در دسترس نیست.',
  );
  expect(problems.filter((p) => !/503|Service Unavailable/.test(p))).toEqual([]);
});

test('public pages pass automated accessibility checks', async ({ page }) => {
  for (const url of publicPages) {
    await page.goto(url);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations, url).toEqual([]);
  }
});

test('mobile layout has no horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const url of publicPages) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await context.close();
});

test(`screenshots of the ${profile} website at desktop and mobile widths`, async ({ browser }) => {
  for (const [label, viewport] of [
    ['1440', { width: 1440, height: 1000 }],
    ['390', { width: 390, height: 844 }],
  ] as const) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const [name, url] of [
      ['home', '/'],
      ['catalog', '/products'],
      ['grade-1', '/products/grade-1'],
      ['grade-2', '/products/grade-2'],
      ['support', '/support'],
      ['disabled-checkout', '/checkout'],
      ['disabled-account', '/login'],
      ['disabled-admin', '/zanyari'],
      ['healthz', '/healthz'],
    ]) {
      await page.goto(url);
      await shot(page, `${name}-${label}`);
    }
    await context.close();
  }
});

test('first deployment is noindex: robots.txt disallows all and every page sends X-Robots-Tag', async ({
  request,
}) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe(['User-agent: *', 'Disallow: /', ''].join('\n'));
  for (const url of ['/', '/products', '/products/grade-1', '/support', '/checkout'])
    expect((await request.get(url)).headers()['x-robots-tag'], url).toBe('noindex, nofollow');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap.match(/<loc>/g)).toHaveLength(9);
  expect(sitemap).not.toMatch(/account|zanyari|checkout|payment|login/);
});

// Must stay last: proves the website never contacted the API port during the suite.
test('no request ever reached the API port', async ({ request }) => {
  const report = await (await request.get('http://127.0.0.1:3101/tripwire')).json();
  expect(report).toEqual({ hits: 0, paths: [] });
});
