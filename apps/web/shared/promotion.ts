// Promotional pricing, display side. Amounts are integer IRR; Toman is display only. The percentage
// is always derived from the two integer prices with exact BigInt arithmetic (whole percent, rounded
// down), never taken from a browser calculation or from a stored text. The live Backend decides which
// promotion is active (database time); public-only profiles use the reviewed, versioned list in
// published-promotions.ts instead of any API.
export interface PromotionView {
  price_irr: number;
  original_price_irr: number;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
}
export interface PriceView {
  /** The regular list price. */
  list_irr: number;
  /** The price a new order pays right now. */
  effective_irr: number;
  promotion: PromotionView | null;
}
export const minimumChargeIrr = 10000;

/** Whole-percent discount, exact: floor((original - promo) * 100 / original). */
export function percentOff(original: number, promo: number): number {
  if (!Number.isSafeInteger(original) || !Number.isSafeInteger(promo) || original <= 0 || promo < 0)
    throw new Error('Invalid IRR');
  if (promo >= original) throw new Error('Promotion must be lower than the list price');
  return Number(((BigInt(original) - BigInt(promo)) * 100n) / BigInt(original));
}

export type PromotionStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED';
/** Status of a window at an instant. */
export function windowStatus(
  window: { starts_at: string; ends_at: string },
  now: Date,
): PromotionStatus {
  const t = now.getTime();
  if (t < Date.parse(window.starts_at)) return 'SCHEDULED';
  if (t >= Date.parse(window.ends_at)) return 'EXPIRED';
  return 'ACTIVE';
}

/** A promotion is shown only while it is genuinely active; scheduled and expired ones are never shown. */
export function activePromotion(
  promotion: PromotionView | null | undefined,
  list: number,
  now: Date,
): PromotionView | null {
  if (!promotion) return null;
  if (promotion.original_price_irr !== list) return null;
  if (!(promotion.price_irr < list) || promotion.price_irr < minimumChargeIrr) return null;
  if (windowStatus(promotion, now) !== 'ACTIVE') return null;
  return { ...promotion, discount_percent: percentOff(list, promotion.price_irr) };
}

export function priceView(
  list: number,
  promotion: PromotionView | null | undefined,
  now: Date,
): PriceView {
  const active = activePromotion(promotion, list, now);
  return { list_irr: list, effective_irr: active ? active.price_irr : list, promotion: active };
}

const endFormat = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
});
/** «تا ۲۸ مهر ۱۴۰۵، ۱۸:۳۰» style end of a promotion, Tehran time. */
export function endsLabel(iso: string) {
  return 'تا ' + endFormat.format(new Date(iso));
}

// Public-only profiles: the reviewed publication list (see published-promotions.ts) is validated
// before use so a malformed or conflicting entry fails the build instead of reaching customers.
export interface PublishedPromotion {
  sku: string;
  original_price_irr: number;
  price_irr: number;
  starts_at: string;
  ends_at: string;
  /** Owner approval reference for this publication (not shown to customers). */
  approval: string;
}
export function assertPublishedPromotions(
  list: readonly PublishedPromotion[],
  products: readonly { sku: string; price_irr: number }[],
) {
  const seen: PublishedPromotion[] = [];
  for (const p of list) {
    const product = products.find((x) => x.sku === p.sku);
    if (!product) throw new Error('PROMOTION_SKU_UNKNOWN');
    if (p.original_price_irr !== product.price_irr)
      throw new Error('PROMOTION_BASE_PRICE_MISMATCH');
    if (!Number.isSafeInteger(p.price_irr) || p.price_irr < minimumChargeIrr)
      throw new Error('PROMOTION_PRICE_INVALID');
    if (!(p.price_irr < p.original_price_irr)) throw new Error('PROMOTION_PRICE_NOT_LOWER');
    const a = Date.parse(p.starts_at),
      b = Date.parse(p.ends_at);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !(b > a))
      throw new Error('PROMOTION_WINDOW_INVALID');
    if (!p.approval.trim()) throw new Error('PROMOTION_APPROVAL_MISSING');
    if (
      seen.some((q) => q.sku === p.sku && Date.parse(q.starts_at) < b && a < Date.parse(q.ends_at))
    )
      throw new Error('PROMOTION_OVERLAP');
    seen.push(p);
  }
}
