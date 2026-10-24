import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Grade selector on /download. Only Grade 1 has an approved installer (2.0.0, unsigned under the
// owner's recorded exception); every other grade must show a clear unavailable state.
const profile = process.env.YARIZAN_PUBLIC_PROFILE === 'storefront' ? 'storefront' : 'brochure';
const images = path.resolve('.local/screenshots/' + profile);

test('six grade cards are shown, grade 1 is preselected and only grade 1 is downloadable', async ({
  page,
}) => {
  await page.goto('/download');
  const radios = page.getByRole('radio');
  await expect(radios).toHaveCount(6);
  await expect(page.getByRole('radiogroup')).toHaveCount(0); // native radios in a fieldset
  await expect(page.getByRole('group', { name: 'پایهٔ موردنظر را انتخاب کنید' })).toBeVisible();
  await expect(radios.first()).toBeChecked();
  await expect(page.locator('.grade-card[data-grade="1"] .grade-chip')).toHaveText('آمادهٔ دریافت');
  for (const grade of [2, 3, 4, 5, 6])
    await expect(page.locator(`.grade-card[data-grade="${grade}"] .grade-chip`)).toHaveText(
      'به‌زودی',
    );
  const panel = page.getByTestId('download-available');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(
    'd01bb66afebe125ed8ce259c9f091c5e63820aad42048c08488557c6263642b7',
  );
  await expect(page.getByTestId('download-unsigned-notice')).toBeVisible();
  const downloads = await panel
    .locator('a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(downloads).toEqual([
    'https://dl.oarnova.games/downloads/windows/grade-1/latest',
    'https://dl.oarnova.games/downloads/windows/grade-1/2.0.0/YariZan-G1-Setup-v2.0.0.exe',
  ]);
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  for (const href of hrefs) expect(href).not.toMatch(/github/i);
});

test('a grade without an approved installer exposes no download link', async ({ page }) => {
  await page.goto('/download?grade=2');
  await expect(page.getByTestId('download-unavailable')).toBeVisible();
  await expect(page.getByTestId('download-available')).toHaveCount(0);
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    expect(href).not.toMatch(/github/i);
    expect(href).not.toMatch(/\/downloads\/windows\//);
    expect(href).not.toMatch(/\.(exe|msi|zip)(?:$|\?)/i);
  }
  await expect(page.locator('.button.is-disabled')).toHaveAttribute('aria-disabled', 'true');
});

test('choosing a grade updates the panel, the address and the history', async ({ page }) => {
  await page.goto('/download');
  await page.locator('.grade-card[data-grade="4"]').click();
  await expect(page).toHaveURL(/\/download\?grade=4$/);
  await expect(page.getByTestId('download-unavailable')).toContainText('پایهٔ چهارم');
  await expect(page.getByTestId('download-history-empty')).toBeVisible();
  await expect(page.locator('.grade-card[data-grade="4"] input')).toBeChecked();
  await expect(page.locator('.grade-card.is-selected')).toHaveCount(1);
});

test('keyboard selection works with the arrow keys', async ({ page }) => {
  await page.goto('/download');
  await page.waitForFunction(
    () => (document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__,
  );
  await page.locator('.grade-card[data-grade="1"] input').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.grade-card[data-grade="2"] input')).toBeChecked();
  // A person pauses between key presses; wait until the page has settled on the new grade.
  await expect(page.locator('.grade-card.is-selected')).toHaveAttribute('data-grade', '2');
  await expect(page).toHaveURL(/grade=2$/);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.grade-card[data-grade="3"] input')).toBeChecked();
  await expect(page.getByTestId('download-unavailable')).toContainText('پایهٔ سوم');
  await expect(page).toHaveURL(/grade=3$/);
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.grade-card[data-grade="2"] input')).toBeChecked();
});

test('the selected grade is rendered on the server from the query', async ({ request }) => {
  const html = await (await request.get('/download?grade=5')).text();
  expect(html).toMatch(/<input checked[^>]*name="grade" value="5"/);
  expect(html).toContain('پایهٔ پنجم');
  expect(html).toContain('data-testid="download-unavailable"');
  for (const bad of ['0', '9', 'abc', '1;2', '%00']) {
    const response = await request.get('/download?grade=' + bad);
    expect(response.status(), bad).toBe(200);
    expect(await response.text()).toMatch(/<input checked[^>]*name="grade" value="1"/);
  }
});

test('the picker is also a plain GET form for browsers without JavaScript', async ({ page }) => {
  await page.goto('/download');
  await expect(page.locator('form[data-testid="grade-picker"]')).toHaveAttribute('method', 'get');
  await expect(page.locator('form[data-testid="grade-picker"]')).toHaveAttribute(
    'action',
    '/download',
  );
});

test('download page is Persian RTL and passes accessibility checks for every grade', async ({
  page,
}) => {
  for (const grade of [1, 2, 3, 4, 5, 6]) {
    await page.goto('/download?grade=' + grade);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations, 'grade ' + grade).toEqual([]);
  }
});

test('grade selector fits a phone and a tablet without horizontal scrolling', async ({
  browser,
}) => {
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 768, height: 1000 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const grade of [1, 3]) {
      await page.goto('/download?grade=' + grade);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, JSON.stringify(viewport) + ' grade ' + grade).toBeLessThanOrEqual(0);
    }
    const boxes = await page
      .locator('.grade-card')
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().height));
    for (const height of boxes) expect(height).toBeGreaterThanOrEqual(44);
    await context.close();
  }
});

test('screenshots of the grade selector at desktop and mobile widths', async ({ browser }) => {
  await mkdir(images, { recursive: true });
  for (const [label, viewport] of [
    ['1440', { width: 1440, height: 1000 }],
    ['390', { width: 390, height: 844 }],
  ] as const) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const grade of [1, 3]) {
      await page.goto('/download?grade=' + grade);
      await page.screenshot({
        path: path.join(images, `download-grade-${grade}-${label}.png`),
        fullPage: true,
      });
    }
    await context.close();
  }
});
