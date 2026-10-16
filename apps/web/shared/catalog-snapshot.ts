import type { Product } from './domain';

// Reviewed, non-sensitive public catalog for brochure mode. It is static content, not a
// live API response: nothing here can be bought, activated or trialled.
// No retail price has been approved for publication, so informational_price_irr is null
// and the site shows "price announced at launch". Set an owner-approved value here only.
export type PublicProduct = Omit<Product, 'price_irr'> & { price_irr: number | null };
export const catalogSnapshot = {
  id: 'brochure-2026-10-16',
  reviewed: '2026-10-16',
  products: [1, 2, 3, 4, 5, 6].map((grade): PublicProduct => ({
    sku: `YARIZAN-G${grade}`,
    grade,
    title_fa: `یاریزان پایه ${['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'][grade - 1]} دبستان`,
    price_irr: null,
    publication_status: grade === 1 ? 'published' : 'coming_soon',
    sale_enabled: false,
    trial_enabled: false,
    activation_enabled: false,
    revision: 1,
  })),
} as const;
