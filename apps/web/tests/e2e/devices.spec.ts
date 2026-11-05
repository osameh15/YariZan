import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { customer, issue, password, sql } from '../../tools/test-fixtures.mjs';

const images = path.resolve('.local/screenshots/devices');
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
async function capture(page: import('@playwright/test').Page, name: string) {
  await mkdir(images, { recursive: true });
  await page.screenshot({ path: path.join(images, name + '.png'), fullPage: true });
}

test('customers name their devices, see every device of their mobile and the checkout device', async ({
  page,
}) => {
  const a = await customer(),
    b = await customer();
  // Two devices registered with the same verified mobile number.
  // A complete synthetic mobile: lookup is a 64-hex digest, ciphertext and last four digits are set.
  const lookup = createHash('sha256')
    .update('synthetic-shared-mobile-' + randomUUID())
    .digest('hex');
  await sql(
    "UPDATE customers SET mobile_lookup=$1,mobile_ciphertext='synthetic-ciphertext',mobile_last4='0000',mobile_verified_at=now() WHERE id=ANY($2::uuid[])",
    [lookup, [a.customer_id, b.customer_id]],
  );
  await issue(a);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
    await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(a.username);
    await page.getByLabel('رمز عبور', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);

    await page.goto('/account/devices');
    await page.getByLabel('نام دستگاه', { exact: true }).fill('رایانهٔ خانه');
    await page.getByRole('button', { name: 'ذخیرهٔ نام', exact: true }).click();
    await expect(page.getByText('نام دستگاه ذخیره شد.')).toBeVisible();
    const devices = page.locator('.device-list li');
    await expect(devices).toHaveCount(2);
    await expect(page.locator('.device-list li.is-current')).toContainText('رایانهٔ خانه');
    await expect(page.locator('.device-list li.is-current')).toContainText('همین دستگاه');
    await expect(devices.filter({ hasText: b.username })).toContainText('دستگاه بدون نام');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await capture(page, `account-devices-${width}`);

    await page.goto('/account/licenses');
    await expect(page.getByRole('heading', { name: 'یاریزان پایهٔ اول' })).toBeVisible();
    // An Admin-issued license is not a purchase: the customer cannot move it.
    await expect(page.getByRole('button', { name: 'انتقال به دستگاه دیگر' })).toHaveCount(0);
    await capture(page, `account-licenses-${width}`);

    await page.goto('/checkout?sku=YARIZAN-S-NUMBER-BUILDER');
    await expect(page.getByTestId('checkout-device')).toContainText('رایانهٔ خانه');
    await expect(page.getByTestId('checkout-device')).toContainText(a.username);
    await capture(page, `checkout-device-${width}`);
  }
});
