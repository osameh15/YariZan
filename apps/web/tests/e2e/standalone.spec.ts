import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('special product card, price, detail and download selection work on desktop and mobile', async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/special-products');
    await expect(page.getByRole('heading', { name: 'محصولات ویژه', exact: true })).toBeVisible();
    await expect(page.locator('.product-card')).toHaveCount(2);
    await expect(page.locator('.product-card .product-shot img')).toHaveCount(2);
    await expect(page.locator('.product-card').nth(0)).toContainText('دسته‌ساز کوچک');
    const card = page.locator('.product-card').filter({ hasText: 'عددساز کوچولو' });
    await expect(card).toContainText('عددساز کوچولو');
    await expect(card).toContainText('۱۹۹٬۰۰۰');
    await mkdir('.local/screenshots/standalone', { recursive: true });
    await page.screenshot({
      path: `.local/screenshots/standalone/catalog-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await card.getByRole('link', { name: 'عددساز کوچولو', exact: true }).click();
    await expect(page).toHaveURL(/\/special-products\/number-builder$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('عددساز کوچولو');
    await expect(page.locator('.gallery-thumb')).toHaveCount(2);
    await page.locator('.gallery-thumb').nth(1).click();
    await expect(page.locator('.gallery-thumb').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('دو فرصت آزمایش؛ اینترنت فقط برای شروع')).toBeVisible();
    await page.getByRole('link', { name: 'دریافت برنامهٔ ویندوز', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'دریافت عددساز کوچولو', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('grade-picker')).toHaveCount(0);
    await expect(page.locator('.download-tab')).toHaveText(['دنیای پایه‌ها', 'محصولات ویژه']);
    await expect(page.getByTestId('product-picker').locator('.grade-card')).toHaveCount(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test('grades stay separate and G1 shows the newly approved price', async ({ page }) => {
  await page.goto('/products');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await expect(page.locator('.product-card').first()).toContainText('۱٬۴۹۹٬۰۰۰');
  await expect(page.locator('.product-grid')).not.toContainText('عددساز کوچولو');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'محصولات ویژه', exact: true })).toBeVisible();
});
