import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { admin, customer, password, smsCode, sql } from '../../tools/test-fixtures.mjs';

const widths = [1440, 1024, 768, 390, 320];
const rows = [
  '.device-name-form',
  '.coupon-form',
  '.data-toolbar',
  '.toolbar-row',
  '.data-table-footer',
  '.actions',
  '.table-actions',
  '.row-actions',
  '.number-stepper',
].join(',');

async function checkLayout(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const problems = await page.locator(rows).evaluateAll((groups) => {
    const issues: string[] = [];
    for (const group of groups) {
      const rowItem = (control: HTMLElement) => {
        let item: Element = control;
        while (item.parentElement && item.parentElement !== group) item = item.parentElement;
        return item.getBoundingClientRect();
      };
      const controls = Array.from(
        group.querySelectorAll<HTMLElement>(
          group.matches('.number-stepper')
            ? 'input, button'
            : 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not(.validation-proxy), .button, .select-trigger, .date-trigger, .segmented',
        ),
      ).filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          (group.matches('.number-stepper') || !el.closest('.persian-calendar'))
        );
      });
      for (let i = 0; i < controls.length; i++) {
        for (const other of controls.slice(i + 1)) {
          const control = controls[i]!;
          if (control.contains(other) || other.contains(control)) continue;
          const a = control.getBoundingClientRect(),
            b = other.getBoundingClientRect();
          const itemA = rowItem(control),
            itemB = rowItem(other);
          const overlap = Math.min(itemA.bottom, itemB.bottom) - Math.max(itemA.top, itemB.top);
          // A responsive wrap is fine; controls sharing a row must share its center.
          if (overlap < Math.min(itemA.height, itemB.height) / 2) continue;
          const delta = Math.abs(a.top + a.height / 2 - b.top - b.height / 2);
          if (delta > 2)
            issues.push(
              `${group.className}: ${control.className || control.tagName} / ${other.className || other.tagName}: ${delta.toFixed(1)}px`,
            );
        }
      }
    }
    return issues;
  });
  expect.soft(problems, `Control alignment at ${page.url()}`).toEqual([]);
  expect
    .soft(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Horizontal overflow at ${page.url()}`,
    )
    .toBe(true);
}

async function capture(page: Page, name: string) {
  await mkdir('.local/screenshots/control-layout', { recursive: true });
  await page.screenshot({ path: `.local/screenshots/control-layout/${name}.png`, fullPage: true });
}

test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});

test('customer forms, checkout coupons and public actions align across viewport sizes', async ({
  page,
}) => {
  const c = await customer();
  await page.goto('/login');
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(c.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  for (const route of [
    '/account/devices',
    '/account/security',
    '/checkout?sku=YARIZAN-S-NUMBER-BUILDER',
    '/download',
    '/support',
  ]) {
    await page.goto(route);
    if (route === '/account/devices') await expect(page.locator('.device-name-form')).toBeVisible();
    if (route.startsWith('/checkout')) await expect(page.locator('.coupon-form')).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout(page);
      if (route === '/account/devices') {
        const input = await page.locator('.device-name-form input').boundingBox();
        const button = await page.locator('.device-name-form .button').boundingBox();
        expect(Math.abs(input!.height - button!.height)).toBeLessThanOrEqual(2);
      }
      if (
        (route === '/account/devices' || route.startsWith('/checkout')) &&
        [1440, 390].includes(width)
      )
        await capture(page, `${route === '/account/devices' ? 'devices' : 'checkout'}-${width}`);
    }
    if (route.startsWith('/checkout')) {
      await page.locator('.coupon-form input').fill('!');
      await page.locator('.coupon-form .button').click();
      await expect(page.locator('.coupon-form .form-summary')).toBeVisible();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await checkLayout(page);
      }
    }
  }
});

test('admin search, device filters, pagination and dialogs align across viewport sizes', async ({
  page,
}) => {
  test.setTimeout(120000);
  const a = await admin();
  await page.goto('/zanyari/login');
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const sent = page.waitForResponse((r) => r.url().endsWith('/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const id = (await (await sent).json()).challenge_id;
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
  for (const route of [
    '/zanyari/products',
    '/zanyari/devices',
    '/zanyari/customers',
    '/zanyari/licenses',
    '/zanyari/commerce',
    '/zanyari/commerce?section=campaigns',
    '/zanyari/commerce?section=finance',
  ]) {
    await page.goto(route);
    await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.toolbar-row, .data-toolbar').first()).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout(page);
      if (route === '/zanyari/products' && [1440, 390].includes(width))
        await capture(page, `products-${width}`);
    }
    if (route === '/zanyari/products') {
      const size = page.getByRole('combobox', { name: 'تعداد در هر صفحه' });
      await size.click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.getByRole('option', { name: '۱۰ ردیف', exact: true }).click();
      await expect(size).toContainText('۱۰ ردیف');
      await checkLayout(page);
    }
    if (route === '/zanyari/products') {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole('button', { name: 'مدیریت', exact: true }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await checkLayout(page);
      }
      await page.getByRole('dialog').getByRole('button', { name: 'بستن پنجره' }).click();
    }
    if (route === '/zanyari/commerce') {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.getByRole('button', { name: 'از تاریخ', exact: true }).click();
        await expect(page.getByRole('region', { name: 'تقویم شمسی از تاریخ' })).toBeVisible();
        await checkLayout(page);
        await capture(page, `commerce-calendar-${width}`);
        await page.keyboard.press('Escape');
      }
    }
    if (route === '/zanyari/commerce?section=campaigns') {
      await page.getByRole('button', { name: 'ساخت طرح تخفیف', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await checkLayout(page);
      }
      await page.keyboard.press('Escape');
    }
  }
});
