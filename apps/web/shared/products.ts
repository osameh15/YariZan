export type StandaloneShot = { src: string; alt: string };

// Reviewed independent games. The backend copy of the titles is backend/src/catalog/standalone-products.ts;
// the desktop copy is src/YariZan.Core/V2/StandaloneCatalog.cs. Screenshots are 1280×720 WebP.
export const standaloneProducts = [
  {
    sku: 'YARIZAN-S-NUMBER-BUILDER',
    slug: 'number-builder',
    title: 'عددساز کوچولو',
    description: 'با دسته‌ها عدد بساز و ارزش رقم‌ها را بشناس؛ یکان، دهگان، صدگان و هزارگان.',
    symbol: '۱۲۳',
    shots: [
      { src: '/products/number-builder/screen-1.webp', alt: 'صفحهٔ آغاز بازی عددساز کوچولو' },
      {
        src: '/products/number-builder/screen-2.webp',
        alt: 'ساختن عدد با دسته‌های یکان، دهگان، صدگان و هزارگان',
      },
    ] as readonly StandaloneShot[],
  },
  {
    sku: 'YARIZAN-S-BUNDLE-BUILDER',
    slug: 'bundle-builder',
    title: 'دسته‌ساز کوچک',
    description: 'با شکل‌ها دسته بساز، عدد بساز و بازی کن؛ عددهای دو، سه و چهار رقمی.',
    symbol: '۱۰',
    shots: [
      { src: '/products/bundle-builder/screen-1.webp', alt: 'صفحهٔ آغاز بازی دسته‌ساز کوچک' },
      { src: '/products/bundle-builder/screen-2.webp', alt: 'ساختن عدد با دسته‌ها و مکعب‌ها' },
    ] as readonly StandaloneShot[],
  },
  {
    sku: 'YARIZAN-S-COMBINATION-LAND',
    slug: 'combination-land',
    title: 'سرزمین ترکیب‌ها',
    description:
      'سرزمین ترکیب‌ها؛ یک بازی مستقل در مجموعهٔ محصولات ویژهٔ یاریزان، با فعال‌سازی و مجوز اختصاصی.',
    symbol: '✦',
    shots: [
      { src: '/products/combination-land/screen-1.webp', alt: 'صفحهٔ آغاز بازی سرزمین ترکیب‌ها' },
      {
        src: '/products/combination-land/screen-2.webp',
        alt: 'تمرین ترکیب نشانه‌ها و صداها در سرزمین ترکیب‌ها',
      },
    ] as readonly StandaloneShot[],
  },
] as const;

export function standaloneProduct(sku: string) {
  return standaloneProducts.find((p) => p.sku === sku);
}

export function productPath(product: { sku: string; grade: number }) {
  const special = standaloneProduct(product.sku);
  return special ? `/special-products/${special.slug}` : `/products/grade-${product.grade}`;
}

export function productTitle(sku: unknown) {
  const value = String(sku ?? '');
  const special = standaloneProduct(value);
  if (special) return special.title;
  const grade = /^YARIZAN-G([1-6])$/.exec(value);
  return grade
    ? `یاریزان پایهٔ ${['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'][Number(grade[1]) - 1]}`
    : value || '—';
}

export const productSkuSource = 'YARIZAN-(?:G[1-6]|S-[A-Z0-9]+(?:-[A-Z0-9]+)*)';
export const productSkuPattern = new RegExp(`^${productSkuSource}$`);
