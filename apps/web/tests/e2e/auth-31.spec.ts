import { persianDigits } from '../../shared/digits';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import {
  pairing,
  customer,
  call,
  proof,
  password,
  admin,
  sql,
  smsCode,
  nextMobile,
} from '../../tools/test-fixtures.mjs';
const images = path.resolve('.local/screenshots/phase3-1');
test('Customer OTP is default, keyboard switching preserves password alternative and Admin primary factor', async ({
  page,
}) => {
  const e = await customer();
  await page.goto('/login');
  const otp = page.getByRole('button', { name: 'ورود با کد یک‌بارمصرف', exact: true });
  const pwd = page.getByRole('button', { name: 'ورود با رمز عبور', exact: true });
  await expect(otp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('شمارهٔ همراه', { exact: true })).toBeVisible();
  await expect(page.getByLabel('رمز عبور', { exact: true })).toHaveCount(0);
  await pwd.focus();
  await page.keyboard.press('Enter');
  await expect(pwd).toHaveAttribute('aria-pressed', 'true');
  await expect(otp).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('رمز عبور', { exact: true })).toBeVisible();
  await otp.focus();
  await page.keyboard.press('Space');
  await expect(otp).toHaveAttribute('aria-pressed', 'true');
  await pwd.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('نام کاربری دستگاه', { exact: true }).fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole('button', { name: 'خروج از حساب', exact: true }).click();
  await expect(otp).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/zanyari/login');
  await expect(page.getByLabel('رمز عبور', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'روش ورود' })).toHaveCount(0);
});
async function shot(page: Page, name: string) {
  await mkdir(images, { recursive: true });
  await page.screenshot({
    path: path.join(images, name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
}
test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});
async function send(page: Page, route: string) {
  const response = page.waitForResponse((r) => r.url().endsWith(route));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const r = await response;
  expect(r.status()).toBe(201);
  return (await r.json()).challenge_id;
}
// SMS login needs only the mobile number (2.1.0); the device ID is asked only for password login.
async function otpLogin(page: Page, username: string, mobile: string) {
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'ورود با کد یک‌بارمصرف', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('نام کاربری دستگاه', { exact: true })).toHaveCount(0);
  await page.getByLabel('شمارهٔ همراه', { exact: true }).fill(mobile);
  const id = await send(page, '/api/v2/auth/otp/request');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
}
async function adminLogin(page: Page) {
  const a = await admin();
  await page.goto('/zanyari/login');
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const id = await send(page, '/api/v2/admin/auth/login');
  await shot(page, '16-admin-sms-mfa');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(id));
  await page.getByRole('button', { name: 'تأیید کد و ورود' }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
  return a;
}
test('Custom Persian validation replaces native bubbles on Connect, login and Admin', async ({
  page,
}) => {
  for (const route of ['/connect', '/login', '/zanyari/login', '/reset-password']) {
    await page.goto(route);
    await expect(page.locator('form')).toHaveAttribute('novalidate', '');
    await page.locator('form button[type=submit],form .button.primary').last().click();
    await expect(page.locator('.form-summary')).toContainText('اصلاح');
    await expect(page.locator('[aria-invalid=true]').first()).toBeFocused();
    expect(await page.locator('body').textContent()).not.toMatch(
      /Please fill|Invalid input|TypeError|HttpError/,
    );
    if (route === '/connect') await shot(page, '12-connect-validation');
  }
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations).toEqual([]);
});
test('OTP-only first claim, OTP login, optional password setup and masked mobile security', async ({
  page,
}) => {
  const p = await pairing(),
    mobile = nextMobile();
  const bodies: string[] = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/v2/'))
      try {
        bodies.push(await r.text());
      } catch {
        /* aborted response */
      }
  });
  await page.goto('/connect');
  await page.getByLabel('شناسهٔ درخواست').fill(p.pairing_id);
  await page.getByLabel('کد موقت اتصال').fill(p.pairing_secret);
  await page.getByRole('button', { name: 'بررسی درخواست' }).click();
  const username = (await page.locator('.device-username').textContent())!.trim();
  await page.getByLabel('شمارهٔ همراه', { exact: true }).fill(mobile);
  await shot(page, '13-first-claim-mobile');
  const otp = await send(page, '/api/v2/auth/claim/otp/request');
  await shot(page, '14-first-claim-otp');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(otp));
  await page.getByRole('button', { name: 'تأیید شماره و اتصال' }).click();
  await expect(page.getByRole('heading', { name: 'اتصال در مرورگر تأیید شد' })).toBeVisible();
  expect(bodies.join('')).not.toMatch(/"(?:credential|enrollment|private_key|claim_grant)"/);
  expect(
    (
      await call(
        `/device-pairings/${p.pairing_id}/pickup`,
        await proof(p.key, 'CONFIRM', p.pairing_id),
      )
    ).status,
  ).toBe(201);
  await shot(page, '29-first-claim-authenticated');
  await page.getByRole('link', { name: 'رفتن به پیشخوان حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'نمای کلی', exact: true })).toBeVisible();
  expect(bodies.filter((b) => /"challenge_id"/.test(b))).toHaveLength(1);
  expect((await page.context().cookies()).find((c) => c.name === 'yz_customer')?.httpOnly).toBe(
    true,
  );
  expect(
    (await sql('SELECT count(*) FROM otp_challenges WHERE pairing_id=$1', [p.pairing_id])).rows[0]
      .count,
  ).toBe('1');
  expect(
    (
      await sql(
        "SELECT count(*) FROM otp_challenges WHERE purpose='LOGIN' AND principal_id=(SELECT authorized_customer_id FROM pairings WHERE id=$1)",
        [p.pairing_id],
      )
    ).rows[0].count,
  ).toBe('0');
  await page.goto('/account/security');
  await expect(page.getByText('هنوز رمز عبور ندارید', { exact: false })).toBeVisible();
  await expect(
    page.getByText(persianDigits('09•••••' + mobile.slice(-4)), { exact: true }),
  ).toBeVisible();
  await shot(page, '15-account-security');
  const code = await send(page, '/api/v2/account/security/otp');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(code));
  await page.getByLabel('رمز عبور جدید', { exact: true }).fill('ChosenOptional!Password123');
  await page.getByLabel('تکرار رمز عبور', { exact: true }).fill('not-the-same-password');
  await page.getByRole('button', { name: 'ثبت تغییر و بستن نشست‌ها' }).click();
  await expect(page.locator('.field-error').filter({ hasText: 'یکسان نیستند' })).toBeVisible();
  await page.getByLabel('تکرار رمز عبور', { exact: true }).fill('ChosenOptional!Password123');
  await page.getByRole('button', { name: 'ثبت تغییر و بستن نشست‌ها' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه').fill(username);
  await page.getByLabel('رمز عبور', { exact: true }).fill('ChosenOptional!Password123');
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});
test('Password and OTP login designs, self-service reset and mobile validation', async ({
  page,
}) => {
  const e = await customer(),
    mobile = nextMobile();
  const { seal } = await import('../../../../backend/dist/src/security/crypto.js');
  const { keyed } = await import('../../../../backend/dist/src/security/crypto.js');
  await sql(
    'UPDATE customers SET mobile_ciphertext=$2,mobile_lookup=$3,mobile_last4=$4 WHERE id=$1',
    [
      e.customer_id,
      seal(mobile, '4'.repeat(64)),
      keyed('5'.repeat(64), 'YariZan-Mobile-Lookup-V1', mobile),
      mobile.slice(-4),
    ],
  );
  await page.goto('/login');
  await shot(page, '30-login-otp-default');
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await shot(page, '17-login-password');
  await page.getByRole('button', { name: 'ورود با کد یک‌بارمصرف' }).click();
  await page.getByLabel('شمارهٔ همراه').fill('123');
  await page.getByRole('button', { name: 'ارسال کد تأیید' }).click();
  await expect(page.locator('.field-error').filter({ hasText: 'شمارهٔ همراه را' })).toBeVisible();
  await page.getByLabel('شمارهٔ همراه').fill(mobile);
  await shot(page, '18-login-otp');
  await page.goto('/reset-password');
  await page.getByLabel('نام کاربری دستگاه').fill(e.username);
  await page.getByLabel('شمارهٔ همراه').fill(mobile);
  const id = await send(page, '/api/v2/auth/otp/request');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(id));
  await page.getByLabel('رمز عبور جدید', { exact: true }).fill('SelfReset!Password12345');
  await page.getByLabel('تکرار رمز عبور', { exact: true }).fill('SelfReset!Password12345');
  await page.getByRole('button', { name: 'ثبت رمز عبور جدید' }).click();
  await expect(page.getByRole('heading', { name: 'رمز عبور تغییر کرد' })).toBeVisible();
});
test('Admin SMS MFA, internal note edits/search and stale revision error dialog', async ({
  page,
}) => {
  const e = await customer();
  await adminLogin(page);
  await page.goto('/zanyari/devices');
  const search = page.getByRole('textbox', {
    name: 'جست‌وجوی شناسه، نام کاربری، شماره یا یادداشت',
  });
  await search.fill(e.username);
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'مدیریت', exact: true }).first().click();
  await page.getByRole('button', { name: 'مشاهده و ویرایش یادداشت' }).click();
  await page
    .getByRole('textbox', { name: 'یادداشت داخلی', exact: true })
    .fill('پیگیری خانواده — پروندهٔ گل آفتاب');
  await page.getByRole('button', { name: 'ذخیرهٔ یادداشت' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody tr').first()).toContainText('گل آفتاب');
  await shot(page, '19-admin-note-list');
  await search.fill('گل آفتاب');
  await page.getByRole('button', { name: 'جست‌وجو', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await shot(page, '20-admin-note-search');
  await page.getByRole('button', { name: 'مدیریت', exact: true }).first().click();
  await page.getByRole('button', { name: 'مشاهده و ویرایش یادداشت' }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - 720)).toBeLessThan(3);
  await shot(page, '21-admin-note-detail');
  await sql(
    "UPDATE entity_notes SET revision=revision+1 WHERE entity_type='devices' AND entity_id=$1",
    [e.device_id],
  );
  await page.getByRole('textbox', { name: 'یادداشت داخلی', exact: true }).fill('تغییر هم‌زمان');
  await page.getByRole('button', { name: 'ذخیرهٔ یادداشت' }).click();
  await expect(page.getByRole('alert')).toContainText('اطلاعات تغییر کرده');
  await shot(page, '22-custom-server-error');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('Mobile OTP login and friendly route errors have no raw framework text', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'ورود با کد یک‌بارمصرف' }).click();
  await shot(page, '23-mobile-otp-login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await request.get('/support-reset')).headers()['cache-control']).toContain('no-store');
  await page.goto('/not-a-real-page');
  await expect(page.getByRole('heading', { name: 'این صفحه پیدا نشد.' })).toBeVisible();
  await shot(page, '24-friendly-not-found');
  expect(await page.locator('body').textContent()).not.toMatch(/NuxtError|stack trace|TypeError/);
});

test('Existing password changes and both-number mobile verification revoke browser sessions', async ({
  page,
}) => {
  const e = await customer();
  await page.goto('/login');
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه').fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill('SyntheticWeb!Password12345');
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/account/security');
  await expect(page.getByRole('button', { name: 'تغییر رمز عبور', exact: true })).toBeVisible();
  let id = await send(page, '/api/v2/account/security/otp');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(id));
  await page.getByLabel('رمز عبور جدید', { exact: true }).fill('ChangedOnWeb!Password123');
  await page.getByLabel('تکرار رمز عبور', { exact: true }).fill('ChangedOnWeb!Password123');
  await page.getByRole('button', { name: 'ثبت تغییر و بستن نشست‌ها' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه').fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill('ChangedOnWeb!Password123');
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'تغییر شمارهٔ همراه', exact: true }).click();
  id = await send(page, '/api/v2/account/security/otp');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(id));
  const mobile = nextMobile();
  await page.getByLabel('شمارهٔ همراه جدید', { exact: true }).fill(mobile);
  const next = page.waitForResponse((r) => r.url().endsWith('/api/v2/account/security/otp'));
  await page.getByRole('button', { name: 'تأیید شمارهٔ فعلی و ارسال به شمارهٔ جدید' }).click();
  const newer = await (await next).json();
  await shot(page, '25-mobile-number-verification');
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(newer.challenge_id));
  await page.getByRole('button', { name: 'ثبت تغییر و بستن نشست‌ها' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await otpLogin(page, e.username, mobile);
});

test('Security actions wait for verified account data instead of assuming an unverified mobile', async ({
  page,
}) => {
  const e = await customer();
  await page.goto('/login');
  await page.getByRole('button', { name: 'ورود با رمز عبور', exact: true }).click();
  await page.getByLabel('نام کاربری دستگاه').fill(e.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'ورود به حساب', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  let release!: () => void;
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v2/account/security', async (route) => {
    await loaded;
    await route.continue();
  });
  await page.goto('/account/security');
  await expect(page.getByText('در حال دریافت اطلاعات امنیت حساب…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تغییر شمارهٔ همراه', exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('.security-cards form')).toHaveCount(0);
  release();
  await page.getByRole('button', { name: 'تغییر شمارهٔ همراه', exact: true }).click();
  await expect(page.getByLabel('رمز عبور فعلی', { exact: true })).toHaveCount(0);
  const requested = page.waitForRequest((r) => r.url().endsWith('/api/v2/account/security/otp'));
  await send(page, '/api/v2/account/security/otp');
  expect((await requested).postDataJSON().purpose).toBe('MOBILE_OLD');
});
