import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { adminSession, sql, customer, call, password, issue } from '../../tools/test-fixtures.mjs';

test('illustrated articles, shared picker, uploads, dashboards and homepage work together', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(180000);
  await sql("UPDATE blog_posts SET state='PUBLISHED',published_at=coalesce(published_at,now())");
  const posts = (await sql('SELECT * FROM blog_posts ORDER BY published_at DESC,slug')).rows;
  await mkdir('.local/screenshots/experience', { recursive: true });
  async function capture(name: string) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} ${width}: ${await page.evaluate(() =>
          [...document.querySelectorAll('body *')]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.left < -1 || r.right > innerWidth + 1;
            })
            .slice(0, 12)
            .map((el) => el.tagName + '.' + el.className)
            .join(','),
        )}`,
      ).toBe(true);
      await page.screenshot({
        path: `.local/screenshots/experience/${name}-${width}.png`,
        fullPage: true,
      });
    }
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ['serious', 'critical'].includes(v.impact ?? ''),
      ),
    ).toEqual([]);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'از وبلاگ یاریزان' })).toBeVisible();
  await expect(page.locator('.blog-highlights .blog-post-card')).toHaveCount(3);
  await expect(page.locator('.footer-reading a')).toHaveCount(5);
  await expect(page.locator('.footer-contact-email')).toHaveAttribute(
    'href',
    'mailto:support@oarnova.games',
  );
  await expect(page.locator('.footer-brand img')).toHaveAttribute(
    'src',
    '/brand/logo-horizontal.webp',
  );
  await capture('home');
  await page.goto('/blog/' + posts[0].slug);
  await expect(page.locator('.blog-cover')).toBeVisible();
  expect(
    await page
      .locator('.blog-cover')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  expect((await request.get(posts[0].cover_image)).headers()['x-robots-tag'] ?? '').not.toContain(
    'noindex',
  );
  const articleHtml = await (await request.get('/blog/' + posts[0].slug)).text();
  expect(articleHtml).toContain('ImageObject');
  expect(articleHtml).toContain(posts[0].cover_image);
  await page.locator('.blog-pagination a[rel="next"]').click();
  await expect(page).toHaveURL('/blog/' + posts[1].slug);
  await expect(page.locator('h1')).toHaveText(posts[1].title);
  await page.locator('.blog-pagination a[rel="prev"]').click();
  await expect(page.locator('h1')).toHaveText(posts[0].title);
  await capture('article');
  const auth = await adminSession();
  await context.addCookies([
    {
      name: 'yz_admin',
      value: auth.cookie.split('=')[1]!,
      url: 'http://localhost:3200',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'yz_csrf_admin', value: auth.csrf, url: 'http://localhost:3200', sameSite: 'Lax' },
  ]);
  await page.goto('/zanyari');
  await expect(page.getByRole('heading', { name: 'وبلاگ و نوشته‌ها' })).toBeVisible();
  await expect(page.locator('.editorial-recent li')).toHaveCount(3);
  await page.goto('/zanyari/blog?post=' + posts[0].id);
  await expect(page.getByLabel('عنوان نوشته', { exact: true })).toHaveValue(posts[0].title);
  await expect(page.getByRole('link', { name: 'میز کار', exact: true })).toHaveAttribute(
    'href',
    '/zanyari',
  );
  const picker = page.getByRole('combobox', { name: 'جست‌وجوی نوشته', exact: true });
  await picker.fill(posts[1].slug);
  await expect(page.getByRole('option')).toHaveCount(1);
  await picker.press('Enter');
  await expect(page.getByLabel('عنوان نوشته', { exact: true })).toHaveValue(posts[1].title);
  await picker.fill('not-a-real-title');
  await expect(page.getByText('نوشته‌ای با این عبارت پیدا نشد.')).toBeVisible();
  await picker.press('Escape');
  await expect(picker).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('combobox', { name: 'وضعیت نوشته‌ها', exact: true }).click();
  await page.getByRole('option', { name: 'پیش‌نویس‌ها', exact: true }).click();
  await expect(page.locator('.blog-list-item')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'وضعیت نوشته‌ها', exact: true }).click();
  await page.getByRole('option', { name: 'همهٔ نوشته‌ها', exact: true }).click();
  await page
    .getByLabel('فایل تصویر شاخص')
    .setInputFiles('public/blog-covers/number-games-at-home.webp');
  await expect(page.getByRole('status').filter({ hasText: 'تصویر آماده است' })).toBeVisible();
  await page
    .getByLabel('توضیح تصویر برای دسترس‌پذیری و جست‌وجو')
    .fill('دسته‌بندی مهره‌های چوبی برای بازی شمارش');
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرات منتشرشده', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'منتشر شد' })).toBeVisible();
  const updated = (await sql('SELECT * FROM blog_posts WHERE id=$1', [posts[1].id])).rows[0];
  expect(updated.cover_image).toMatch(/^\/blog-images\//);
  const image = await request.get(updated.cover_image);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/webp');
  expect(await (await request.get('/sitemap.xml')).text()).toContain(updated.cover_image);
  await capture('blog-editor');
  await page.getByRole('link', { name: 'میز کار', exact: true }).click();
  await expect(page).toHaveURL('/zanyari');
  const account = await customer();
  const signed = await call('/auth/login', { username: account.username, password });
  expect(signed.status).toBe(201);
  const cookie = signed.headers
    .getSetCookie()
    .find((v: string) => v.startsWith('yz_customer='))!
    .split(';')[0];
  await context.addCookies([
    {
      name: 'yz_customer',
      value: cookie.split('=')[1]!,
      url: 'http://localhost:3200',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'yz_csrf_customer',
      value: signed.body.csrf_token,
      url: 'http://localhost:3200',
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'جای اولین بازی شما اینجاست.' })).toBeVisible();
  await expect(page.locator('.customer-shortcuts a')).toHaveCount(3);
  await capture('customer-empty');
  await issue(account);
  await page.reload();
  await expect(page.locator('.customer-library-grid article')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'از وبلاگ یاریزان' })).toBeVisible();
  await capture('customer-owned');
  await sql("UPDATE blog_posts SET state='DRAFT'");
  expect((await request.get(updated.cover_image)).status()).toBe(404);
});
