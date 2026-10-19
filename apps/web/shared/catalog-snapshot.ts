import type { Product } from './domain';
import { approvedPricing } from './approved-pricing';
import {
  assertPublishedPromotions,
  priceView,
  type PromotionView,
  type PublishedPromotion,
} from './promotion';
import { publishedPromotions } from './published-promotions';

// Reviewed, non-sensitive public catalog for the public-only profiles. It is static content, not
// a live API response: nothing here can be bought, activated or trialled, and every capability
// flag is false. Checkout in full mode always re-reads the live Backend catalog.
//  - brochure: maintenance/rollback site; no price is shown ("announced at launch").
//  - storefront: public storefront; shows the owner-approved prices of the named revision.
export type PublicProduct = Omit<Product, 'price_irr' | 'promotion' | 'effective_price_irr'> & {
  price_irr: number | null;
  effective_price_irr?: number | null;
  promotion?: PromotionView | null;
};
export type PublicProfile = 'brochure' | 'storefront';
const titles = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];

// Only the storefront shows prices, so only it can show a promotion. A promotion is shown while its
// reviewed window is active at the render instant; scheduled, expired and unpublished ones never are.
export function publicCatalog(
  profile: PublicProfile,
  now: Date = new Date(),
  promotions: readonly PublishedPromotion[] = publishedPromotions,
) {
  assertPublishedPromotions(promotions, approvedPricing.products);
  return {
    id: profile === 'storefront' ? approvedPricing.revision : 'brochure-2026-10-16',
    products: approvedPricing.products.map((p): PublicProduct => {
      const published = p.launch === 'launch-candidate';
      const promo =
        profile === 'storefront' && published
          ? (promotions.find(
              (x) => x.sku === p.sku && now >= new Date(x.starts_at) && now < new Date(x.ends_at),
            ) ?? null)
          : null;
      const view = priceView(
        p.price_irr,
        promo && {
          price_irr: promo.price_irr,
          original_price_irr: promo.original_price_irr,
          discount_percent: 0,
          starts_at: promo.starts_at,
          ends_at: promo.ends_at,
        },
        now,
      );
      return {
        sku: p.sku,
        grade: p.grade,
        title_fa: `یاریزان پایه ${titles[p.grade - 1]} دبستان`,
        price_irr: profile === 'storefront' ? p.price_irr : null,
        effective_price_irr: profile === 'storefront' ? view.effective_irr : null,
        promotion: profile === 'storefront' ? view.promotion : null,
        publication_status: p.launch === 'launch-candidate' ? 'published' : 'coming_soon',
        sale_enabled: false,
        trial_enabled: false,
        activation_enabled: false,
        revision: 1,
      };
    }),
  };
}
// Kept for existing imports: the brochure snapshot.
export const catalogSnapshot = publicCatalog('brochure');
