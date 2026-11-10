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
    const otherTab = await page.context().newPage();
    await otherTab.goto('/account/licenses');
    await expect(otherTab.locator('.current-device')).toContainText(a.username);
    if (width === 390) {
      const manyDevices = Array.from({ length: 30 }, (_, index) => ({
        username:
          index === 0
            ? a.username
            : `YZ-0000-0000-0000-0000-0000-${String(index).padStart(4, '0')}`,
        label: `رایانهٔ آموزشی شمارهٔ ${index + 1}`,
        current: index === 0,
        created_at: '2026-11-10T00:00:00Z',
      }));
      await page.route('**/api/v2/account/device-list', (route) =>
        route.fulfill({ json: manyDevices }),
      );
      await page.getByRole('button', { name: 'خرید برای دستگاه دیگر', exact: true }).click();
      await expect(page.getByRole('dialog').locator('.device-choice')).toHaveCount(30);
      await page.getByRole('dialog').locator('.device-choice').last().click();
      await expect(
        page.getByRole('button', { name: 'انتخاب این دستگاه', exact: true }),
      ).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await capture(page, 'device-switch-many-mobile');
      await page.getByRole('button', { name: 'انصراف', exact: true }).click();
      await page.unroute('**/api/v2/account/device-list');
    }
    const authRequests: string[] = [];
    const recordAuth = (request: import('@playwright/test').Request) => {
      if (/\/api\/v2\/auth\/(?:login|logout|otp)/.test(request.url()))
        authRequests.push(request.url());
    };
    page.on('request', recordAuth);
    const oldCookies = await page.context().cookies();
    await page.getByRole('button', { name: 'خرید برای دستگاه دیگر' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.device-choice')).toHaveCount(2);
    await dialog.locator('.device-choice').filter({ hasText: b.username }).click();
    await capture(page, `device-switch-dialog-${width}`);
    await dialog.getByRole('button', { name: 'انتخاب این دستگاه', exact: true }).click();
    await expect(page.getByTestId('checkout-device')).toContainText(b.username);
    await expect(page.locator('.checkout-submit')).toBeEnabled();
    await expect(page).toHaveURL(/\/checkout\?sku=YARIZAN-S-NUMBER-BUILDER$/);
    await expect(otherTab.locator('.current-device')).toContainText(b.username);
    await expect(
      otherTab.getByRole('heading', { name: 'یاریزان پایهٔ اول', exact: true }),
    ).toHaveCount(0);
    const freshCookies = await page.context().cookies();
    expect(freshCookies.find((c) => c.name === 'yz_customer')!.value).not.toBe(
      oldCookies.find((c) => c.name === 'yz_customer')!.value,
    );
    // A stale tab must not create an order for the newly selected device by accident.
    const stale = await page.request.post('/api/v2/orders', {
      headers: {
        Origin: 'http://localhost:3200',
        'X-CSRF-Token': freshCookies.find((c) => c.name === 'yz_csrf_customer')!.value,
        'X-YariZan-Device': a.device_id,
      },
      data: { request_id: randomUUID(), sku: 'YARIZAN-G1' },
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe('DEVICE_CONTEXT_CHANGED');
    await page.goto('/checkout?sku=YARIZAN-G1');
    await expect(page.getByTestId('checkout-device')).toContainText(b.username);
    await expect(page.locator('.checkout-submit')).toBeEnabled();
    await expect(page.getByTestId('checkout-owned')).toHaveCount(0);
    await page.locator('.checkout-submit').click();
    await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]{36}$/);
    const orderId = new URL(page.url()).pathname.split('/').pop()!;
    expect(
      (await sql('SELECT device_id FROM orders WHERE id=$1', [orderId])).rows[0].device_id,
    ).toBe(b.device_id);
    expect(
      (
        await page.request.post(`/api/v2/orders/${orderId}/cancel`, {
          headers: {
            Origin: 'http://localhost:3200',
            'X-CSRF-Token': freshCookies.find((c) => c.name === 'yz_csrf_customer')!.value,
          },
          data: {},
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/account/devices');
    await page.getByRole('button', { name: 'تغییر دستگاه', exact: true }).click();
    await page
      .getByRole('dialog')
      .locator('.device-choice')
      .filter({ hasText: a.username })
      .click();
    await page.getByRole('button', { name: 'انتخاب این دستگاه', exact: true }).click();
    await expect(page.locator('.current-device')).toContainText(a.username);
    await expect(otherTab.locator('.current-device')).toContainText(a.username);
    expect(authRequests).toEqual([]);
    page.off('request', recordAuth);
    await otherTab.close();
  }
});
