import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { adminSession, sql } from '../../tools/test-fixtures.mjs';

test('four drafts require approval; editor, publication, sitemap and responsive reading work', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120000);
  await sql("UPDATE blog_posts SET state='DRAFT'");
  const drafts = (await sql('SELECT * FROM blog_posts ORDER BY slug')).rows;
  expect(drafts).toHaveLength(4);
  const slug = drafts[0].slug;
  expect((await request.get('/blog/' + slug)).status()).toBe(404);
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/blog/' + slug);
  const session = await adminSession();
  await context.addCookies([
    {
      name: 'yz_admin',
      value: session.cookie.split('=')[1]!,
      url: 'http://localhost:3200',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'yz_csrf_admin', value: session.csrf, url: 'http://localhost:3200', sameSite: 'Lax' },
  ]);
  await page.goto('/zanyari/blog');
  await expect(page.locator('.blog-list-item')).toHaveCount(4);
  await page.getByRole('button', { name: new RegExp(drafts[0].title) }).click();
  await expect(page.getByLabel('عنوان نوشته', { exact: true })).toHaveValue(drafts[0].title);
  await mkdir('.local/screenshots/blog', { recursive: true });
  async function checkLayout(name: string) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} ${width}`,
      ).toBe(true);
      await page.screenshot({
        path: `.local/screenshots/blog/${name}-${width}.png`,
        fullPage: true,
      });
    }
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ['serious', 'critical'].includes(v.impact ?? ''),
      ),
    ).toEqual([]);
  }
  await checkLayout('admin');
  await page.getByRole('button', { name: 'پیش‌نمایش', exact: true }).click();
  await expect(page.locator('.blog-editor .blog-body')).toContainText(
    drafts[0].body.split('\n')[0],
  );
  await page.getByRole('button', { name: 'بازگشت به ویرایش', exact: true }).click();
  await page.getByRole('button', { name: 'بررسی و انتشار', exact: true }).click();
  expect((await request.get('/blog/' + slug)).status()).toBe(404);
  await page.getByRole('button', { name: 'تأیید و انتشار', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'نوشته با تأیید شما منتشر شد.' }),
  ).toBeVisible();
  const published = await request.get('/blog/' + slug);
  expect(published.status()).toBe(200);
  expect(published.headers()['x-robots-tag']).toBe('index, follow');
  const invalidCase = await request.get('/blog/' + slug.toUpperCase());
  expect(invalidCase.status()).toBe(404);
  expect(invalidCase.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(await published.text()).toContain('BlogPosting');
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/blog/' + slug);
  await page.goto('/blog');
  await checkLayout('index');
  await page.goto('/blog/' + slug);
  await checkLayout('article');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'http://localhost:3200/blog/' + slug,
  );
  await page.goto('/zanyari/blog');
  await page.getByRole('button', { name: new RegExp(drafts[0].title) }).click();
  await page.getByRole('button', { name: 'برداشتن از انتشار', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'پیش‌نویس ذخیره شد' })).toBeVisible();
  const removed = await request.get('/blog/' + slug);
  expect(removed.status()).toBe(404);
  expect(removed.headers()['x-robots-tag']).toBe('noindex, nofollow');
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/blog/' + slug);
});
