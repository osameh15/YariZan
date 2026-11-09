import { describe, expect, it } from 'vitest';
import { publicCatalog } from '../../shared/catalog-snapshot';
import { productSchema, safeReturn, toman } from '../../shared/domain';
import { existsSync } from 'node:fs';
import { productPath, productTitle, standaloneProducts } from '../../shared/products';
import { allowedBrowserRoute } from '../../shared/proxy-policy';
import { brochureDecision } from '../../shared/site-mode';
import { standaloneDownloadUrl, standaloneRelease } from '../../shared/standalone-releases';

describe('independent game products', () => {
  const sku = 'YARIZAN-S-NUMBER-BUILDER';
  it('has its own identity, title, card route and exact Toman price', () => {
    const product = publicCatalog('storefront').products.find((p) => p.sku === sku)!;
    expect(productSchema.parse(product).grade).toBe(0);
    expect(product.title_fa).toBe('عددساز کوچولو');
    expect(toman(product.price_irr!)).toBe('۱۹۹٬۰۰۰');
    expect(productTitle(sku)).toBe('عددساز کوچولو');
    expect(productPath(product)).toBe('/special-products/number-builder');
    expect(productSchema.safeParse({ ...product, sku: 'YARIZAN-G0' }).success).toBe(false);
  });
  it('supports checkout returns and every browser Admin product operation', () => {
    expect(safeReturn('/checkout?sku=' + sku)).toBe('/checkout?sku=' + sku);
    expect(safeReturn('/checkout?sku=' + sku + '&next=https://evil.invalid')).toBe('/account');
    for (const [method, path] of [
      ['GET', 'products/' + sku],
      ['PATCH', 'admin/products/' + sku],
      ['GET', 'admin/products/' + sku + '/promotions'],
      ['POST', 'admin/trials/10000000-0000-4000-8000-000000000001/' + sku + '/reset'],
    ])
      expect(allowedBrowserRoute(method!, path!)).toBe(true);
    expect(brochureDecision('GET', '/special-products/number-builder')).toBe('page');
  });
  it('links each published installer to its own immutable mirror path', () => {
    expect(standaloneDownloadUrl(standaloneRelease(sku)!)).toBe(
      'https://dl.oarnova.games/downloads/windows/products/number-builder/1.0.0/YariZan-NumberBuilder-Setup-v1.0.0.exe',
    );
    expect(standaloneDownloadUrl(standaloneRelease('YARIZAN-S-BUNDLE-BUILDER')!)).toBe(
      'https://dl.oarnova.games/downloads/windows/products/bundle-builder/1.0.0/YariZan-BundleBuilder-Setup-v1.0.0.exe',
    );
    expect(standaloneRelease('YARIZAN-S-UNKNOWN')).toBeUndefined();
  });
  it('lists the second game with its own route, price and screenshots', () => {
    const bundle = publicCatalog('storefront').products.find(
      (p) => p.sku === 'YARIZAN-S-BUNDLE-BUILDER',
    )!;
    expect(bundle.title_fa).toBe('دسته‌ساز کوچک');
    expect(toman(bundle.price_irr!)).toBe('۱۹۹٬۰۰۰');
    expect(productPath(bundle)).toBe('/special-products/bundle-builder');
    expect(brochureDecision('GET', '/special-products/bundle-builder')).toBe('page');
    for (const product of standaloneProducts) {
      if (product.slug !== 'combination-land') expect(product.shots.length).toBeGreaterThan(0);
      for (const shot of product.shots) {
        expect(shot.src).toMatch(new RegExp(`^/products/${product.slug}/screen-[0-9][.]webp$`));
        expect(existsSync('public' + shot.src)).toBe(true);
        expect(shot.alt.length).toBeGreaterThan(5);
      }
    }
  });
});
