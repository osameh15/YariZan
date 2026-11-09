import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { LEGAL_PAGES } from '../../shared/legal-navigation';
import { ICON_NAMES } from '../../shared/icons';
import { stubEnamadSeal } from '../support/third-party';

test('Every legal page has readable RTL navigation, valid section links and current payment guidance', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await stubEnamadSeal(page);
  await mkdir('.local/screenshots/legal', { recursive: true });
  for (const topic of [{ path: '/legal', title: 'قوانین و حریم خصوصی' }, ...LEGAL_PAGES]) {
    await page.goto(topic.path);
    await expect(page.locator('h1')).toHaveText(topic.title);
    await expect(page.locator('.legal-meta time')).toHaveAttribute('datetime', '2026-11-06');
    if ('sections' in topic) {
      await expect(page.locator('.legal-sidebar a[aria-current="page"]')).toHaveAttribute(
        'href',
        topic.path,
      );
      await page.locator('.legal-contents summary').click();
      for (const section of topic.sections) {
        await expect(page.locator('.legal-contents a[href="#' + section.id + '"]')).toHaveText(
          section.title,
        );
        await expect(page.locator('h2#' + section.id)).toHaveText(section.title);
      }
      await expect(page.locator('.legal-back img')).toHaveAttribute('data-icon', 'back');
      expect(
        await page.locator('.legal-back img').evaluate((el) => getComputedStyle(el).transform),
      ).toBe('matrix(-1, 0, 0, -1, 0, 0)');
    } else {
      await expect(page.locator('.legal-topic')).toHaveCount(6);
    }
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        topic.path + ' ' + width,
      ).toBe(true);
      await page.screenshot({
        path: '.local/screenshots/legal/' + topic.path.replaceAll('/', '-') + '-' + width + '.png',
        fullPage: true,
      });
      if (width === 390) {
        const fine = await page.locator('.footer-fineprint').boundingBox();
        const link = await page.locator('.footer-fineprint > a').boundingBox();
        expect(Math.abs(link!.x + link!.width / 2 - (fine!.x + fine!.width / 2))).toBeLessThan(1);
      }
    }
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ['serious', 'critical'].includes(v.impact ?? ''),
      ),
      topic.path,
    ).toEqual([]);
    expect(
      await page
        .locator('img.app-icon')
        .evaluateAll((nodes) =>
          nodes.every(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    ).toBe(true);
  }
  await page.goto('/legal/merchant-info');
  await expect(page.locator('.legal-body')).toContainText(
    'خرید اینترنتی محصولات عرضه‌شده در سایت فعال است',
  );
  await expect(page.locator('.legal-body')).not.toContainText('تا زمانی که خرید');
  await page.goto('/legal/refund');
  await expect(page.locator('.legal-body')).toContainText('۱۵ دقیقه');
  await expect(page.locator('.legal-body')).toContainText('دوباره پرداخت نکنید');
  for (const name of ICON_NAMES) {
    const image = await request.get('/brand/icons/' + name + '.webp');
    expect(image.status(), name).toBe(200);
    expect(image.headers()['content-type']).toContain('image/webp');
  }
  await page.goto('/legal');
  await page.getByRole('link', { name: 'جزئیات مهلت و پرداخت' }).click();
  await expect(page).toHaveURL('/legal/terms#section-5');
  await expect(page.locator('h2#section-5')).toHaveText('مهلت ۱۵ دقیقه‌ای فاکتور');
  await page.getByRole('link', { name: 'بازگشت', exact: true }).click();
  await expect(page).toHaveURL('/legal');
});
