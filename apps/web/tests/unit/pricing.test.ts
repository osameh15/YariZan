import { describe, expect, it } from 'vitest';
import { approvedPricing } from '../../shared/approved-pricing';
import { approvedPricing as backendPricing } from '../../../../backend/src/catalog/approved-pricing';
import { publicCatalog } from '../../shared/catalog-snapshot';
import { availability, productSchema, toman } from '../../shared/domain';
import { parseSiteMode, isPublicOnly, brochureDecision } from '../../shared/site-mode';

describe('approved pricing contract', () => {
  it('web and backend copies are identical (no silent drift)', () => {
    expect(JSON.parse(JSON.stringify(approvedPricing))).toEqual(
      JSON.parse(JSON.stringify(backendPricing)),
    );
  });
  it('prices are integer IRR and display as exact Persian Toman', () => {
    for (const p of approvedPricing.products) {
      expect(Number.isSafeInteger(p.price_irr)).toBe(true);
      expect(p.price_irr).toBe(12990000);
      expect(toman(p.price_irr)).toBe('۱٬۲۹۹٬۰۰۰');
    }
    expect(toman(12990005)).toBe('۱٬۲۹۹٬۰۰۰٫۵');
    expect(() => toman(1.5)).toThrow();
    expect(() => toman(-10)).toThrow();
  });
});

describe('public storefront catalog', () => {
  const storefront = publicCatalog('storefront');
  const brochure = publicCatalog('brochure');
  it('storefront shows approved prices under the named revision; brochure shows none', () => {
    expect(storefront.id).toBe(approvedPricing.revision);
    expect(storefront.products.map((p) => p.price_irr)).toEqual(Array(6).fill(12990000));
    expect(brochure.products.every((p) => p.price_irr === null)).toBe(true);
  });
  it('a visible price never makes anything purchasable, trialable or activatable', () => {
    for (const p of [...storefront.products, ...brochure.products]) {
      expect([p.sale_enabled, p.trial_enabled, p.activation_enabled]).toEqual([
        false,
        false,
        false,
      ]);
      expect(productSchema.safeParse(p).success).toBe(p.price_irr !== null);
    }
  });
  it('availability is independent of price: G1 launch, G2-G6 Coming Soon', () => {
    expect(storefront.products[0]!.publication_status).toBe('published');
    expect(availability(storefront.products[0]!, true)).toBe('فروش اینترنتی به‌زودی');
    for (const p of storefront.products.slice(1)) {
      expect(p.publication_status).toBe('coming_soon');
      expect(availability(p, true)).toBe('به‌زودی');
    }
    // In the full application a disabled sale stays "sale disabled", never "coming soon".
    expect(availability({ ...storefront.products[0]!, publication_status: 'published' })).toBe(
      'فروش غیرفعال',
    );
  });
});

describe('storefront site mode', () => {
  it('is a valid explicit public-only mode with the brochure route boundary', () => {
    expect(parseSiteMode('storefront')).toBe('storefront');
    expect(isPublicOnly('storefront')).toBe(true);
    expect(isPublicOnly('brochure')).toBe(true);
    expect(isPublicOnly('full')).toBe(false);
    expect(() => parseSiteMode('public-storefront')).toThrow(/YARIZAN_SITE_MODE_INVALID/);
    expect(brochureDecision('POST', '/api/v2/orders')).toBe('api-disabled');
    expect(brochureDecision('GET', '/checkout')).toBe('page-disabled');
    expect(brochureDecision('GET', '/zanyari')).toBe('page-disabled');
    expect(brochureDecision('GET', '/products/grade-2')).toBe('page');
  });
});
