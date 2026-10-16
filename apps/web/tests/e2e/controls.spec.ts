import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { admin, smsCode, sql } from '../../tools/test-fixtures.mjs';
const images = path.resolve('.local/screenshots/phase4-premium');
async function shot(page: Page, name: string) {
  await mkdir(images, { recursive: true });
  await page.screenshot({
    path: path.join(images, name + '.png'),
    fullPage: (await page.getByRole('dialog').count()) === 0,
    animations: 'disabled',
  });
}
async function manager(page: Page) {
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
  await page.goto('/zanyari/commerce');
  await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
}
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
test('Support copy, action spacing and YZ username examples remain readable', async ({ page }) => {
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'شرایط بررسی درخواست بازپرداخت' })).toBeVisible();
  expect(await page.locator('main').textContent()).not.toMatch(/\?{3,}/);
  await expect(page.locator('main a[href="tel:09369642754"]')).toHaveText('۰۹۳۶-۹۶۴-۲۷۵۴');
  const gap = await page
    .locator('.support-grid .button')
    .evaluate(
      (el) =>
        el.nextElementSibling!.getBoundingClientRect().top - el.getBoundingClientRect().bottom,
    );
  expect(gap).toBeGreaterThanOrEqual(12);
  await shot(page, '30-support-restored');
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, '31-mobile-support');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const route of ['/login', '/reset-password']) {
    await page.goto(route);
    await expect(page.getByLabel('نام کاربری دستگاه', { exact: true })).toHaveAttribute(
      'placeholder',
      'YZ-...',
    );
  }
  await page.goto('/login');
  await page.getByLabel('شمارهٔ همراه', { exact: true }).fill('09369642754');
  await expect(page.getByLabel('شمارهٔ همراه', { exact: true })).toHaveValue('۰۹۳۶۹۶۴۲۷۵۴');
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill('YZ-123456');
  await expect(page.getByLabel('نام کاربری دستگاه', { exact: true })).toHaveValue('YZ-123456');
  await page.goto('/zanyari/login');
  await expect(page.getByLabel('نام کاربری مدیریت')).not.toHaveAttribute('placeholder', 'YZ-...');
});
test('Persian calendar submits the exact Gregorian date and dropdown uses keyboard selection', async ({
  page,
}) => {
  await manager(page);
  await page.getByRole('button', { name: 'از تاریخ', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'تقویم شمسی از تاریخ' });
  await calendar.getByRole('spinbutton', { name: 'سال شمسی', exact: true }).fill('۱۴۰۳');
  for (
    let n = 0;
    n < 12 &&
    !(await calendar.locator('.calendar-navigation strong').textContent())?.includes('فروردین');
    n++
  )
    await calendar.getByRole('button', { name: 'ماه قبل', exact: true }).click();
  await expect(calendar.locator('.calendar-navigation')).toContainText('فروردین ۱۴۰۳');
  await shot(page, '32-persian-calendar');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  const first = calendar.getByRole('button', { name: '۱ فروردین ۱۴۰۳', exact: true });
  await first.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(calendar.getByRole('button', { name: '۲ فروردین ۱۴۰۳', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(calendar).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'از تاریخ', exact: true })).toContainText(
    '۱ فروردین ۱۴۰۳',
  );
  const combo = page.getByRole('combobox', { name: 'وضعیت', exact: true });
  await combo.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(combo).toContainText('در انتظار');
  const requested = page.waitForRequest(
    (r) => r.url().includes('/admin/commerce/orders?') && r.url().includes('from='),
  );
  await page.getByRole('button', { name: 'جست‌وجو و تازه‌سازی' }).click();
  const query = new URL((await requested).url()).searchParams;
  expect(query.get('from')).toBe(
    await page.evaluate(() => new Date('2024-03-20T00:00:00').toISOString()),
  );
  expect(query.get('state')).toBe('PENDING');
  await page.getByRole('button', { name: 'از تاریخ', exact: true }).click();
  await calendar.getByRole('button', { name: 'پاک کردن تاریخ' }).click();
  await expect(page.getByRole('button', { name: 'از تاریخ', exact: true })).toContainText(
    'انتخاب تاریخ',
  );
  await combo.click();
  await shot(page, '33-custom-dropdown');
  await page.keyboard.press('Escape');
  await expect(combo).toBeFocused();
});
test('Mobile campaign calendar and steppers keep save reachable without native controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await manager(page);
  await page.getByRole('link', { name: 'طرح‌های تخفیف', exact: true }).click();
  await page.getByRole('button', { name: 'ساخت طرح تخفیف', exact: true }).click();
  const dialog = page.getByRole('dialog'),
    save = dialog.getByRole('button', { name: 'ثبت تغییرات', exact: true });
  await dialog.getByRole('button', { name: 'شروع (زمان محلی)', exact: true }).click();
  await expect(save).toBeInViewport();
  await dialog.getByRole('spinbutton', { name: 'ساعت', exact: true }).fill('۱۰');
  await dialog.getByRole('spinbutton', { name: 'دقیقه', exact: true }).fill('۳۰');
  await expect(dialog.getByRole('button', { name: 'شروع (زمان محلی)', exact: true })).toContainText(
    '۱۰:۳۰',
  );
  await expect
    .poll(async () => {
      const input = await dialog
        .getByRole('spinbutton', { name: 'دقیقه', exact: true })
        .boundingBox();
      const popup = await dialog.locator('.persian-calendar').boundingBox();
      return (
        !!input && !!popup && input.y >= popup.y && input.y + input.height <= popup.y + popup.height
      );
    })
    .toBe(true);
  await shot(page, '34-mobile-calendar-time');
  await expect(save).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'افزایش سقف کل استفاده (صفر بدون سقف)', exact: true })
    .click();
  await expect(
    dialog.getByRole('spinbutton', { name: 'سقف کل استفاده (صفر بدون سقف)', exact: true }),
  ).toHaveValue('۱۰۱');
  await dialog
    .getByRole('button', { name: 'کاهش سقف کل استفاده (صفر بدون سقف)', exact: true })
    .click();
  await expect(
    dialog.getByRole('spinbutton', { name: 'سقف کل استفاده (صفر بدون سقف)', exact: true }),
  ).toHaveValue('۱۰۰');
  await shot(page, '35-custom-steppers');
  await expect(
    page.locator('select,input[type="date"],input[type="datetime-local"],input[type="number"]'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
