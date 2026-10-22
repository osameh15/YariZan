import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { admin, smsCode, sql } from '../../tools/test-fixtures.mjs';

async function adminLogin(page: Page, role: string) {
  const a = await admin(role);
  await page.goto('/zanyari/login');
  await page.getByLabel('نام کاربری مدیریت').fill(a.username);
  await page.getByLabel('رمز عبور', { exact: true }).fill(a.password);
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/v2/admin/auth/login'));
  await page.getByRole('button', { name: 'ارسال کد تأیید', exact: true }).click();
  const challenge = await (await sent).json();
  await page.getByLabel('کد تأیید پیامکی').fill(await smsCode(challenge.challenge_id));
  await page.getByRole('button', { name: 'تأیید کد و ورود', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari$/);
}

test.beforeEach(async () => {
  await sql('DELETE FROM rate_buckets');
});

test('Payment readiness is a read-only owner report that always shows real payments disabled', async ({
  page,
}) => {
  await adminLogin(page, 'owner');
  await page.getByRole('link', { name: 'آمادگی پرداخت', exact: true }).click();
  await expect(page).toHaveURL(/\/zanyari\/payment-readiness$/);
  await expect(page.getByTestId('real-payments-disabled')).toContainText(
    'پرداخت واقعی غیرفعال است',
  );
  await expect(
    page.getByRole('rowheader', { name: 'پذیرش در سندباکس رسمی زرین‌پال' }),
  ).toBeVisible();
  // Nothing on the page can submit or change a setting: no form, input, select or textarea, and the
  // only button is the refresh.
  await expect(page.locator('main form, main input, main select, main textarea')).toHaveCount(0);
  await expect(page.locator('.payment-readiness button')).toHaveCount(1);
  await expect(page.locator('.payment-readiness button')).toHaveText('تازه‌سازی گزارش');
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations).toEqual([]);
});

test('Payment readiness is refused without finance.read', async ({ page }) => {
  await adminLogin(page, 'support');
  await expect(page.getByRole('link', { name: 'آمادگی پرداخت', exact: true })).toHaveCount(0);
  await page.goto('/zanyari/payment-readiness');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('real-payments-disabled')).toHaveCount(0);
});
