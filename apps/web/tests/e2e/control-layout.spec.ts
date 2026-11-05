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
  '.auth-tabs',
  '.pagination',
].join(',');

async function checkLayout(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const toggleProblems = await page
    .locator('input[type="radio"], input[type="checkbox"]')
    .evaluateAll((inputs) =>
      inputs.flatMap((input) => {
        // Download grade cards intentionally use an invisible radio over the whole card.
        if (input.closest('.grade-card') && getComputedStyle(input).opacity === '0') return [];
        const box = input.getBoundingClientRect();
        return box.width &&
          box.height &&
          (box.width < 16 || box.width > 24 || box.height < 16 || box.height > 24)
          ? [`${input.getAttribute('type')}: ${box.width} × ${box.height}`]
          : [];
      }),
    );
  expect.soft(toggleProblems, `Radio and checkbox sizing at ${page.url()}`).toEqual([]);
  const overflow = await page
    .locator('.dialog, .device-choice')
    .evaluateAll((elements) =>
      elements
        .filter((el) => el.clientWidth && el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.className),
    );
  expect.soft(overflow, `Component overflow at ${page.url()}`).toEqual([]);
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

test('public and authentication controls fit at every viewport size', async ({ page }) => {
  test.setTimeout(120000);
  for (const path of [
    '/',
    '/products',
    '/products/grade-1',
    '/special-products',
    '/special-products/number-builder',
    '/special-products/bundle-builder',
    '/download',
    '/support',
    '/connect',
    '/login',
    '/reset-password',
    '/support-reset',
    '/zanyari/login',
    '/legal',
    '/legal/terms',
    '/legal/privacy',
    '/legal/refund',
    '/legal/delivery',
    '/legal/disputes',
    '/legal/merchant-info',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('main')).toBeVisible();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout(page);
    }
  }
});

// Layout fixtures deliberately include the states that ordinary single-device logins never show.
// Backend move eligibility is covered separately; no transfer or real SMS is sent in these tests.
const choiceDevices = [
  {
    username: 'YZ-0B13-25B1-9EB5-B736-37D3-E713',
    label: 'لپ‌تاپ شخصی',
    current: true,
    created_at: '2026-11-01T10:00:00Z',
  },
  {
    username: 'YZ-DC7B-F376-06DA-B110-30AF-7AFA',
    label: null,
    current: false,
    created_at: '2026-11-02T10:00:00Z',
  },
  {
    username: 'YZ-AAAA-BBBB-CCCC-DDDD-EEEE-FFFF',
    label: 'رایانهٔ شخصی برای بازی و یادگیری در خانه',
    current: false,
    created_at: '2026-11-03T10:00:00Z',
  },
];

async function checkDeviceChoices(page: Page, name: string) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await checkLayout(page);
    for (const card of await page.locator('.device-choice').all()) {
      const bounds = await card.boundingBox();
      const text = await card.locator('span').boundingBox();
      expect(text!.width).toBeGreaterThan(100);
      expect(text!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(text!.x + text!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
      const date = card.locator(':scope > small');
      if (await date.count()) {
        const dateBounds = await date.boundingBox();
        expect(dateBounds!.y).toBeGreaterThanOrEqual(text!.y + text!.height);
      }
    }
    if ([1440, 390].includes(width)) await capture(page, `${name}-${width}`);
  }
  const radios = page.locator('.device-choice input[type="radio"]');
  await radios.last().check();
  await expect(radios.last()).toBeChecked();
  await radios.first().focus();
  await page.keyboard.press('Space');
  await expect(radios.first()).toBeChecked();
}

test('multiple-device OTP login keeps radios compact and names, IDs and dates readable', async ({
  page,
}) => {
  await page.route('**/api/v2/auth/otp/request', (route) =>
    route.fulfill({
      status: 201,
      json: { challenge_id: '11111111-1111-4111-8111-111111111111', retry_after: 0 },
    }),
  );
  await page.route('**/api/v2/auth/otp/verify', (route) =>
    route.fulfill({ status: 201, json: { select: choiceDevices } }),
  );
  await page.goto('/login');
  await page.getByLabel('شمارهٔ همراه', { exact: true }).fill('09123456789');
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  await page.getByLabel('کد تأیید پیامکی').fill('123456');
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page.locator('.device-choice')).toHaveCount(3);
  await checkDeviceChoices(page, 'login-device-picker');
});

test('license transfer dialog keeps target-device cards inside the dialog at every width', async ({
  page,
}) => {
  const entitlement = {
    id: '22222222-2222-4222-8222-222222222222',
    sku: 'YARIZAN-G1',
    state: 'ACTIVE',
    customer_can_move: true,
  };
  await page.route('**/api/v2/account{,/**}', (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      '/api/v2/account': {
        ...choiceDevices[0],
        generation: 1,
        device_id: '33333333-3333-4333-8333-333333333333',
      },
      '/api/v2/account/devices': [],
      '/api/v2/account/licenses': [],
      '/api/v2/account/entitlements': [entitlement],
      '/api/v2/account/device-list': choiceDevices,
      '/api/v2/account/movable-licenses': [entitlement],
    };
    return path in responses ? route.fulfill({ json: responses[path] }) : route.continue();
  });
  await page.goto('/account/licenses');
  await page.getByRole('button', { name: 'انتقال به دستگاه دیگر', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.device-choice')).toHaveCount(2);
  await checkDeviceChoices(page, 'transfer-device-picker');
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
    '/account',
    '/account/devices',
    '/account/licenses',
    '/account/security',
    '/account/orders',
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
    '/zanyari/trials',
    '/zanyari/activation-codes',
    '/zanyari/audit',
    '/zanyari/commerce',
    '/zanyari/commerce?section=payments',
    '/zanyari/commerce?section=campaigns',
    '/zanyari/commerce?section=coupons',
    '/zanyari/commerce?section=reservations',
    '/zanyari/commerce?section=redemptions',
    '/zanyari/commerce?section=jobs',
    '/zanyari/commerce?section=exceptions',
    '/zanyari/commerce?section=refunds',
    '/zanyari/commerce?section=finance',
  ]) {
    await page.goto(route);
    await expect(page.locator('.portal-main')).toHaveAttribute('aria-busy', 'false');
    if (route !== '/zanyari/audit')
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
