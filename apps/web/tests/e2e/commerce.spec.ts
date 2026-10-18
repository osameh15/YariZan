import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import {
  customer,
  call,
  admin,
  adminSession,
  password,
  smsCode,
  sql,
  setPrice,
} from '../../tools/test-fixtures.mjs';
const images = path.resolve('.local/screenshots/phase4-premium');
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
async function shot(page: Page, name: string) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await mkdir(images, { recursive: true });
  await page.screenshot({
    path: path.join(images, name + '.png'),
    fullPage: (await page.getByRole('dialog').count()) === 0,
    animations: 'disabled',
  });
}
async function login(page: Page, e: Awaited<ReturnType<typeof customer>>) {
  await page.goto('/login');
  await page.waitForFunction(
    () =>
      !!document.querySelector('#__nuxt') && '__vue_app__' in document.querySelector('#__nuxt')!,
  );
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
async function manager(page: Page) {
  const a = await admin();
  await page.goto('/zanyari/login');
  await page.waitForFunction(
    () =>
      !!document.querySelector('#__nuxt') && '__vue_app__' in document.querySelector('#__nuxt')!,
  );
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const response = page.waitForResponse((r) => r.url().endsWith('/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const c = await (await response).json();
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(c.challenge_id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
  await shot(page, '27-admin-dashboard');
  await page.goto('/zanyari/commerce');
}
const mutation = () => ({
  request_id: randomUUID(),
  expected_revision: 1,
  reason: 'Synthetic reviewed commerce fixture',
});
async function discount() {
  const a = await adminSession(),
    campaign = await call(
      '/admin/commerce/campaigns',
      {
        ...mutation(),
        name: 'Synthetic browser campaign',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
        enabled: true,
        max_redemptions: 100,
        max_per_customer: 1,
      },
      a,
    );
  expect(campaign.status).toBe(201);
  const code = 'SCHOOL-' + randomBytes(4).toString('hex').toUpperCase();
  expect(
    (
      await call(
        '/admin/commerce/coupons',
        {
          ...mutation(),
          campaign_id: campaign.body.id,
          code,
          type: 'percent',
          value: 10,
          max_discount_irr: null,
          min_order_irr: null,
          enabled: true,
          max_redemptions: 100,
          max_per_customer: 1,
          skus: ['YARIZAN-G1'],
        },
        a,
      )
    ).status,
  ).toBe(201);
  return code;
}

test('Real checkout, coupon quote, simulated payment and one desktop license', async ({ page }) => {
  const e = await customer(),
    code = await discount();
  await login(page, e);
  await shot(page, '26-customer-dashboard');
  await page.goto('/products/grade-1');
  await expect(page.getByRole('link', { name: 'خرید آزمایشی این پایه' })).toBeVisible();
  await shot(page, '01-grade-one-purchase');
  await page.getByRole('link', { name: 'خرید آزمایشی این پایه' }).click();
  await expect(page.locator('.commerce-totals')).toContainText('۱٬۲۹۹٬۰۰۰');
  await shot(page, '02-checkout-summary');
  const selectedTitle = await page.locator('.checkout-product h2').textContent();
  await page.getByLabel('کد تخفیف', { exact: true }).fill('INVALID-CODE');
  await page.getByRole('button', { name: 'بررسی کد تخفیف' }).click();
  await expect(page.getByRole('alert')).toContainText('قابل استفاده نیست');
  await expect(page.locator('.checkout-product h2')).toHaveText(selectedTitle!);
  await expect(page.getByRole('button', { name: 'حذف کد تخفیف', exact: true })).toBeVisible();
  await shot(page, '04-coupon-rejected');
  await page.getByLabel('کد تخفیف', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'بررسی کد تخفیف' }).click();
  await expect(page.locator('.commerce-totals')).toContainText('۱٬۱۶۹٬۱۰۰');
  await expect(
    page.getByText('کد تخفیف قابل استفاده است؛ سهمیه هنگام ثبت سفارش رزرو می‌شود.'),
  ).toBeVisible();
  await shot(page, '03-coupon-accepted');
  await page.getByRole('button', { name: 'حذف کد تخفیف' }).click();
  await expect(page.locator('.payable-total')).toContainText('۱٬۲۹۹٬۰۰۰');
  await expect(page.getByLabel('کد تخفیف', { exact: true })).toHaveValue('');
  await page.getByLabel('کد تخفیف', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'بررسی کد تخفیف', exact: true }).click();
  await expect(page.locator('.payable-total')).toContainText('۱٬۱۶۹٬۱۰۰');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, '15-mobile-checkout');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
  await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]{36}$/);
  const order = page.url().split('/').pop()!;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'کپی شماره', exact: true }).click();
  await expect(page.getByRole('button', { name: 'کپی شد', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(order);
  await page.getByRole('button', { name: 'ادامه در شبیه‌ساز پرداخت' }).click();
  await expect(page).toHaveURL(/\/payment\/simulate\?order=/);
  await shot(page, '05-simulated-gateway');
  await expect(page.getByText(/این صفحه درگاه بانکی نیست/)).toBeVisible();
  await page.getByRole('button', { name: 'تأیید پرداخت آزمایشی' }).click();
  await expect(page.locator('.order-state')).toContainText('مجوز خرید آماده است', {
    timeout: 20000,
  });
  await shot(page, '07-verified-purchase');
  const picked = await call('/desktop/licenses/pickup', { sku: 'YARIZAN-G1' }, e.credential);
  expect(picked.status).toBe(201);
  expect(picked.body.payload.device_id).toBe(e.device_id);
  expect(picked.body.payload.expires_at).toBeNull();
  expect((await call('/desktop/licenses/pickup', { sku: 'YARIZAN-G2' }, e.credential)).status).toBe(
    403,
  );
  const count = await sql(
    'SELECT count(*) FROM order_fulfillments f JOIN order_items i ON i.id=f.order_item_id WHERE i.order_id=$1',
    [order],
  );
  expect(count.rows[0].count).toBe('1');
  await page.goto('/account/orders');
  await expect(page.getByRole('link', { name: 'جزئیات سفارش و مجوز' })).toBeVisible();
  await shot(page, '08-customer-orders');
  await page.getByRole('link', { name: 'جزئیات سفارش و مجوز' }).click();
  await expect(page.locator('.order-state')).toContainText('مجوز خرید آماده است');
  await shot(page, '09-order-detail-license');
});

test('Unknown outcome is not failure or another charge; safe callback and mobile pending state', async ({
  page,
  request,
}) => {
  const e = await customer();
  await login(page, e);
  await page.goto('/checkout?sku=YARIZAN-G1');
  await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
  await page.getByRole('button', { name: 'ادامه در شبیه‌ساز پرداخت' }).click();
  await expect(page).toHaveURL(/\/payment\/simulate\?order=/);
  const id = new URL(page.url()).searchParams.get('order')!;
  await page.getByRole('button', { name: 'شبیه‌سازی نتیجهٔ نامشخص' }).click();
  await expect(page.locator('.order-state')).toContainText('هنوز مشخص نیست', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'ادامه در شبیه‌ساز پرداخت' })).toHaveCount(0);
  await shot(page, '06-payment-verification-pending');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, '16-mobile-payment-result');
  const authority = (await sql('SELECT authority FROM payment_attempts WHERE order_id=$1', [id]))
    .rows[0].authority;
  const returned = await request.get(
    '/payment/return?Authority=' + authority + '&Status=OK&next=https://evil.invalid',
    { maxRedirects: 0 },
  );
  expect(returned.status()).toBe(303);
  expect(returned.headers().location).toBe('/payment/result?order=' + id);
  const other = await customer();
  const foreign = await call('/auth/login', { username: other.username, password });
  const forbidden = await call('/orders/' + id, undefined, {
    cookie: foreign.headers
      .getSetCookie()
      .find((v: string) => v.startsWith('yz_customer='))!
      .split(';')[0],
    csrf: foreign.body.csrf_token,
  });
  expect(forbidden.status).toBe(404);
  const ssr = await (await page.request.get('/payment/result?order=' + id)).text();
  expect(ssr).not.toContain(e.credential);
  expect(ssr).not.toContain(e.username);
});

test('Admin campaign/code creation, notes, finance and permission-bound reconciliation', async ({
  page,
}) => {
  await manager(page);
  await shot(page, '10-admin-orders');
  await page.getByRole('link', { name: 'پرداخت‌ها', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'پرداخت‌ها', exact: true })).toBeVisible();
  await shot(page, '11-admin-payments');
  await page.getByRole('link', { name: 'طرح‌های تخفیف', exact: true }).click();
  await page.getByRole('button', { name: 'ساخت طرح تخفیف', exact: true }).click();
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect(page.locator('.form-summary')).toContainText('اصلاح');
  await shot(page, '17-accessible-validation-error');
  const name = 'طرح مدرسه ' + randomBytes(3).toString('hex');
  await page.getByLabel('نام طرح', { exact: true }).fill(name);
  await page.getByLabel('دلیل تغییر', { exact: true }).fill('بررسی مستقل تنظیمات آزمایشی تخفیف');
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await shot(page, '12-admin-campaigns');
  await page.getByRole('link', { name: 'کدهای تخفیف', exact: true }).click();
  await page.getByRole('button', { name: 'ساخت کد تخفیف', exact: true }).click();
  await page.getByRole('combobox', { name: 'طرح تخفیف', exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
  const code = 'CLASS-' + randomBytes(3).toString('hex').toUpperCase();
  await page.getByLabel('کد تخفیف', { exact: true }).fill(code);
  await page.getByLabel('دلیل تغییر', { exact: true }).fill('ثبت کد محدود برای آزمون پرداخت');
  await page.getByRole('dialog').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.locator('.commerce-editor-fields').evaluate((el) => {
    el.scrollTop = 0;
  });
  await shot(page, '13-admin-coupon-editor');
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('جست‌وجو', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'جست‌وجو و تازه‌سازی' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'ویرایش', exact: true }).click();
  await page.getByLabel('فعال باشد', { exact: true }).uncheck();
  await page.getByLabel('دلیل تغییر', { exact: true }).fill('غیرفعال کردن کد پس از آزمون');
  await page.getByRole('button', { name: 'ثبت تغییرات', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody')).toContainText('غیرفعال');
  await page.getByRole('link', { name: 'گزارش مالی', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'گزارش مالی', exact: true })).toBeVisible();
  await expect(page.getByText('خالص سفارش‌های پرداخت‌شده', { exact: true })).toBeVisible();
  await shot(page, '14-admin-financial-overview');
});

test('Cancelled synthetic payment never presents a successful purchase', async ({ page }) => {
  const e = await customer();
  await login(page, e);
  await page.goto('/checkout?sku=YARIZAN-G1');
  await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
  await page.getByRole('button', { name: 'ادامه در شبیه‌ساز پرداخت' }).click();
  await page.getByRole('button', { name: 'لغو پرداخت آزمایشی' }).click();
  await expect(page.locator('.order-state')).toContainText('پرداخت لغو شد', { timeout: 15000 });
  await expect(
    page.getByText('مجوز این پایه آمادهٔ دریافت در برنامهٔ ویندوز است.', { exact: false }),
  ).toHaveCount(0);
});

test('Every visible commerce section loads its real API and unsupported sections fail clearly', async ({
  page,
}) => {
  await manager(page);
  const navigation = page.getByRole('navigation', { name: 'مدیریت فروش' });
  await expect(navigation.getByRole('link')).toHaveCount(10);
  const links = await navigation
    .getByRole('link')
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ href: n.getAttribute('href')!, label: n.textContent!.trim() })),
    );
  expect(new Set(links.map((l) => l.href)).size).toBe(10);
  expect(new Set(links.map((l) => l.label)).size).toBe(10);
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
  for (const link of links) {
    const section = new URL(link.href, 'http://localhost').searchParams.get('section');
    const loaded = page.waitForResponse(
      (r) =>
        r.url().includes('/api/v2/admin/commerce/' + section + '?') &&
        r.request().method() === 'GET',
    );
    await page.goto(link.href);
    const response = await loaded;
    expect(response.status(), section!).toBe(200);
    const data = await response.json();
    await expect(page.getByRole('heading', { name: link.label, exact: true })).toBeVisible();
    await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (section !== 'finance') {
      expect(Array.isArray(data.items)).toBe(true);
      if (!data.items.length)
        await expect(page.getByText('رکوردی با این شرایط پیدا نشد.')).toBeVisible();
    } else expect(data.currency).toBe('IRR');
  }
  const unexpected: string[] = [];
  page.on('request', (r) => {
    if (/admin\/commerce\/(paid_orders|refund_requests|not-real)/.test(r.url()))
      unexpected.push(r.url());
  });
  for (const section of ['paid_orders', 'refund_requests', 'not-real']) {
    await page.goto('/zanyari/commerce?section=' + section);
    await expect(page.getByRole('alert')).toContainText('این بخش مدیریت وجود ندارد');
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'بازگشت به سفارش‌ها', exact: true })).toBeVisible();
  }
  expect(unexpected).toEqual([]);
  const a = await adminSession();
  expect((await call('/admin/commerce/paid_orders', undefined, a)).status).toBe(404);
});

for (const width of [1440, 390])
  test(`Coupon editor keeps save visible and fields keyboard reachable at ${width}px`, async ({
    page,
  }) => {
    await discount();
    await page.setViewportSize({ width, height: width === 390 ? 700 : 900 });
    await manager(page);
    await page.getByRole('link', { name: 'کدهای تخفیف', exact: true }).click();
    const trigger = page.getByRole('button', { name: 'ساخت کد تخفیف', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog'),
      save = dialog.getByRole('button', { name: 'ثبت تغییرات', exact: true });
    await expect(save).toBeInViewport();
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: path.join(images, `18-coupon-actions-${width}.png`),
      fullPage: false,
      animations: 'disabled',
    });
    const fields = dialog.locator('.commerce-editor-fields');
    const reason = dialog.getByLabel('دلیل تغییر', { exact: true });
    await dialog.getByRole('button', { name: 'بستن پنجره', exact: true }).focus();
    let reachedReason = false,
      reachedSave = false;
    for (let n = 0; n < 40; n++) {
      await page.keyboard.press('Tab');
      await expect(dialog.locator(':focus')).toBeInViewport();
      await expect(save).toBeInViewport();
      if (await reason.evaluate((el) => el === document.activeElement)) reachedReason = true;
      if (await save.evaluate((el) => el === document.activeElement)) {
        reachedSave = true;
        break;
      }
    }
    expect(reachedReason).toBe(true);
    expect(reachedSave).toBe(true);
    if (await fields.evaluate((el) => el.scrollHeight > el.clientHeight))
      expect(await fields.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'انصراف', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(save).toBeFocused();
    await page.screenshot({
      path: path.join(images, `19-coupon-keyboard-${width}.png`),
      fullPage: false,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

test('Production browser renders exact large IRR in checkout, paid order and finance', async ({
  page,
}) => {
  await setPrice('YARIZAN-G1', '9007199254740983');
  try {
    const e = await customer();
    await login(page, e);
    await page.goto('/checkout?sku=YARIZAN-G1');
    await expect(page.locator('.commerce-totals')).toContainText('۹۰۰٬۷۱۹٬۹۲۵٬۴۷۴٬۰۹۸٫۳');
    await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
    await expect(page.locator('.commerce-totals')).toContainText('۹۰۰٬۷۱۹٬۹۲۵٬۴۷۴٬۰۹۸٫۳');
    await page.getByRole('button', { name: 'ادامه در شبیه‌ساز پرداخت' }).click();
    await page.getByRole('button', { name: 'تأیید پرداخت آزمایشی' }).click();
    await expect(page.locator('.order-state')).toContainText('مجوز خرید آماده است', {
      timeout: 20000,
    });
    await manager(page);
    await page.getByRole('link', { name: 'گزارش مالی', exact: true }).click();
    const n = BigInt(
      (
        await sql(
          'SELECT COALESCE(sum(total_irr),0)::text amount FROM orders WHERE paid_at IS NOT NULL AND accepted_payment_id IS NOT NULL',
        )
      ).rows[0].amount,
    );
    const expected =
      new Intl.NumberFormat('fa-IR').format(n / 10n) +
      (n % 10n ? '٫' + new Intl.NumberFormat('fa-IR').format(n % 10n) : '');
    await expect(
      page
        .locator('.stat-grid article')
        .filter({ hasText: 'خالص سفارش‌های پرداخت‌شده' })
        .locator('h2'),
    ).toContainText(expected);
  } finally {
    await setPrice('YARIZAN-G1', '12990000');
  }
});

test('Premium checkout and Admin remain usable at five widths and enlarged presentation', async ({
  page,
}) => {
  const e = await customer();
  await login(page, e);
  await page.goto('/checkout?sku=YARIZAN-G1');
  await expect(page.locator('.commerce-totals')).toBeVisible();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' })).toBeEnabled();
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('کد تخفیف', { exact: true }).fill('');
  await page.getByRole('button', { name: 'بررسی کد تخفیف', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' })).toBeEnabled();
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await shot(page, '28-checkout-enlarged');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });
  await manager(page);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('navigation', { name: 'مدیریت فروش' })).toBeVisible();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('Finance report failure never displays invented zero totals and safely reloads real data', async ({
  page,
}) => {
  await manager(page);
  await page.route('**/api/v2/admin/commerce/finance?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } }),
    }),
  );
  await page.goto('/zanyari/commerce?section=finance');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.finance-metrics')).toHaveCount(0);
  await expect(page.locator('.finance-counts')).toHaveCount(0);
  await expect(page.getByText('در این بازه تلاش پرداختی ثبت نشده است.')).toHaveCount(0);
  await shot(page, '29-finance-unavailable');
  await page.unroute('**/api/v2/admin/commerce/finance?*');
  await page.getByRole('button', { name: 'جست‌وجو و تازه‌سازی' }).click();
  await expect(page.locator('.finance-metrics')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

// APIRequestContext replay does not retain browser Fetch Metadata consistently.
// Preserve original session/CSRF headers and the exact local page Origin on test replays.
async function realResponse(route: Route) {
  const request = route.request();
  const headers = await request.allHeaders();
  return route.fetch({ headers: { ...headers, origin: new URL(request.url()).origin } });
}
// Hold actual backend responses; tests control completion order without timing sleeps.
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function settleView(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
test('Coupon input edits and reverse-order quotes never authorize a mismatched order', async ({
  page,
}) => {
  const e = await customer(),
    a = await discount(),
    b = await discount();
  await sql('UPDATE discount_codes SET value=20 WHERE code=$1', [b]);
  await login(page, e);
  await page.goto('/checkout');
  await expect(page.locator('.checkout-submit')).toBeEnabled();
  const enteredA = deferred(),
    releaseA = deferred(),
    doneA = deferred();
  const enteredB = deferred(),
    releaseB = deferred();
  await page.route('**/api/v2/discounts/quote', async (route) => {
    const code = route.request().postDataJSON().coupon;
    const response = await realResponse(route);
    if (code === a) {
      enteredA.release();
      await releaseA.promise;
    }
    if (code === b) {
      enteredB.release();
      await releaseB.promise;
    }
    await route.fulfill({ response });
    if (code === a) doneA.release();
  });
  await page.getByLabel('کد تخفیف', { exact: true }).fill(a);
  await page.getByRole('button', { name: 'بررسی کد تخفیف', exact: true }).click();
  await enteredA.promise;
  await page.getByLabel('کد تخفیف', { exact: true }).fill(b);
  await expect(page.locator('.checkout-submit')).toHaveCount(0);
  await page.getByRole('button', { name: 'بررسی کد تخفیف', exact: true }).click();
  await enteredB.promise;
  releaseB.release();
  await expect(page.locator('.payable-total')).toContainText('۱٬۰۳۹٬۲۰۰');
  await expect(page.locator('.checkout-submit')).toBeEnabled();
  releaseA.release();
  await doneA.promise;
  await settleView(page);
  await expect(page.locator('.payable-total')).toContainText('۱٬۰۳۹٬۲۰۰');
  await expect(page.getByLabel('کد تخفیف', { exact: true })).toHaveValue(b);
  const created = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().endsWith('/api/v2/orders'),
  );
  await page.locator('.checkout-submit').click();
  expect((await created).postDataJSON().coupon).toBe(b);
  await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]{36}$/);
});
for (const lateError of [false, true]) {
  test(`Stale coupon ${lateError ? 'failure' : 'success'} cannot replace a newer ${lateError ? 'quote' : 'error'}`, async ({
    page,
  }) => {
    await login(page, await customer());
    const valid = await discount(),
      first = lateError ? 'INVALID-STALE' : valid,
      latest = lateError ? valid : 'INVALID-LATEST';
    await page.goto('/checkout');
    await expect(page.locator('.checkout-submit')).toBeEnabled();
    const entered = deferred(),
      release = deferred(),
      done = deferred();
    await page.route('**/api/v2/discounts/quote', async (route) => {
      const response = await realResponse(route);
      const held = route.request().postDataJSON().coupon === first;
      if (held) {
        entered.release();
        await release.promise;
      }
      await route.fulfill({ response });
      if (held) done.release();
    });
    await page.getByLabel('کد تخفیف', { exact: true }).fill(first);
    await page.getByRole('button', { name: 'بررسی کد تخفیف', exact: true }).click();
    await entered.promise;
    await page.getByLabel('کد تخفیف', { exact: true }).fill(latest);
    await page.getByRole('button', { name: 'بررسی کد تخفیف', exact: true }).click();
    if (lateError) await expect(page.locator('.checkout-submit')).toBeEnabled();
    else await expect(page.getByRole('alert')).toContainText('قابل استفاده نیست');
    release.release();
    await done.promise;
    await settleView(page);
    if (lateError) {
      await expect(page.locator('.checkout-submit')).toBeEnabled();
      await expect(page.getByRole('alert')).toHaveCount(0);
    } else {
      await expect(page.locator('.checkout-submit')).toHaveCount(0);
      await expect(page.getByRole('alert')).toContainText('قابل استفاده نیست');
    }
  });
}
test('Admin old payments completion cannot finish a newer orders load', async ({ page }) => {
  await manager(page);
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
  const pEntered = deferred(),
    pRelease = deferred(),
    pDone = deferred();
  const oEntered = deferred(),
    oRelease = deferred();
  await page.route('**/api/v2/admin/commerce/payments?*', async (route) => {
    const response = await realResponse(route);
    pEntered.release();
    await pRelease.promise;
    await route.fulfill({ response });
    pDone.release();
  });
  await page.route('**/api/v2/admin/commerce/orders?*', async (route) => {
    const response = await realResponse(route);
    expect(response.status()).toBe(200);
    oEntered.release();
    await oRelease.promise;
    await route.fulfill({ response });
  });
  await page.getByRole('link', { name: 'پرداخت‌ها', exact: true }).click();
  await pEntered.promise;
  await page.getByRole('link', { name: 'سفارش‌ها', exact: true }).click();
  await oEntered.promise;
  pRelease.release();
  await pDone.promise;
  await settleView(page);
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  oRelease.release();
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.portal-main h1')).toHaveText('سفارش‌ها');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
for (const [latestError, lateError] of [
  [false, false],
  [true, false],
  [false, true],
]) {
  test(`Late payments ${lateError ? 'failure' : 'success'} cannot replace newer finance ${latestError ? 'error' : 'totals'}`, async ({
    page,
  }) => {
    await manager(page);
    await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
    const entered = deferred(),
      release = deferred(),
      done = deferred();
    await page.route('**/api/v2/admin/commerce/payments?*', async (route) => {
      const response = await realResponse(route);
      entered.release();
      await release.promise;
      await route.fulfill(
        lateError
          ? {
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } }),
            }
          : { response },
      );
      done.release();
    });
    if (latestError)
      await page.route('**/api/v2/admin/commerce/finance?*', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } }),
        }),
      );
    await page.getByRole('link', { name: 'پرداخت‌ها', exact: true }).click();
    await entered.promise;
    await page.getByRole('link', { name: 'گزارش مالی', exact: true }).click();
    await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
    if (latestError) await expect(page.getByRole('alert')).toBeVisible();
    else await expect(page.locator('.finance-metrics')).toBeVisible();
    const before = await page.locator('.portal-main').textContent();
    release.release();
    await done.promise;
    await settleView(page);
    await expect(page.locator('.portal-main')).toHaveText(before!);
    await expect(page.locator('tbody tr')).toHaveCount(0);
  });
}

test('Editing Admin filters invalidates a held response and snapshots the next submitted query', async ({
  page,
}) => {
  await manager(page);
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
  const entered = deferred(),
    release = deferred(),
    done = deferred();
  await page.route('**/api/v2/admin/commerce/orders?*', async (route) => {
    const response = await realResponse(route);
    if (new URL(route.request().url()).searchParams.get('search') === 'STALE-FILTER') {
      entered.release();
      await release.promise;
      await route.fulfill({ response });
      done.release();
    } else await route.fulfill({ response });
  });
  await page.getByLabel('جست‌وجو', { exact: true }).fill('STALE-FILTER');
  await page.getByRole('button', { name: 'جست‌وجو و تازه‌سازی', exact: true }).click();
  await entered.promise;
  await page.getByLabel('جست‌وجو', { exact: true }).fill('LATEST-FILTER');
  await expect(
    page.getByRole('button', { name: 'جست‌وجو و تازه‌سازی', exact: true }),
  ).toBeEnabled();
  const response = page.waitForResponse(
    (r) =>
      r.url().includes('/admin/commerce/orders?') &&
      new URL(r.url()).searchParams.get('search') === 'LATEST-FILTER',
  );
  await page.getByRole('button', { name: 'جست‌وجو و تازه‌سازی', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
  release.release();
  await done.promise;
  await settleView(page);
  await expect(page.getByLabel('جست‌وجو', { exact: true })).toHaveValue('LATEST-FILTER');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
