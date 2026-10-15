import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  customer,
  pairing,
  proof,
  call,
  admin,
  issue,
  password,
  sql,
  smsCode,
  nextMobile,
} from '../../tools/test-fixtures.mjs';
const images = path.resolve('../../docs/Images/phase3-1');
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir(images, { recursive: true });
  await page.screenshot({
    path: path.join(images, name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
}
async function customerLogin(page: import('@playwright/test').Page, username: string) {
  await page.goto('/login');
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'نمای کلی', exact: true })).toBeVisible();
}
async function adminLogin(page: import('@playwright/test').Page, role = 'owner') {
  const a = await admin(role);
  await page.goto('/zanyari/login');
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/v2/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const challenge = await (await sent).json();
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(challenge.challenge_id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
  await expect(page.getByRole('heading', { name: 'نمای کلی', exact: true })).toBeVisible();
  return a;
}

test('Persian SSR homepage and real six-grade catalog', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('بازی می‌کنیم');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await capture(page, '01-homepage');
  await page.goto('/products');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await expect(page.locator('.product-card .badge').filter({ hasText: 'به‌زودی' })).toHaveCount(5);
  await expect(page.locator('.price').first()).toContainText('۱٬۲۹۹٬۰۰۰');
  await capture(page, '02-catalog');
  await page.goto('/products/grade-1');
  await expect(page.getByRole('button', { name: 'راهنمای تهیهٔ این نسخه' })).toBeVisible();
  await capture(page, '03-grade-one');
  await page.getByRole('button', { name: 'راهنمای تهیهٔ این نسخه' }).click();
  await expect(page.getByRole('dialog', { name: 'راهنمای تهیهٔ یاریزان' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('هیچ خرید یا پرداختی ثبت نمی‌کند');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'راهنمای تهیهٔ این نسخه' })).toBeFocused();
  await page.goto('/products/grade-2');
  await expect(page.getByText('این پایه هنوز عرضه نشده است.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'راهنمای تهیهٔ این نسخه' })).toHaveCount(0);
});

test('Catalog reflects backend price updates without rebuilding', async ({ page }) => {
  await sql(
    "UPDATE product_prices SET amount_irr=15000000 WHERE sku='YARIZAN-G1' AND ended_at IS NULL",
  );
  try {
    await page.goto('/products');
    await expect(page.locator('.price').first()).toContainText('۱٬۵۰۰٬۰۰۰');
  } finally {
    await sql(
      "UPDATE product_prices SET amount_irr=12990000 WHERE sku='YARIZAN-G1' AND ended_at IS NULL",
    );
  }
});

test('Browser approves pairing but never receives device enrollment or bearer', async ({
  page,
}) => {
  const p = await pairing();
  const bodies: string[] = [];
  page.on('response', async (response) => {
    if (response.url().includes('/api/v2/')) {
      try {
        bodies.push(await response.text());
      } catch {
        /* Cancelled responses have no body. */
      }
    }
  });
  await page.goto('/connect');
  await page.getByLabel('شناسهٔ درخواست', { exact: true }).fill(p.pairing_id);
  await page.getByLabel('کد موقت اتصال').fill(p.pairing_secret);
  await page.getByRole('button', { name: 'بررسی درخواست' }).click();
  await expect(page.getByRole('heading', { name: /راه‌اندازی حساب|تأیید پروفایل/ })).toBeVisible();
  await capture(page, '04-connect');
  await page.getByLabel('شمارهٔ همراه', { exact: true }).fill(nextMobile());
  const sentOtp = page.waitForResponse((r) => r.url().endsWith('/api/v2/auth/claim/otp/request'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const otp = await (await sentOtp).json();
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(otp.challenge_id));
  await page.getByRole('button', { name: 'تأیید شماره و اتصال' }).click();
  await expect(page.getByRole('heading', { name: 'اتصال در مرورگر تأیید شد' })).toBeVisible();
  expect(bodies.join('\n')).not.toMatch(
    /"(?:credential|enrollment|claim_grant|browser_token|private_key)"/,
  );
  const picked = await call(
    `/device-pairings/${p.pairing_id}/pickup`,
    await proof(p.key, 'CONFIRM', p.pairing_id),
  );
  expect(picked.status).toBe(201);
  expect(picked.body.enrollment.payload.device_fingerprint_digest).toBe(p.key.fingerprint);
  expect(
    (
      await call('/auth/claim', {
        pairing_id: p.pairing_id,
        pairing_secret: p.pairing_secret,
        password,
      })
    ).status,
  ).toBe(410);
});

test('Expired pairing and forged desktop proof cannot provision', async ({ page }) => {
  const p = await pairing();
  await sql("UPDATE pairings SET expires_at=now()-interval '1 second' WHERE id=$1", [p.pairing_id]);
  await page.goto('/connect');
  await page.getByLabel('شناسهٔ درخواست', { exact: true }).fill(p.pairing_id);
  await page.getByLabel('کد موقت اتصال').fill(p.pairing_secret);
  await page.getByRole('button', { name: 'بررسی درخواست' }).click();
  await expect(page.getByRole('alert')).toContainText('منقضی');
  const other = await pairing(),
    signed = await proof(other.key, 'CONFIRM', other.pairing_id);
  signed.challenge_signature = 'A'.repeat(86);
  expect((await call(`/device-pairings/${other.pairing_id}/pickup`, signed)).status).toBe(401);
});

test('Customer login, real ownership, session rotation, logout and SSR isolation', async ({
  page,
  request,
}) => {
  const e = await customer();
  await issue(e);
  await customerLogin(page, e.username);
  await capture(page, '05-customer-dashboard');
  await page.getByRole('link', { name: 'محصولات و مجوزها', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'یاریزان پایهٔ اول', exact: true })).toBeVisible();
  await expect(page.getByText('مجوز فعال', { exact: true })).toBeVisible();
  const html = await (await page.request.get('/account/licenses')).text();
  expect(html).not.toContain(e.username);
  expect(html).not.toContain(e.credential);
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'تازه‌سازی ورود در این مرورگر' }).click();
  await expect(page.getByRole('status')).toContainText('ورود در این مرورگر تازه شد');
  await page.getByRole('button', { name: 'خروج از حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?return=/);
  const response = await request.get('/api/v2/account/licenses');
  expect(response.status()).toBe(401);
});

test('Safe login redirects and wrong-password feedback', async ({ page }) => {
  const e = await customer();
  await page.goto('/login?return=https://evil.invalid');
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill('Wrong!Password12345');
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('درست نیست');
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/localhost:3200\/account$/);
});

test('Additional profile requires existing owner and shares device and trials', async ({
  page,
}) => {
  const e = await customer(),
    p = await pairing((await import('../../tools/test-fixtures.mjs')).device(e.key.fingerprint));
  expect(
    (
      await call('/auth/claim', {
        pairing_id: p.pairing_id,
        pairing_secret: p.pairing_secret,
        password,
      })
    ).status,
  ).toBe(403);
  await customerLogin(page, e.username);
  await page.goto('/connect');
  await page.getByLabel('شناسهٔ درخواست', { exact: true }).fill(p.pairing_id);
  await page.getByLabel('کد موقت اتصال').fill(p.pairing_secret);
  await page.getByRole('button', { name: 'بررسی درخواست' }).click();
  await page.getByRole('button', { name: 'این دستگاه را تأیید می‌کنم' }).click();
  await expect(page.getByRole('heading', { name: 'اتصال در مرورگر تأیید شد' })).toBeVisible();
  const pickup = await call(
    `/device-pairings/${p.pairing_id}/pickup`,
    await proof(p.key, 'CONFIRM', p.pairing_id),
  );
  expect(pickup.body.device_id).toBe(e.device_id);
  expect(pickup.body.customer_id).toBe(e.customer_id);
});

test('MFA Admin dashboard, product edit and stale revision protection', async ({ page }) => {
  await adminLogin(page);
  await capture(page, '06-admin-dashboard');
  await page.goto('/zanyari/products');
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await capture(page, '07-admin-products');
  await page.getByRole('button', { name: 'ویرایش محصول' }).first().click();
  await page.getByLabel('قیمت به تومان').fill('1300000');
  await page.getByLabel('دلیل عملیات').fill('اصلاح قیمت با تأیید مستقل');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('عملیات ثبت شد');
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr').first()).toContainText('۱٬۳۰۰٬۰۰۰');
  await page.getByRole('button', { name: 'ویرایش محصول' }).first().click();
  await sql("UPDATE products SET revision=revision+1 WHERE sku='YARIZAN-G1'");
  await page.getByLabel('دلیل عملیات').fill('بررسی تعارض نسخهٔ محصول');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('اطلاعات تغییر کرده');
  await page.keyboard.press('Escape');
  await sql(
    "UPDATE product_prices SET amount_irr=12990000 WHERE sku='YARIZAN-G1' AND ended_at IS NULL",
  );
});

test('Admin device block/unblock and activation codes display once', async ({ page }) => {
  const e = await customer();
  await adminLogin(page);
  await page.goto('/zanyari/devices');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await capture(page, '08-admin-devices');
  await page.getByRole('button', { name: 'محدود کردن پایه', exact: true }).click();
  await page.getByLabel('دلیل عملیات').fill('محدودیت آزمایشی با بررسی مستقل');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('عملیات ثبت شد');
  await page.keyboard.press('Escape');
  expect(
    (await call('/desktop/trials/YARIZAN-G1/status', undefined, e.credential)).body.error.code,
  ).toBe('PRODUCT_BLOCKED');
  await page.getByRole('button', { name: 'رفع محدودیت', exact: true }).click();
  await page.getByLabel('دلیل عملیات').fill('رفع محدودیت پس از بررسی');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('عملیات ثبت شد');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'ساخت کد فعال‌سازی', exact: true }).click();
  await page.getByLabel('دلیل عملیات').fill('صدور دستی پس از بررسی مالکیت');
  await page
    .getByLabel('مرجع تأیید مستقل مالکیت', { exact: false })
    .fill('synthetic-independent-evidence-002');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  const secret = await page.getByTestId('one-time-secret').textContent();
  expect(secret).toMatch(/^YZ2-/);
  await page.keyboard.press('Escape');
  expect(await page.locator('body').textContent()).not.toContain(secret);
  await page.goto('/zanyari/activation-codes');
  expect(await page.locator('body').textContent()).not.toContain(secret);
  await page.getByRole('button', { name: 'لغو کد', exact: true }).first().click();
  await page.getByLabel('دلیل عملیات').fill('لغو کد آزمایشی صادرشده');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('عملیات ثبت شد');
});

test('Scoped Admin cannot execute unauthorized operations', async ({ page }) => {
  await adminLogin(page, 'catalog');
  await page.goto('/zanyari/products');
  await expect(page.getByRole('link', { name: 'مشتریان', exact: true })).toHaveCount(0);
  await page.goto('/zanyari/customers');
  await expect(page.getByRole('alert')).toContainText('اجازهٔ مشاهده');
  await expect(page.getByRole('button', { name: 'بازنشانی حساب', exact: true })).toHaveCount(0);
});

test('Proxy rejects cross-origin requests, arbitrary destinations and all desktop pickup routes', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/v2/auth/login', {
        headers: { Origin: 'https://evil.invalid' },
        data: { username: 'x', password: 'x' },
      })
    ).status(),
  ).toBe(403);
  for (const route of [
    '/api/v2/devices/authenticate',
    '/api/v2/devices/register',
    '/api/v2/device-pairings/' + randomUUID() + '/pickup',
    '/api/v2/desktop/licenses/pickup',
  ])
    expect(
      (
        await request.post(route, { headers: { Origin: 'http://localhost:3200' }, data: {} })
      ).status(),
    ).toBe(404);
  const response = await request.get('/api/v2/account');
  expect(response.headers()['cache-control']).toContain('no-store');
  const page = await request.get('/account');
  expect(page.headers()['cache-control']).toContain('no-store');
  expect(page.headers()['referrer-policy']).toBe('no-referrer');
});

test('Responsive mobile/tablet layouts, keyboard dialogs and accessible public pages', async ({
  page,
}) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/products');
    await expect(page.locator('.product-card')).toHaveCount(6);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await expect(page.getByRole('dialog', { name: 'به یاریزان خوش آمدید' })).toBeVisible();
  await capture(page, '09-mobile-navigation');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'باز کردن منو' })).toBeFocused();
  await page.goto('/products/grade-1');
  await page.getByRole('button', { name: 'راهنمای تهیهٔ این نسخه' }).click();
  await capture(page, '10-mobile-dialog');
  await page.keyboard.press('Escape');
  for (const route of ['/', '/products', '/login', '/connect', '/support']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});

async function confirmOperation(
  page: import('@playwright/test').Page,
  reason: string,
  evidence?: string,
) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('دلیل عملیات').fill(reason);
  if (evidence) await dialog.getByLabel('مرجع تأیید مستقل مالکیت', { exact: false }).fill(evidence);
  await dialog.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await expect(dialog.getByRole('status')).toContainText('عملیات ثبت شد');
}

test('Admin trial allocation reset and customer reset preserve historical device ban', async ({
  page,
}) => {
  const e = await customer(),
    trial = {
      device_id: e.device_id,
      client_nonce: 'A'.repeat(64),
      client_process_session_id: randomUUID(),
    };
  expect((await call('/desktop/trials/YARIZAN-G1/start', trial, e.credential)).status).toBe(201);
  await adminLogin(page);
  await page.goto('/zanyari/trials');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'دو فرصت تازه' }).click();
  await confirmOperation(page, 'تخصیص دو فرصت با تأیید مستقل');
  await page.keyboard.press('Escape');
  expect(
    (await call('/desktop/trials/YARIZAN-G1/start', trial, e.credential)).body.error.code,
  ).toBe('TRIAL_ALLOCATION_CHANGED');
  expect(
    (
      await sql('SELECT used,allocation_epoch FROM trial_counters WHERE device_id=$1', [
        e.device_id,
      ])
    ).rows[0],
  ).toMatchObject({ used: 0, allocation_epoch: '2' });
  await page.goto('/zanyari/devices');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'محدود کردن پایه', exact: true }).click();
  await confirmOperation(page, 'محدودیت پایه پیش از بازنشانی');
  await page.keyboard.press('Escape');
  await page.goto('/zanyari/customers');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'بازنشانی حساب', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('تاریخچه حفظ می‌شوند');
  await confirmOperation(page, 'بازنشانی حساب با تأیید مستقل');
  await page.keyboard.press('Escape');
  expect(
    (await sql('SELECT generation FROM devices WHERE id=$1', [e.device_id])).rows[0].generation,
  ).toBe(2);
  expect(
    (
      await sql(
        "SELECT blocked FROM device_product_restrictions WHERE device_id=$1 AND sku='YARIZAN-G1'",
        [e.device_id],
      )
    ).rows[0].blocked,
  ).toBe(true);
  expect(
    (await sql('SELECT count(*) FROM trial_starts WHERE device_id=$1', [e.device_id])).rows[0]
      .count,
  ).toBe('1');
});

test('Admin manual ownership, revoke and same-ID recovery use real revisioned operations', async ({
  page,
}) => {
  const e = await customer();
  await adminLogin(page);
  await page.goto('/zanyari/devices');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'ثبت مجوز خرید', exact: true }).click();
  await confirmOperation(
    page,
    'ثبت مجوز خرید برای دستگاه پس از بررسی',
    'synthetic-ownership-issue-003',
  );
  await page.keyboard.press('Escape');
  await page.goto('/zanyari/licenses');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await capture(page, '11-admin-licenses');
  await page.getByRole('button', { name: 'لغو اعتبار مجوز', exact: true }).click();
  await confirmOperation(page, 'لغو اعتبار مجوز به درخواست بررسی مستقل');
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr')).toContainText('لغوشده');
  await page.getByRole('button', { name: 'بازیابی مجوز خرید', exact: true }).click();
  await confirmOperation(page, 'بازیابی همان مجوز پس از بررسی', 'synthetic-ownership-recover-004');
  await page.keyboard.press('Escape');
  await expect(page.locator('tbody tr')).toContainText('فعال');
  const licenses = await sql('SELECT state,decision_version FROM licenses WHERE device_id=$1', [
    e.device_id,
  ]);
  expect(licenses.rows).toHaveLength(1);
  expect(licenses.rows[0]).toMatchObject({ state: 'ACTIVE', decision_version: '3' });
});

test('Support reset grant is shown once and completes a forced password change', async ({
  page,
}) => {
  const e = await customer();
  await adminLogin(page, 'support');
  await page.goto('/zanyari/customers');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'بازنشانی حساب', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'بازیابی رمز عبور', exact: true }).click();
  await confirmOperation(
    page,
    'بازیابی پس از احراز مستقل مالکیت',
    'synthetic-support-evidence-005',
  );
  const grant = await page.getByTestId('one-time-secret').textContent();
  expect(grant?.length).toBe(43);
  await page.goto('/support-reset');
  expect(await page.locator('body').textContent()).not.toContain(grant);
  await page.getByLabel('مجوز بازیابی', { exact: true }).fill(grant!);
  await page.getByLabel('رمز عبور جدید', { exact: true }).fill('ChangedSynthetic!Password987');
  await page.getByLabel('تکرار رمز عبور', { exact: true }).fill('ChangedSynthetic!Password987');
  await page.getByRole('button', { name: 'ثبت رمز عبور تازه' }).click();
  await expect(page.getByRole('heading', { name: 'رمز عبور تغییر کرد.' })).toBeVisible();
  expect((await call('/auth/login', { username: e.username, password })).status).toBe(401);
  expect(
    (await call('/auth/login', { username: e.username, password: 'ChangedSynthetic!Password987' }))
      .status,
  ).toBe(201);
  expect(
    (
      await call('/auth/password-reset/complete', {
        reset_grant: grant,
        password: 'ChangedSynthetic!Password987',
      })
    ).status,
  ).toBe(410);
});

test('Expired sessions and recent-MFA expiry fail closed in the portals', async ({ page }) => {
  const e = await customer();
  await customerLogin(page, e.username);
  await sql(
    "UPDATE customer_sessions SET expires_at=now()-interval '1 second' WHERE customer_id=$1",
    [e.customer_id],
  );
  await page.goto('/account/devices');
  await expect(page).toHaveURL(/\/login\?return=/);
  const a = await adminLogin(page);
  await sql(
    "UPDATE admin_sessions SET mfa_at=now()-interval '6 minutes' WHERE admin_id=(SELECT id FROM admins WHERE username=$1)",
    [a.username],
  );
  await page.goto('/zanyari/products');
  await expect(page.getByRole('alert')).toContainText('ورود مجدد');
  await expect(page.getByRole('button', { name: 'ویرایش محصول' })).toHaveCount(0);
  await page.getByRole('button', { name: 'خروج از مدیریت', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari\/login$/);
});

test('Catalog failure and empty states are honest; untrusted product text never executes', async ({
  page,
  request,
}) => {
  await page.route('**/api/v2/products', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } }),
    }),
  );
  await page.goto('/support');
  await page
    .getByRole('navigation', { name: 'منوی اصلی' })
    .getByRole('link', { name: 'دنیای پایه‌ها' })
    .click();
  await expect(page.getByRole('alert')).toContainText('اطلاعات دریافت نشد');
  await page.unroute('**/api/v2/products');
  await page.getByRole('button', { name: 'تلاش دوباره' }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
  const original = (await sql("SELECT title_fa FROM products WHERE sku='YARIZAN-G1'")).rows[0]
    .title_fa;
  await sql("UPDATE products SET title_fa=$1 WHERE sku='YARIZAN-G1'", [
    '<img src=x onerror="window.__injected=true">',
  ]);
  try {
    await page.goto('/products/grade-1');
    await expect(page.locator('h1')).toContainText('<img');
    expect(await page.evaluate(() => Object.hasOwn(window, '__injected'))).toBe(false);
  } finally {
    await sql("UPDATE products SET title_fa=$1 WHERE sku='YARIZAN-G1'", [original]);
  }
  await page.route('**/api/v2/products', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.goto('/support');
  await page
    .getByRole('navigation', { name: 'منوی اصلی' })
    .getByRole('link', { name: 'دنیای پایه‌ها' })
    .click();
  await expect(page.getByText('هنوز موردی برای نمایش وجود ندارد.')).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(0);
  await page.unroute('**/api/v2/products');
  const response = await request.get('/');
  expect(response.headers()['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
  expect(response.headers()['content-security-policy']).toContain("script-src-attr 'none'");
});

test('Real C# provisioning and Playwright approval complete one integrated desktop/browser flow', async ({
  page,
}) => {
  test.setTimeout(180000);
  const { createServer } = await import('node:http'),
    { promisify } = await import('node:util'),
    { execFile } = await import('node:child_process'),
    { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises'),
    { tmpdir } = await import('node:os'),
    { randomBytes } = await import('node:crypto');
  const { adminSession } = await import('../../tools/test-fixtures.mjs');
  const admin = await adminSession();
  const roots = JSON.parse(await readFile('.local/web-public-root.json', 'utf8'));
  const token = randomBytes(32).toString('base64url');
  let approvals = 0;
  let callbackFailure: unknown;
  const server = createServer(async (req, res) => {
    try {
      if (
        req.url !== '/approve' ||
        req.method !== 'POST' ||
        req.headers['x-fixture-proof'] !== token
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 4096) throw new Error('Oversize fixture request');
      }
      const pairing = JSON.parse(body);
      await page.goto('/connect');
      await page.getByLabel('شناسهٔ درخواست', { exact: true }).fill(pairing.pairing_id);
      await page.getByLabel('کد موقت اتصال').fill(pairing.pairing_secret);
      await page.getByRole('button', { name: 'بررسی درخواست' }).click();
      await expect(
        page.getByRole('heading', { name: /راه‌اندازی حساب|تأیید پروفایل/ }),
      ).toBeVisible();
      await page.getByLabel('شمارهٔ همراه', { exact: true }).fill(nextMobile());
      const sentOtp = page.waitForResponse((r) =>
        r.url().endsWith('/api/v2/auth/claim/otp/request'),
      );
      await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
      const otp = await (await sentOtp).json();
      await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(otp.challenge_id));
      const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/v2/auth/claim'));
      await page.getByRole('button', { name: 'تأیید شماره و اتصال' }).click();
      const receipt = await (await responsePromise).json();
      await expect(page.getByRole('heading', { name: 'اتصال در مرورگر تأیید شد' })).toBeVisible();
      expect(Object.keys(receipt).sort()).toEqual(['expires_at', 'status', 'username']);
      approvals++;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(receipt));
    } catch (error) {
      callbackFailure = error;
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const dir = await mkdtemp(path.join(tmpdir(), 'yarizan-browser-csharp-'));
  try {
    const file = path.join(dir, 'synthetic.json');
    await writeFile(
      file,
      JSON.stringify({
        provisioning: true,
        apiBase: 'http://127.0.0.1:3100/',
        origin: 'http://localhost:3200',
        ...roots,
        adminCookie: admin.cookie,
        adminCsrf: admin.csrf,
        browser_callback: `http://127.0.0.1:${port}/approve`,
        browser_callback_token: token,
      }),
    );
    const result = await promisify(execFile)(
      'dotnet',
      [
        'run',
        '--project',
        process.platform === 'win32'
          ? '../../tests/ProvisioningChecks'
          : '../../tests/BackendInterop',
        '-c',
        'Release',
        '--',
        file,
      ],
      { timeout: 150000 },
    );
    if (callbackFailure) throw callbackFailure;
    expect(approvals).toBe(2);
    expect(result.stdout).toMatch(/DOTNET_PROVISIONING \d+ passed, 0 failed/);
    console.log(
      result.stdout
        .split('\n')
        .filter((line) => /DOTNET_PROVISIONING|WINDOWS_PROVISIONING/.test(line))
        .join('\n'),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(
      path.resolve(dir).startsWith(path.join(path.resolve(tmpdir()), 'yarizan-browser-csharp-')),
    ).toBe(true);
    await rm(dir, { recursive: true, force: true });
  }
});

test('A delayed one-time code response cannot populate a different Admin dialog', async ({
  page,
}) => {
  const e = await customer();
  await adminLogin(page);
  await page.goto('/zanyari/devices');
  await page
    .getByRole('textbox', { name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت' })
    .fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  let arrived!: () => void, release!: () => void;
  const captured = new Promise<void>((resolve) => {
      arrived = resolve;
    }),
    released = new Promise<void>((resolve) => {
      release = resolve;
    });
  let secret = '';
  await page.route('**/api/v2/admin/activation-codes', async (route) => {
    const result = await route.fetch();
    const data = await result.json();
    secret = data.activation_code;
    arrived();
    await released;
    try {
      await route.fulfill({ response: result });
    } catch {
      /* Closing/navigating may abort delivery; no plaintext is retained by the view. */
    }
  });
  await page.getByRole('button', { name: 'ساخت کد فعال‌سازی', exact: true }).click();
  await page.getByLabel('دلیل عملیات').fill('آزمایش پاسخ دیرهنگام ساخت کد فعال‌سازی');
  await page
    .getByLabel('مرجع تأیید مستقل مالکیت', { exact: false })
    .fill('synthetic-late-response-006');
  await page.getByRole('button', { name: 'تأیید و ثبت عملیات' }).click();
  await captured;
  await page.getByRole('dialog').getByRole('button', { name: 'بستن پنجره' }).click();
  await page.getByRole('button', { name: 'ثبت مجوز خرید', exact: true }).click();
  release();
  await expect(page.getByRole('dialog', { name: 'ثبت مجوز خرید برای دستگاه' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'تأیید و ثبت عملیات' }),
  ).toBeEnabled();
  await expect(page.getByTestId('one-time-secret')).toHaveCount(0);
  expect(await page.locator('body').textContent()).not.toContain(secret);
});
