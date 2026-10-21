import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { enamadSealUrl, stubEnamadSeal } from '../support/third-party';
const images = path.resolve('.local/screenshots/phase4-premium');

test('Premium public layouts: RTL, five widths, keyboard navigation and accessible states', async ({
  page,
}) => {
  const errors: string[] = [];
  const sealRequests = await stubEnamadSeal(page);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration.*mismatch/i.test(message.text()))
      errors.push(message.text());
  });
  await mkdir(images, { recursive: true });
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.product-card')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: path.join(images, `20-home-${width}.png`),
        fullPage: true,
        animations: 'disabled',
      });
    await page.goto('/products');
    await expect(page.locator('.product-card')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.screenshot({ path: path.join(images, '21-catalog.png'), fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'ورود با کد یک‌بارمصرف', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: path.join(images, '22-otp-login.png'), fullPage: true });
  await page.goto('/connect');
  await page.getByRole('button', { name: 'بررسی درخواست', exact: true }).click();
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  await expect(page.locator('form')).toHaveAttribute('novalidate', '');
  await page.screenshot({ path: path.join(images, '23-connect-validation.png'), fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 360, height: 560 });
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({ path: path.join(images, '24-mobile-navigation.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'باز کردن منو' })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto('/login');
  expect(
    await page
      .locator('.site-footer')
      .evaluate((el) => el.getBoundingClientRect().bottom >= innerHeight),
  ).toBe(true);
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/not-a-yarizan-page');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: path.join(images, '25-friendly-error.png'), fullPage: true });
  expect(
    errors.filter((error) => !error.includes('404 (Page not found: /not-a-yarizan-page)')),
  ).toEqual([]);
  // The real integration is preserved: the footer requested exactly the production seal URL.
  expect(sealRequests.length).toBeGreaterThan(0);
  for (const url of sealRequests) expect(url).toMatch(enamadSealUrl);
});
