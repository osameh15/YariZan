export const standaloneProducts = [
  {
    sku: 'YARIZAN-S-NUMBER-BUILDER',
    slug: 'number-builder',
    title: 'عددساز کوچولو',
    description: 'یک بازی مستقل برای کشف عددها و یادگیری با بازی.',
    symbol: '۱۲۳',
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
