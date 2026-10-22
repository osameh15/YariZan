import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PriceBlock from '../../app/components/PriceBlock.vue';
import ProductCard from '../../app/components/ProductCard.vue';
import {
  activePromotion,
  assertPublishedPromotions,
  percentOff,
  priceView,
  windowStatus,
  type PublishedPromotion,
} from '../../shared/promotion';
import { publicCatalog } from '../../shared/catalog-snapshot';
import { publishedPromotions } from '../../shared/published-promotions';
import { approvedPricing } from '../../shared/approved-pricing';
import { errorMessage, productSchema } from '../../shared/domain';
import { allowedBrowserRoute } from '../../shared/proxy-policy';

const list = 12990000;
const at = (iso: string) => new Date(iso);
const window = { starts_at: '2026-11-01T00:00:00.000Z', ends_at: '2026-11-08T00:00:00.000Z' };
const promo = { price_irr: 9990000, original_price_irr: list, discount_percent: 0, ...window };
const entry: PublishedPromotion = {
  sku: 'YARIZAN-G1',
  original_price_irr: list,
  price_irr: 9990000,
  ...window,
  approval: 'synthetic-owner-approval-001',
};
const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' };

describe('promotion arithmetic is exact integer math', () => {
  it('derives whole-percent discounts from integer IRR without floating point', () => {
    expect(percentOff(12990000, 9990000)).toBe(23);
    expect(percentOff(12990000, 12989999)).toBe(0);
    expect(percentOff(12990000, 10000)).toBe(99);
    expect(percentOff(9007199254740990, 4503599627370495)).toBe(50);
    expect(percentOff(100000, 50001)).toBe(49);
  });
  it('rejects non-integer, non-lower and negative prices', () => {
    for (const [a, b] of [
      [100000, 100000],
      [100000, 100001],
      [100000, -1],
      [100000.5, 5000],
      [0, 0],
    ] as const)
      expect(() => percentOff(a, b)).toThrow();
  });
});

describe('a promotion is shown only while it is active', () => {
  it('scheduled, active and expired windows', () => {
    expect(windowStatus(window, at('2026-10-31T23:59:59Z'))).toBe('SCHEDULED');
    expect(windowStatus(window, at('2026-11-01T00:00:00Z'))).toBe('ACTIVE');
    expect(windowStatus(window, at('2026-11-07T23:59:59Z'))).toBe('ACTIVE');
    expect(windowStatus(window, at('2026-11-08T00:00:00Z'))).toBe('EXPIRED');
  });
  it('hides scheduled and expired promotions and recomputes the percentage itself', () => {
    expect(activePromotion(promo, list, at('2026-10-31T00:00:00Z'))).toBeNull();
    expect(activePromotion(promo, list, at('2026-11-09T00:00:00Z'))).toBeNull();
    expect(activePromotion(promo, list, at('2026-11-03T00:00:00Z'))?.discount_percent).toBe(23);
    // A stored percentage that disagrees with the prices is ignored.
    expect(
      activePromotion({ ...promo, discount_percent: 90 }, list, at('2026-11-03T00:00:00Z'))
        ?.discount_percent,
    ).toBe(23);
  });
  it('ignores a promotion priced against a different list price or below the minimum charge', () => {
    expect(activePromotion(promo, list + 1, at('2026-11-03T00:00:00Z'))).toBeNull();
    expect(
      activePromotion({ ...promo, price_irr: 9999 }, list, at('2026-11-03T00:00:00Z')),
    ).toBeNull();
    expect(
      activePromotion({ ...promo, price_irr: list }, list, at('2026-11-03T00:00:00Z')),
    ).toBeNull();
  });
  it('effective price follows the active promotion and falls back to the list price', () => {
    expect(priceView(list, promo, at('2026-11-03T00:00:00Z')).effective_irr).toBe(9990000);
    expect(priceView(list, promo, at('2026-11-09T00:00:00Z')).effective_irr).toBe(list);
    expect(priceView(list, null, at('2026-11-03T00:00:00Z')).promotion).toBeNull();
  });
});

describe('reviewed publication list for the public-only storefront', () => {
  it('publishes nothing today and never fabricates a promotion', () => {
    expect(publishedPromotions).toEqual([]);
    for (const p of publicCatalog('storefront').products) {
      expect(p.promotion).toBeNull();
      expect(p.effective_price_irr).toBe(p.price_irr);
    }
    for (const p of publicCatalog('brochure').products) expect(p.promotion).toBeNull();
  });
  it('validates entries against the approved list price', () => {
    const products = approvedPricing.products;
    expect(() => assertPublishedPromotions([entry], products)).not.toThrow();
    const bad: [Partial<PublishedPromotion>, RegExp][] = [
      [{ sku: 'YARIZAN-G9' }, /SKU/],
      [{ original_price_irr: list + 10 }, /BASE_PRICE/],
      [{ price_irr: list }, /NOT_LOWER/],
      [{ price_irr: 9999 }, /PRICE_INVALID/],
      [{ price_irr: 9990000.5 }, /PRICE_INVALID/],
      [{ ends_at: window.starts_at }, /WINDOW/],
      [{ starts_at: 'soon' }, /WINDOW/],
      [{ approval: ' ' }, /APPROVAL/],
    ];
    for (const [patch, error] of bad)
      expect(() => assertPublishedPromotions([{ ...entry, ...patch }], products)).toThrow(error);
    expect(() =>
      assertPublishedPromotions(
        [
          entry,
          { ...entry, starts_at: '2026-11-05T00:00:00.000Z', ends_at: '2026-11-12T00:00:00.000Z' },
        ],
        products,
      ),
    ).toThrow(/OVERLAP/);
  });
  it('the storefront shows a published promotion only inside its window, only for the launch product', () => {
    const during = publicCatalog('storefront', at('2026-11-03T00:00:00Z'), [entry]).products;
    expect(during[0]!.promotion?.discount_percent).toBe(23);
    expect(during[0]!.effective_price_irr).toBe(9990000);
    expect(during[0]!.price_irr).toBe(list);
    for (const p of during.slice(1)) expect(p.promotion).toBeNull();
    for (const when of ['2026-10-31T00:00:00Z', '2026-11-08T00:00:00Z'])
      expect(publicCatalog('storefront', at(when), [entry]).products[0]!.promotion).toBeNull();
    // The brochure profile has no prices at all, so it never shows a promotion.
    expect(
      publicCatalog('brochure', at('2026-11-03T00:00:00Z'), [entry]).products[0]!.promotion,
    ).toBeNull();
    // A Coming Soon grade can carry no promotion through the public catalog.
    const g2 = { ...entry, sku: 'YARIZAN-G2' };
    expect(
      publicCatalog('storefront', at('2026-11-03T00:00:00Z'), [g2]).products[1]!.promotion,
    ).toBeNull();
  });
});

describe('customer price presentation', () => {
  const active = { ...promo, discount_percent: 23 };
  it('shows strike-through original, prominent promotional price, badge and end time', () => {
    const w = mount(PriceBlock, { props: { list, promotion: active } });
    expect(w.attributes('data-promotion')).toBe('active');
    expect(w.find('s').text()).toContain('۱٬۲۹۹٬۰۰۰');
    expect(w.find('.price').text()).toContain('۹۹۹٬۰۰۰');
    expect(w.find('.discount-badge').text()).toContain('۲۳٪');
    expect(w.find('.promo-ends').text()).toMatch(/^تا /);
  });
  it('shows only the regular price when there is no active promotion', () => {
    const w = mount(PriceBlock, { props: { list, promotion: null } });
    expect(w.attributes('data-promotion')).toBe('none');
    expect(w.find('s').exists()).toBe(false);
    expect(w.find('.discount-badge').exists()).toBe(false);
    expect(w.find('.price').text()).toContain('۱٬۲۹۹٬۰۰۰');
    expect(mount(PriceBlock, { props: { list: null } }).text()).toContain('قیمت هنگام آغاز فروش');
    expect(
      mount(PriceBlock, { props: { list: null, promotion: active } })
        .find('s')
        .exists(),
    ).toBe(false);
  });
  it('a Coming Soon card never shows a discount, even when handed a promotion', () => {
    const product = (publicationStatus: 'published' | 'coming_soon') => ({
      sku: 'YARIZAN-G2',
      grade: 2,
      title_fa: 'یاریزان پایه دوم دبستان',
      price_irr: list,
      publication_status: publicationStatus,
      sale_enabled: false,
      trial_enabled: false,
      activation_enabled: false,
      revision: 1,
      promotion: active,
    });
    const soon = mount(ProductCard, {
      props: { product: product('coming_soon'), publicOnly: true },
      global: { stubs: { NuxtLink } },
    });
    expect(soon.find('.discount-badge').exists()).toBe(false);
    expect(soon.find('s').exists()).toBe(false);
    expect(soon.text()).toContain('به‌زودی');
    const live = mount(ProductCard, {
      props: { product: product('published'), publicOnly: true },
      global: { stubs: { NuxtLink } },
    });
    expect(live.find('.discount-badge').exists()).toBe(true);
    // A promotion never changes availability wording: nothing is purchasable on the public site.
    expect(live.text()).toContain('تهیه از راه پشتیبانی');
  });
});

describe('contracts and messages', () => {
  it('accepts the API promotion shape and keeps old responses valid', () => {
    const base = {
      sku: 'YARIZAN-G1',
      grade: 1,
      title_fa: 'x',
      price_irr: list,
      publication_status: 'published',
      sale_enabled: true,
      trial_enabled: true,
      activation_enabled: true,
      revision: 1,
    };
    expect(productSchema.safeParse(base).success).toBe(true);
    expect(
      productSchema.safeParse({
        ...base,
        effective_price_irr: 9990000,
        promotion: { ...promo, discount_percent: 23 },
      }).success,
    ).toBe(true);
    expect(
      productSchema.safeParse({ ...base, promotion: { ...promo, discount_percent: 100 } }).success,
    ).toBe(false);
  });
  it('explains in Persian why a coupon cannot be combined with a promotion', () => {
    const message = errorMessage({
      data: { error: { code: 'COUPON_NOT_COMBINABLE_WITH_PROMOTION' } },
    });
    expect(message).toContain('قیمت ویژه');
    expect(message).toContain('کد تخفیف');
    for (const code of [
      'PROMOTION_PRICE_NOT_LOWER',
      'PROMOTION_OVERLAP',
      'PROMOTION_ACTIVE_LOCKED',
      'PROMOTION_BASE_PRICE_CONFLICT',
      'PROMOTION_WINDOW_INVALID',
    ])
      expect(errorMessage({ data: { error: { code } } })).toMatch(/[؀-ۿ]/);
  });
});

describe('browser proxy allowlist for the promotion routes', () => {
  const id = '8d22d23a-cc95-4553-b703-11e45831e2b4';
  it('allows exactly the Admin promotion routes and nothing wider', () => {
    expect(allowedBrowserRoute('GET', 'admin/products/YARIZAN-G1/promotions')).toBe(true);
    expect(allowedBrowserRoute('POST', 'admin/products/YARIZAN-G1/promotions')).toBe(true);
    expect(allowedBrowserRoute('PATCH', `admin/promotions/${id}`)).toBe(true);
    expect(allowedBrowserRoute('POST', `admin/promotions/${id}/deactivate`)).toBe(true);
    expect(allowedBrowserRoute('POST', `admin/promotions/${id}/restore`)).toBe(true);
    for (const [method, path] of [
      ['DELETE', `admin/promotions/${id}`],
      ['PUT', `admin/promotions/${id}`],
      ['GET', `admin/promotions/${id}`],
      ['POST', `admin/promotions/${id}/destroy`],
      ['POST', 'admin/products/YARIZAN-G9/promotions'],
      ['POST', 'admin/products/YARIZAN-G1/promotions/extra'],
      ['PATCH', 'admin/promotions/not-a-uuid'],
      ['POST', `admin/promotions/${id}/deactivate?x=1`],
      ['POST', `admin/promotions/${id}%2Frestore`],
    ] as const)
      expect(allowedBrowserRoute(method, path), method + ' ' + path).toBe(false);
  });
});

describe('local test price label', () => {
  it('is shown only when flagged and never hides the price', () => {
    const labelled = mount(PriceBlock, { props: { list: 100000, testPrice: true } });
    expect(labelled.find('[data-testid="test-price"]').text()).toContain('قیمت آزمایشی');
    expect(labelled.find('.price').text()).toContain('۱۰٬۰۰۰');
    expect(
      mount(PriceBlock, { props: { list: 100000 } })
        .find('[data-testid="test-price"]')
        .exists(),
    ).toBe(false);
    expect(
      mount(PriceBlock, { props: { list: null, testPrice: true } })
        .find('[data-testid="test-price"]')
        .exists(),
    ).toBe(false);
  });
});
