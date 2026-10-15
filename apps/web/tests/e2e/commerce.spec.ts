import { test, expect, type Page } from '@playwright/test';
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
} from '../../tools/test-fixtures.mjs';
const images = path.resolve('../../docs/Images/phase4');
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
async function shot(page: Page, name: string) {
  await mkdir(images, { recursive: true });
  await page.screenshot({
    path: path.join(images, name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
}
async function login(page: Page, e: Awaited<ReturnType<typeof customer>>) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
async function manager(page: Page) {
  const a = await admin();
  await page.goto('/zanyari/login');
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const response = page.waitForResponse((r) => r.url().endsWith('/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const c = await (await response).json();
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(c.challenge_id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
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
  await page.goto('/products/grade-1');
  await expect(page.getByRole('link', { name: 'خرید آزمایشی این پایه' })).toBeVisible();
  await shot(page, '01-grade-one-purchase');
  await page.getByRole('link', { name: 'خرید آزمایشی این پایه' }).click();
  await expect(page.locator('.commerce-totals')).toContainText('۱٬۲۹۹٬۰۰۰');
  await shot(page, '02-checkout-summary');
  await page.getByLabel('کد تخفیف', { exact: true }).fill('INVALID-CODE');
  await page.getByRole('button', { name: 'بررسی کد تخفیف' }).click();
  await expect(page.getByRole('alert')).toContainText('قابل استفاده نیست');
  await shot(page, '04-coupon-rejected');
  await page.getByLabel('کد تخفیف', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'بررسی کد تخفیف' }).click();
  await expect(page.locator('.commerce-totals')).toContainText('۱٬۱۶۹٬۱۰۰');
  await expect(
    page.getByText('کد تخفیف قابل استفاده است؛ سهمیه هنگام ثبت سفارش رزرو می‌شود.'),
  ).toBeVisible();
  await shot(page, '03-coupon-accepted');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, '15-mobile-checkout');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations).toEqual([]);
  await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
  await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]{36}$/);
  const order = page.url().split('/').pop()!;
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
  await page.getByLabel('طرح تخفیف', { exact: true }).selectOption({ label: name });
  const code = 'CLASS-' + randomBytes(3).toString('hex').toUpperCase();
  await page.getByLabel('کد تخفیف', { exact: true }).fill(code);
  await page.getByLabel('دلیل تغییر', { exact: true }).fill('ثبت کد محدود برای آزمون پرداخت');
  await page.getByRole('dialog').evaluate((el) => {
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
