import type { Product } from './domain';
import { approvedPricing } from './approved-pricing';

// Reviewed, non-sensitive public catalog for the public-only profiles. It is static content, not
// a live API response: nothing here can be bought, activated or trialled, and every capability
// flag is false. Checkout in full mode always re-reads the live Backend catalog.
//  - brochure: maintenance/rollback site; no price is shown ("announced at launch").
//  - storefront: public storefront; shows the owner-approved prices of the named revision.
export type PublicProduct = Omit<Product, 'price_irr'> & { price_irr: number | null };
export type PublicProfile = 'brochure' | 'storefront';
const titles = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];

export function publicCatalog(profile: PublicProfile) {
  return {
    id: profile === 'storefront' ? approvedPricing.revision : 'brochure-2026-10-16',
    products: approvedPricing.products.map((p): PublicProduct => ({
      sku: p.sku,
      grade: p.grade,
      title_fa: `یاریزان پایه ${titles[p.grade - 1]} دبستان`,
      price_irr: profile === 'storefront' ? p.price_irr : null,
      publication_status: p.launch === 'launch-candidate' ? 'published' : 'coming_soon',
      sale_enabled: false,
      trial_enabled: false,
      activation_enabled: false,
      revision: 1,
    })),
  };
}
// Kept for existing imports: the brochure snapshot.
export const catalogSnapshot = publicCatalog('brochure');
