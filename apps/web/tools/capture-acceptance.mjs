// Local visual acceptance: sanitized full-page screenshots of the running local stack at 1440, 768
// and 390 px, plus measured QA per page (horizontal overflow, axe WCAG 2 A/AA, document language and
// direction, fonts, Latin digits in Persian text, visible keyboard focus).
//
// Local only. Synthetic identities come from the environment and are never written to the output:
//   SHOTS_BASE (default http://localhost:3200), SHOTS_CUSTOMER_USER, SHOTS_CUSTOMER_PASSWORD,
//   SHOTS_ADMIN_USER, SHOTS_ADMIN_PASSWORD, SHOTS_API_CONTAINER (default yarizan-v2-local-api-1)
// Output: apps/web/.local/screenshots/acceptance-<date>/ (git-ignored) with index.json and index.md.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = new URL(process.env.SHOTS_BASE ?? 'http://localhost:3200');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Local stack only');
const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} (synthetic, local only)`);
  return value;
};
const day = new Date().toISOString().slice(0, 10);
const out = path.resolve(process.env.SHOTS_OUT ?? `.local/screenshots/acceptance-${day}`);
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const results = [];

/** Latest synthetic SMS code from the local fake provider (never a real SMS). */
async function fakeSmsCode() {
  for (let n = 0; n < 30; n++) {
    const text = execFileSync(
      'docker',
      [
        'exec',
        process.env.SHOTS_API_CONTAINER ?? 'yarizan-v2-local-api-1',
        'node',
        'dist/src/accounts/read-fake-sms.js',
      ],
      { encoding: 'utf8' },
    );
    const code = text.match(/code ([0-9]{6})/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('No synthetic code available');
}

async function measure(page) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const facts = await page.evaluate(() => {
    const doc = document.documentElement;
    const persian = /[؀-ۿ]/;
    let latinDigits = 0;
    const samples = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      const el = n.parentElement;
      if (!el || !/[0-9]/.test(text) || !persian.test(text)) continue;
      if (el.closest('[dir=ltr],code,kbd,script,style,bdi[dir=ltr],.sr-only')) continue;
      if (getComputedStyle(el).display === 'none') continue;
      latinDigits++;
      if (samples.length < 3) samples.push(text.trim().slice(0, 60));
    }
    const fonts = [
      ...new Set(
        [...document.fonts]
          .filter((f) => f.status === 'loaded')
          .map((f) => f.family.replace(/"/g, '')),
      ),
    ];
    return {
      lang: doc.lang,
      dir: doc.dir,
      overflow_px: Math.max(0, doc.scrollWidth - doc.clientWidth),
      body_font: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g, '').trim(),
      fonts_loaded: fonts,
      latin_digits_in_persian_text: latinDigits,
      latin_digit_samples: samples,
      title: document.title,
    };
  });
  // First keyboard stop: something receives focus and shows a visible indicator.
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { focusable: false, visible: false };
    const s = getComputedStyle(el);
    const visible =
      (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
      (s.boxShadow && s.boxShadow !== 'none');
    return { focusable: true, visible: Boolean(visible), element: el.tagName.toLowerCase() };
  });
  return {
    ...facts,
    focus,
    axe: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  };
}

async function shoot(page, viewport, name) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(250);
  const file = `${viewport.name}-${name}.png`;
  await page.screenshot({ path: path.join(out, file), fullPage: true, animations: 'disabled' });
  const facts = await measure(page);
  results.push({
    viewport: viewport.width,
    page: name,
    path: new URL(page.url()).pathname,
    file,
    ...facts,
  });
  console.log(
    viewport.width,
    name,
    facts.overflow_px ? `overflow ${facts.overflow_px}px` : 'ok',
    facts.axe.length ? `axe ${facts.axe.map((a) => a.id).join(',')}` : '',
  );
}

async function customerLogin(page) {
  await page.goto(new URL('/login', base).href);
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(env('SHOTS_CUSTOMER_USER'));
  await page.getByLabel('رمز عبور', { exact: true }).fill(env('SHOTS_CUSTOMER_PASSWORD'));
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await page.waitForURL(/\/account$/);
}

async function adminLogin(page, viewport) {
  await page.goto(new URL('/zanyari/login', base).href);
  await page.getByLabel('نام کاربری مدیریت').fill(env('SHOTS_ADMIN_USER'));
  await page.getByLabel('رمز عبور', { exact: true }).fill(env('SHOTS_ADMIN_PASSWORD'));
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/v2/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const status = (await sent).status();
  if (status !== 201) throw new Error(`Admin login step answered ${status}`);
  await shoot(page, viewport, 'admin-mfa-step');
  await page.getByLabel('کد تأیید پیامکی').fill(await fakeSmsCode());
  await page.getByRole('button', { name: 'تأیید کد و ورود' }).click();
  await page.waitForURL(/\/zanyari$/);
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      locale: 'fa-IR',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const go = async (route, name) => {
      await page.goto(new URL(route, base).href);
      await shoot(page, viewport, name);
    };
    // Public pages and Persian error states.
    await go('/', 'home');
    await go('/products', 'products');
    const product = await page.locator('a[href^="/products/"]').first().getAttribute('href');
    if (product) await go(product, 'product-detail');
    await go('/download', 'download-grade-selector');
    await go('/support', 'support');
    for (const legal of [
      '',
      '/terms',
      '/privacy',
      '/refund',
      '/delivery',
      '/disputes',
      '/merchant-info',
    ])
      await go('/legal' + legal, 'legal' + (legal ? '-' + legal.slice(1) : ''));
    await go('/connect', 'connect');
    await go('/reset-password', 'reset-password');
    await go('/login', 'login-otp');
    await page.locator('form button[type=submit],form .button.primary').last().click();
    await shoot(page, viewport, 'login-validation-error');
    await go('/not-a-real-page', 'not-found');
    await go('/checkout?sku=YARIZAN-G1', 'checkout-signed-out');

    // Customer account, checkout and order states.
    await customerLogin(page);
    await shoot(page, viewport, 'account-overview');
    for (const section of ['orders', 'licenses', 'security'])
      await go('/account/' + section, 'account-' + section);
    await go('/checkout?sku=YARIZAN-G1', 'checkout');
    // One synthetic, unpaid order (no payment is started) so the order page has content.
    let orders = await page.request.get(new URL('/api/v2/orders', base).href);
    if (viewport === viewports[0] && !(await orders.json()).items?.length) {
      await page.locator('.checkout-submit').click();
      await page.waitForURL((u) => !u.pathname.startsWith('/checkout'));
      orders = await page.request.get(new URL('/api/v2/orders', base).href);
    }
    const order = (await orders.json()).items?.[0];
    if (order) await go('/payment/result?order=' + order.id, 'order-' + order.state.toLowerCase());
    await context.clearCookies();
    await go('/zanyari', 'admin-signed-out');
    await context.close();
  }

  // Protected Admin: one password + SMS MFA login (the SMS cooldown allows one code per minute),
  // then every viewport reuses that session while the MFA is recent (5 minutes).
  const login = await browser.newContext({ viewport: viewports[0], locale: 'fa-IR' });
  const loginPage = await login.newPage();
  await adminLogin(loginPage, viewports[0]);
  const state = await login.storageState();
  await login.close();
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      locale: 'fa-IR',
      reducedMotion: 'reduce',
      storageState: state,
    });
    const page = await context.newPage();
    const go = async (route, name) => {
      await page.goto(new URL(route, base).href);
      await shoot(page, viewport, name);
    };
    await go('/zanyari', 'admin-dashboard');
    for (const section of [
      'products',
      'customers',
      'devices',
      'licenses',
      'trials',
      'activation-codes',
      'audit',
    ])
      await go('/zanyari/' + section, 'admin-' + section);
    await go('/zanyari/commerce', 'admin-commerce');
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(path.join(out, 'index.json'), JSON.stringify(results, null, 2));
const row = (r) =>
  `| ${r.viewport} | ${r.page} | ${r.overflow_px} | ${r.axe.map((a) => `${a.id}(${a.nodes})`).join(' ') || '0'} | ${r.lang}/${r.dir} | ${r.body_font} | ${r.latin_digits_in_persian_text} | ${r.focus.focusable ? (r.focus.visible ? 'visible' : 'NOT visible') : 'none'} | ${r.file} |`;
await writeFile(
  path.join(out, 'index.md'),
  [
    `# Local visual acceptance ${day}`,
    '',
    '| Width | Page | Overflow px | Axe violations | lang/dir | Body font | Latin digits in Persian text | First focus | File |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map(row),
    '',
  ].join('\n'),
);
console.log(`\n${results.length} screenshots: ${out}`);
