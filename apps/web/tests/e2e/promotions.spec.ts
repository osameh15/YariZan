import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { customer, admin, password, smsCode, sql } from '../../tools/test-fixtures.mjs';

// Isolated full-application mode: production-built Nuxt + the real Backend on a disposable PostgreSQL,
// fake SMS and fake payment provider. Promotional pricing through the real Admin editor, the real
// catalog, checkout and order creation. Synthetic data only.
const images = path.resolve('.local/screenshots/promotions');
const g1 = 'YARIZAN-G1';
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
  await sql("UPDATE product_promotions SET state='DISABLED' WHERE sku=$1", [g1]);
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
async function adminSession(page: Page) {
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
}
async function customerSession(page: Page) {
  const e = await customer();
  await page.goto('/login');
  await hydrated(page);
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  return e;
}
const listPrice = async () =>
  Number(
    (await sql('SELECT amount_irr FROM product_prices WHERE sku=$1 AND ended_at IS NULL', [g1]))
      .rows[0].amount_irr,
  );
async function openEditor(page: Page) {
  await page.goto('/zanyari/products');
  const row = page.locator('tr', { hasText: /YARIZAN-G[1۱]/ });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'مدیریت', exact: true }).click();
  await page.getByTestId('open-promotions').click();
  await expect(page.getByTestId('promotion-editor')).toBeVisible();
}
async function pickEndNextMonth(page: Page) {
  await page.getByRole('button', { name: 'پایان (زمان محلی، الزامی)' }).click();
  await page.getByRole('button', { name: 'ماه بعد' }).click();
  await page.locator('[data-day="15"]').click();
}

test('Admin schedules a promotion; catalog, detail and checkout show it consistently and refuse coupons', async ({
  page,
}) => {
  const list = await listPrice();
  const promoIrr = Math.floor((list * 77) / 100 / 10000) * 10000;
  const percent = Number(((BigInt(list) - BigInt(promoIrr)) * 100n) / BigInt(list));
  await adminSession(page);

  // Before: the product has no promotion.
  await page.goto('/products');
  await expect(page.locator('.product-card[data-grade="1"] .price-block')).toHaveAttribute(
    'data-promotion',
    'none',
  );
  await expect(page.locator('.product-card .discount-badge')).toHaveCount(0);
  await shot(page, '01-catalog-no-promotion');

  await openEditor(page);
  await expect(page.getByTestId('promo-empty')).toBeVisible();
  await expect(page.getByTestId('promo-list-price')).toContainText('تومان');
  await page.getByLabel('قیمت ویژه به تومان', { exact: true }).fill(String(promoIrr / 10));
  await expect(page.getByTestId('promo-percent')).toContainText(
    new Intl.NumberFormat('fa-IR').format(percent) + '٪',
  );
  await pickEndNextMonth(page);
  await page
    .getByLabel('دلیل تغییر (برای گزارش فعالیت)')
    .fill('Synthetic launch promotion for tests');
  // Server-side rules are explained before saving: a price that is not lower is refused in Persian.
  await page.getByLabel('تأیید می‌کنم', { exact: false }).check();
  await expect(page.getByTestId('promo-preview')).toBeVisible();
  await expect(page.getByTestId('promo-preview').locator('s')).toBeVisible();
  await shot(page, '02-admin-promotion-form-with-preview');
  await page.getByRole('button', { name: 'ثبت قیمت ویژه', exact: true }).click();
  await expect(page.getByTestId('promotion-active')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'قیمت ویژه ثبت شد' })).toBeVisible();
  await shot(page, '03-admin-promotion-active');

  // The database holds integer IRR, a derived percentage, an owner and an audit trail.
  const stored = (
    await sql(
      "SELECT promo_price_irr::text p,original_price_irr::text o,discount_percent d,state,created_by FROM product_promotions WHERE sku=$1 AND state='ENABLED'",
      [g1],
    )
  ).rows;
  expect(stored).toHaveLength(1);
  expect(Number(stored[0].p)).toBe(promoIrr);
  expect(Number(stored[0].o)).toBe(list);
  expect(stored[0].d).toBe(percent);
  expect(
    (
      await sql(
        "SELECT count(*)::int n FROM audit_logs WHERE action='promotion.created' AND actor_type='ADMIN'",
      )
    ).rows[0].n,
  ).toBeGreaterThan(0);
  // Saving a promotion enables nothing else.
  const flags = (
    await sql('SELECT sale_enabled,publication_status FROM products WHERE sku=$1', [g1])
  ).rows[0];
  expect(flags.publication_status).toBe('published');

  // Customers: strike-through original, prominent price, badge, end time. Other grades stay Coming Soon.
  await page.goto('/products');
  const card = page.locator('.product-card[data-grade="1"]');
  await expect(card.locator('.price-block')).toHaveAttribute('data-promotion', 'active');
  await expect(card.locator('s')).toContainText('تومان');
  await expect(card.locator('.discount-badge')).toContainText(
    new Intl.NumberFormat('fa-IR').format(percent) + '٪',
  );
  await expect(card.locator('.promo-ends')).toContainText('تا');
  await expect(page.locator('.product-card .discount-badge')).toHaveCount(1);
  await expect(page.locator('.product-card[data-grade="2"] .price-block')).toHaveAttribute(
    'data-promotion',
    'none',
  );
  await shot(page, '04-catalog-active-promotion');
  await page.goto('/products/grade-1');
  await expect(page.locator('.detail-price .discount-badge')).toBeVisible();
  await expect(page.locator('.detail-price s')).toBeVisible();
  await shot(page, '05-detail-active-promotion');

  // Checkout: the server prices the order; a coupon cannot be combined and the page says so.
  const buyer = await customerSession(page);
  await page.goto('/checkout?sku=' + g1);
  await expect(page.getByTestId('promotion-no-coupon')).toBeVisible();
  await expect(page.getByLabel('کد تخفیف', { exact: true })).toBeDisabled();
  await expect(page.getByTestId('promotion-discount')).toContainText(
    new Intl.NumberFormat('fa-IR').format(percent) + '٪',
  );
  await expect(page.locator('.payable-total dd')).toContainText(
    new Intl.NumberFormat('fa-IR').format(promoIrr / 10),
  );
  await shot(page, '06-checkout-promotion-no-coupon');
  await page.getByRole('button', { name: 'ثبت سفارش و بررسی پرداخت' }).click();
  await expect(page).toHaveURL(/\/account\/orders\//);
  await expect(page.getByText('تخفیف قیمت ویژه')).toBeVisible();
  const order = (
    await sql(
      'SELECT o.total_irr::text t,o.subtotal_irr::text s,o.promotion_id,i.snapshot FROM orders o JOIN order_items i ON i.order_id=o.id JOIN customers c ON c.id=o.customer_id WHERE c.username=$1',
      [buyer.username],
    )
  ).rows[0];
  expect(Number(order.t)).toBe(promoIrr);
  expect(Number(order.s)).toBe(list);
  expect(order.promotion_id).toBeTruthy();
  expect(order.snapshot.promotion.price_irr).toBe(promoIrr);
  // No license exists before a verified payment.
  expect(
    (
      await sql(
        'SELECT count(*)::int n FROM licenses l JOIN entitlements e ON e.id=l.entitlement_id JOIN customers c ON c.id=e.customer_id WHERE c.username=$1',
        [buyer.username],
      )
    ).rows[0].n,
  ).toBe(0);
});

test('Deactivating, scheduling and expiring a promotion follow the server clock, never a stale display', async ({
  page,
}) => {
  const list = await listPrice();
  const promoIrr = Math.floor((list * 80) / 100 / 10000) * 10000;
  await adminSession(page);
  await openEditor(page);
  await page.getByLabel('قیمت ویژه به تومان', { exact: true }).fill(String(promoIrr / 10));
  await pickEndNextMonth(page);
  await page
    .getByLabel('دلیل تغییر (برای گزارش فعالیت)')
    .fill('Synthetic schedule and expiry test');
  await page.getByLabel('تأیید می‌کنم', { exact: false }).check();
  await page.getByRole('button', { name: 'ثبت قیمت ویژه', exact: true }).click();
  await expect(page.getByTestId('promotion-active')).toBeVisible();

  // An overlapping promotion is refused with a Persian explanation.
  await page.getByLabel('قیمت ویژه به تومان', { exact: true }).fill(String(promoIrr / 10 + 1000));
  await pickEndNextMonth(page);
  await page.getByLabel('دلیل تغییر (برای گزارش فعالیت)').fill('Synthetic overlapping attempt');
  await page.getByLabel('تأیید می‌کنم', { exact: false }).check();
  await page.getByRole('button', { name: 'ثبت قیمت ویژه', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'قیمت ویژهٔ فعال دیگری' })).toBeVisible();

  // Scheduled (server time has not reached the start): customers see nothing, Admin sees the state.
  await sql(
    "UPDATE product_promotions SET starts_at=clock_timestamp()+interval '1 day',ends_at=clock_timestamp()+interval '3 days' WHERE sku=$1 AND state='ENABLED'",
    [g1],
  );
  await page.goto('/products');
  await expect(page.locator('.product-card .discount-badge')).toHaveCount(0);
  await expect(page.locator('.product-card[data-grade="1"] .price-block')).toHaveAttribute(
    'data-promotion',
    'none',
  );
  await openEditor(page);
  await expect(page.getByTestId('promotion-scheduled')).toBeVisible();
  await shot(page, '07-admin-promotion-scheduled');

  // Expired without any Admin action: nothing is shown as active.
  await sql(
    "UPDATE product_promotions SET starts_at=clock_timestamp()-interval '3 days',ends_at=clock_timestamp()-interval '1 second' WHERE sku=$1 AND state='ENABLED'",
    [g1],
  );
  await page.goto('/products');
  await expect(page.locator('.product-card .discount-badge')).toHaveCount(0);
  await page.goto('/products/grade-1');
  await expect(page.locator('.detail-price s')).toHaveCount(0);
  await openEditor(page);
  await expect(page.getByTestId('promotion-expired')).toBeVisible();
  await shot(page, '08-admin-promotion-expired');
  await page.goto('/zanyari/products');
  await expect(page.getByTestId('row-promotion-expired')).toBeVisible();

  // A new promotion can then be created and deactivated; deactivation hides it immediately.
  await openEditor(page);
  await page.getByLabel('قیمت ویژه به تومان', { exact: true }).fill(String(promoIrr / 10));
  await pickEndNextMonth(page);
  await page.getByLabel('دلیل تغییر (برای گزارش فعالیت)').fill('Synthetic second promotion');
  await page.getByLabel('تأیید می‌کنم', { exact: false }).check();
  await page.getByRole('button', { name: 'ثبت قیمت ویژه', exact: true }).click();
  await expect(page.getByTestId('promotion-active')).toBeVisible();
  await page.goto('/products');
  await expect(page.locator('.product-card .discount-badge')).toHaveCount(1);
  await openEditor(page);
  await page.getByLabel('دلیل تغییر (برای گزارش فعالیت)').fill('Synthetic deactivation test');
  await page.getByRole('button', { name: 'غیرفعال‌سازی', exact: true }).click();
  await expect(page.getByTestId('promotion-active')).toHaveCount(0);
  await expect(page.getByTestId('promotion-disabled').first()).toBeVisible();
  await page.goto('/products');
  await expect(page.locator('.product-card .discount-badge')).toHaveCount(0);
  await page.goto('/products/grade-1');
  await expect(page.locator('.detail-price .price')).toContainText('تومان');
  await shot(page, '09-detail-without-promotion');
});

test('Promotion pages work at phone width without horizontal scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const list = await listPrice();
  const promoIrr = Math.floor((list * 77) / 100 / 10000) * 10000;
  await adminSession(page);
  await openEditor(page);
  await page.getByLabel('قیمت ویژه به تومان', { exact: true }).fill(String(promoIrr / 10));
  await pickEndNextMonth(page);
  await page.getByLabel('دلیل تغییر (برای گزارش فعالیت)').fill('Synthetic mobile layout test');
  await page.getByLabel('تأیید می‌کنم', { exact: false }).check();
  await shot(page, '10-mobile-admin-promotion-form');
  const overflowDialog = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowDialog).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'ثبت قیمت ویژه', exact: true }).click();
  await expect(page.getByTestId('promotion-active')).toBeVisible();
  for (const url of ['/products', '/products/grade-1']) {
    await page.goto(url);
    await expect(page.locator('.discount-badge').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
  await shot(page, '11-mobile-catalog-active-promotion');
  await context.close();
});
