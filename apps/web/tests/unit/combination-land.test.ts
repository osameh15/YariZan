import { describe, it, expect } from 'vitest';
import { publicCatalog } from '../../shared/catalog-snapshot';
import { standaloneProduct, productPath } from '../../shared/products';
import { productSchema, safeReturn } from '../../shared/domain';
import { standaloneRelease } from '../../shared/standalone-releases';
import { endsLabel } from '../../shared/promotion';
import { allowedBrowserRoute } from '../../shared/proxy-policy';

describe('Combination Land product and ongoing offer', () => {
  const sku = 'YARIZAN-S-COMBINATION-LAND';
  it('keeps its independent identity through catalog, checkout and Admin actions', () => {
    const p = publicCatalog('storefront', new Date('2030-01-01')).products.find(
      (p) => p.sku === sku,
    )!;
    expect(productSchema.parse(p).grade).toBe(0);
    expect(p.title_fa).toBe('سرزمین ترکیب‌ها');
    expect(productPath(p)).toBe('/special-products/combination-land');
    expect(p.price_irr).toBe(3990000);
    expect(p.effective_price_irr).toBe(2990000);
    expect(p.promotion?.discount_percent).toBe(25);
    expect(endsLabel(p.promotion!.ends_at)).toBe('');
    expect(safeReturn('/checkout?sku=' + sku)).toBe('/checkout?sku=' + sku);
    expect(standaloneProduct(sku)?.sku).toBe(sku);
    expect(allowedBrowserRoute('PATCH', 'admin/products/' + sku)).toBe(true);
    expect(allowedBrowserRoute('GET', 'admin/products/' + sku + '/promotions')).toBe(true);
  });
  it('maps the reviewed release used after the deployment mirror checksum guard', () => {
    expect(standaloneRelease(sku)?.filename).toBe('YariZan-CombinationLand-Setup-v1.0.0.exe');
  });
});
