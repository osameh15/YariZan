import type { PublishedPromotion } from './promotion';
// Reviewed, versioned promotional prices for the PUBLIC-ONLY storefront, which has no Backend and
// never reads a live API. Changing a price in an Admin that is not deployed does not change the
// public site: a promotion appears here only through a reviewed change, then a storefront release.
// Each entry must match the approved list price of its product (assertPublishedPromotions), carry an
// owner approval reference and a closed window. Customers see an entry only while its window is
// active at the moment the page is rendered; expired and future entries are never shown.
// The list is empty: no promotion is published.
export const publishedPromotions: readonly PublishedPromotion[] = [];
