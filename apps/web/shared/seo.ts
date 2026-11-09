// Indexing is opt-in through the reviewed production configuration. Preview and rollback
// profiles remain noindex unless explicitly enabled; private and unknown routes never index.
// Protected and transactional routes are never indexable and never appear in the sitemap.
export type Indexing = 'index' | 'noindex';
export function parseIndexing(value: unknown): Indexing {
  return value === 'index' ? 'index' : 'noindex';
}
export const protectedRoute =
  /^\/(?:account|zanyari|login|connect|checkout|payment|reset-password|support-reset|api)(?:\/|$)/i;
// Exactly the public, content-reviewed pages; product pages use the canonical grade-N slug.
export const sitemapPaths = [
  '/',
  '/products',
  '/special-products',
  '/special-products/number-builder',
  '/special-products/bundle-builder',
  '/special-products/combination-land',
  ...[1, 2, 3, 4, 5, 6].map((g) => `/products/grade-${g}`),
  '/support',
  '/download',
  '/legal',
  ...['terms', 'privacy', 'refund', 'delivery', 'disputes', 'merchant-info'].map(
    (page) => `/legal/${page}`,
  ),
  '/blog',
];
export function canonicalPath(path: string): string | undefined {
  const normalized = path === '/' ? '/' : path.replace(/\/$/, '').toLowerCase();
  return (
    sitemapPaths.find((page) => page === normalized) ??
    (/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : undefined)
  );
}
export function robotsHeader(indexing: Indexing, path: string) {
  return indexing === 'index' &&
    (canonicalPath(path) ||
      /^\/blog-covers\/(?:choosing-an-educational-game|number-games-at-home|getting-started-with-yarizan|helping-without-giving-the-answer|pattern-games-at-home|more-less-and-equal-games|place-value-with-household-objects|shape-and-colour-pattern-games)\.webp$/.test(
        path,
      ))
    ? 'index, follow'
    : 'noindex, nofollow';
}
export function robotsTxt(indexing: Indexing, origin: string) {
  if (indexing !== 'index') return 'User-agent: *\nDisallow: /\n';
  return [
    'User-agent: *',
    ...[
      '/account',
      '/zanyari',
      '/login',
      '/connect',
      '/checkout',
      '/payment',
      '/reset-password',
      '/support-reset',
      '/api',
    ].map((p) => `Disallow: ${p}`),
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}
export function sitemapXml(
  origin: string,
  publishedPaths: string[] = [],
  images: Record<string, string> = {},
) {
  const urls = [
    ...sitemapPaths,
    ...publishedPaths.filter((p) => /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p)),
  ].map((p) => {
    const image = images[p];
    const valid =
      image && /^\/(?:blog-covers\/[a-z0-9-]+|blog-images\/[0-9a-f-]{36})\.webp$/.test(image);
    return `  <url><loc>${origin}${p === '/' ? '/' : p}</loc>${valid ? `<image:image><image:loc>${origin}${image}</image:loc></image:image>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}
// Canonical origin: only an https origin without path, or the local development origin.
export function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password)
    throw new Error('Invalid canonical origin');
  return url.origin;
}

const defaultDescription =
  'یاریزان؛ بازی‌های آموزشی فارسی برای شش پایهٔ دبستان. دو فرصت تجربه و دسترسی آفلاین پس از فعال‌سازی.';
type PageMetadata = { title: string; description: string };
const publicMetadata: Record<string, PageMetadata> = {
  '/': { title: 'یاریزان | یادگیری با طعم بازی', description: defaultDescription },
  '/products': {
    title: 'دنیای پایه‌ها | یاریزان',
    description:
      'بازی‌های آموزشی فارسی یاریزان برای پایه‌های دبستان؛ وضعیت عرضه، قیمت هر پایه و مسیر دریافت برنامهٔ ویندوز را ببینید.',
  },
  '/special-products': {
    title: 'محصولات ویژه | یاریزان',
    description:
      'بازی‌های مستقل یاریزان؛ با عددساز کوچولو و دسته‌ساز کوچک، شرایط آزمایش و مجوز جداگانهٔ هر بازی آشنا شوید.',
  },
  '/special-products/number-builder': {
    title: 'عددساز کوچولو | یاریزان',
    description:
      'عددساز کوچولو، بازی مستقل یاریزان برای ویندوز؛ تصاویر بازی، قیمت جاری، شرایط آزمایش و مسیر دریافت و خرید مجوز را ببینید.',
  },
  '/special-products/bundle-builder': {
    title: 'دسته‌ساز کوچک | یاریزان',
    description:
      'دسته‌ساز کوچک، بازی مستقل یاریزان برای ویندوز؛ با بازی آشنا شوید و تصاویر، قیمت جاری و شرایط دریافت و فعال‌سازی را بررسی کنید.',
  },
  '/special-products/combination-land': {
    title: 'سرزمین ترکیب‌ها | یاریزان',
    description:
      'سرزمین ترکیب‌ها، بازی مستقل یاریزان برای ویندوز؛ قیمت جاری، دریافت نسخهٔ x86 و x64، دو فرصت آزمایش و فعال‌سازی مجوز اختصاصی را بررسی کنید.',
  },
  '/support': {
    title: 'همراه شما | پشتیبانی یاریزان',
    description:
      'پاسخ پرسش‌های دریافت برنامه، اتصال دستگاه و مجوز یاریزان؛ راه‌های تماس با پشتیبانی و مسیر بررسی درخواست‌ها را پیدا کنید.',
  },
  '/download': {
    title: 'دریافت یاریزان برای ویندوز | یاریزان',
    description:
      'دریافت یاریزان برای ویندوز ۱۰ و ۱۱ و نسخهٔ آزمایشی ویندوز ۷ SP1 و ۸.۱؛ نیازمندی‌ها و کد بررسی فایل هر محصول.',
  },
  '/legal': {
    title: 'قوانین و حریم خصوصی | یاریزان',
    description:
      'قوانین استفاده از یاریزان، حریم خصوصی، تحویل مجوز دیجیتال، بازپرداخت، اطلاعات فروشنده و مسیر رسیدگی به شکایت.',
  },
  '/blog': {
    title: 'وبلاگ یاریزان | بازی، یادگیری و راهنمای خانواده',
    description:
      'راهنماهای کاربردی برای انتخاب بازی آموزشی، بازی با عددها در خانه و شروع استفاده از یاریزان در ویندوز؛ برای خانواده‌های همراه کودک.',
  },
};
for (const [index, grade] of ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'].entries()) {
  publicMetadata[`/products/grade-${index + 1}`] = {
    title: `یاریزان پایه ${grade} دبستان | یاریزان`,
    description: `معرفی یاریزان پایهٔ ${grade} دبستان برای ویندوز؛ وضعیت عرضه و قیمت این پایه را ببینید و راه دریافت برنامه و شرایط فعال‌سازی را بررسی کنید.`,
  };
}
for (const [slug, title] of Object.entries({
  terms: 'شرایط استفاده',
  privacy: 'سیاست حریم خصوصی',
  refund: 'سیاست لغو و بازپرداخت',
  delivery: 'تحویل مجوز دیجیتال',
  disputes: 'پشتیبانی و رسیدگی به شکایت',
  'merchant-info': 'اطلاعات فروشنده',
})) {
  publicMetadata[`/legal/${slug}`] = {
    title: `${title} | یاریزان`,
    description: `${title} یاریزان؛ اطلاعات رسمی دربارهٔ استفاده از محصولات، حقوق کاربران و راه‌های پیگیری و تماس با پشتیبانی.`,
  };
}
export function pageMetadata(path: string): PageMetadata {
  return publicMetadata[canonicalPath(path) ?? '/'] ?? publicMetadata['/blog']!;
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
