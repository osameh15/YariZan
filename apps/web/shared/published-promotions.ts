import type { PublishedPromotion } from './promotion';
// Reviewed, versioned promotional prices for the PUBLIC-ONLY storefront, which has no Backend and
// never reads a live API. Changing a price in an Admin that is not deployed does not change the
// public site: a promotion appears here only through a reviewed change, then a storefront release.
// Each entry must match the approved list price of its product (assertPublishedPromotions), carry an
// owner approval reference and a closed window. Customers see an entry only while its window is
// active at the moment the page is rendered; expired and future entries are never shown.
// The owner-approved ongoing offer uses the documented no-scheduled-end timestamp.
export const publishedPromotions: readonly PublishedPromotion[] = [
  {
    sku: 'YARIZAN-S-COMBINATION-LAND',
    original_price_irr: 3990000,
    price_irr: 2990000,
    starts_at: '2026-11-09T00:00:00Z',
    ends_at: '9999-12-31T00:00:00Z',
    approval: 'Owner request 2026-11-09: 399000 list, 299000 offer until disabled',
  },
];
