import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { customer, admin, password, smsCode, sql } from '../../tools/test-fixtures.mjs';

// Isolated full-application mode (production-built Nuxt + in-process API with fake providers).
const images = path.resolve('.local/screenshots/full-application');
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
async function shot(page: Page, name: string) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await mkdir(images, { recursive: true });
  await page.screenshot({
    path: path.join(images, name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
}
const hydrated = (page: Page) =>
  page.waitForFunction(
    () =>
      !!document.querySelector('#__nuxt') && '__vue_app__' in document.querySelector('#__nuxt')!,
  );

test('full mode lists six grades with live Backend prices; Coming Soon has no purchase', async ({
  page,
}) => {
  await page.goto('/products');
  // Prices come from the live Backend catalog (other suites may have edited them as Admin).
  await expect(page.locator('.product-card .price')).toHaveCount(6);
  await expect(page.locator('.product-card .price').first()).toContainText('تومان');
  await shot(page, '01-catalog-live-prices');
  await page.goto('/products/grade-2');
  await expect(page.locator('.detail-price')).toContainText('تومان');
  await expect(page.getByRole('link', { name: /خرید/ })).toHaveCount(0);
  await shot(page, '02-grade-2-coming-soon-with-price');
});

test('failed simulated payment is shown as failed and grants nothing', async ({ page }) => {
  const e = await customer();
  await page.goto('/login');
  await hydrated(page);
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/checkout?sku=YARIZAN-G1');
  await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
  await page.getByRole('button', { name: 'ادامه در شبیه‌ساز پرداخت' }).click();
  await expect(page).toHaveURL(/\/payment\/simulate\?order=/);
  const id = new URL(page.url()).searchParams.get('order')!;
  await page.getByRole('button', { name: 'شبیه‌سازی پرداخت ناموفق' }).click();
  await expect(page.locator('.order-state')).toBeVisible({ timeout: 15000 });
  await shot(page, '03-payment-failed');
  const licenses = await sql(
    'SELECT count(*)::int n FROM order_fulfillments f JOIN order_items i ON i.id=f.order_item_id WHERE i.order_id=$1',
    [id],
  );
  expect(licenses.rows[0].n).toBe(0);
});

test('Admin product pricing view reflects the append-only price history', async ({ page }) => {
  const a = await admin();
  await page.goto('/zanyari/login');
  await hydrated(page);
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const response = page.waitForResponse((r) => r.url().endsWith('/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const c = await (await response).json();
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(c.challenge_id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
  await page.goto('/zanyari/products');
  await expect(page.getByText('تومان').first()).toBeVisible();
  await shot(page, '04-admin-product-pricing');
  const history = await sql(
    "SELECT source,amount_irr::text a FROM product_prices WHERE sku='YARIZAN-G1' ORDER BY effective_at",
  );
  expect(['ADMIN', 'BOOTSTRAP']).toContain(history.rows.at(-1).source);
  expect(Number(history.rows.at(-1).a) % 10).toBe(0);
});
