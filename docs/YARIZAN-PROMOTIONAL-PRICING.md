# YariZan promotional pricing

Status: **implemented and tested; not published.** No promotion exists in any environment. The public storefront shows none, and nothing here enables selling, trials, activation or payment. Production commerce gates are unchanged.

## Owner decisions applied

- A product promotion and a coupon **never stack**. If a promotion is active, a coupon is refused with `COUPON_NOT_COMBINABLE_WITH_PROMOTION` (Persian explanation in the UI). It is enforced in the quote, in order creation, and in the database.
- The approved baseline of 12,990,000 IRR per grade is untouched. A promotion is a separate record; the immutable price history is never rewritten.
- Activation and expiry use database time. Orders and paid snapshots are never rewritten.

## Data model (migration `012_product_promotions.sql`)

`product_promotions`: product SKU, the list price row it was created against (`base_price_id`, `original_price_irr`), `promo_price_irr`, a **database-generated** `discount_percent` (whole percent, `floor((original - promo) * 100 / original)` in integer arithmetic), `starts_at`, mandatory `ends_at`, `state` (`ENABLED`/`DISABLED`), `revision`, `reason`, creating and updating Admin, timestamps.

Database rules:

- `promo_price_irr < original_price_irr`, both integers between 10,000 (minimum charge) and the safe-integer limit, `ends_at > starts_at`, a window of at most 366 days.
- An exclusion constraint forbids two **enabled** promotions of the same product from overlapping in time.
- Rows are never deleted. Price, base price and product are fixed after creation and cannot change while the promotion is active.
- `product_promotion_events` is an immutable history (create, update, deactivate, restore) with the acting Admin, the reason and a snapshot of the record. Each change also writes the normal audit log.
- `orders` gain `promotion_id` and `promotion_discount_irr`. For a promoted order: `subtotal` is the list price, `discount` is the promotion discount and `total` is the promotional price, so existing money invariants hold. A check forbids any additional coupon discount on such an order, and a trigger forbids attaching a coupon reservation or redemption to it. The order snapshot also records the list price, the promotion (id, revision, prices, percentage, window) and the pricing instant.

## Status and schedule logic

Status is derived on database time (`clock_timestamp()`), never stored and never taken from a client:

| Status | Rule |
|---|---|
| `DISABLED` | state is `DISABLED` |
| `SCHEDULED` | enabled, before `starts_at` |
| `ACTIVE` | enabled, `starts_at <= now < ends_at`, **and** the current list price still equals `original_price_irr` |
| `EXPIRED` | enabled, `now >= ends_at` |

An expired promotion stops affecting new quotes by itself. Quotes, order creation and the public catalog use one shared definition. Order creation share-locks the promotion row, so a concurrent deactivation waits for the transaction and every order is priced entirely by the promotion or entirely by the list price.

## Safe rules

- **Base price change:** the Admin price update is refused (`PROMOTION_BASE_PRICE_CONFLICT`) while an enabled promotion is scheduled or active for the product, unless the price is unchanged. A promotion is also inactive whenever the list price differs from the one it was created against. Restoring a disabled promotion after a base price change is refused (`PROMOTION_BASE_PRICE_CHANGED`). Economics are never changed silently.
- **Active promotions are locked:** only the end time may move (extend or shorten). A new price needs deactivate then create.
- **Start:** omitted means "now" on database time; a start in the past is refused. The end is mandatory.
- **Expected revision:** creation checks the product revision, updates and decisions check the promotion revision (`STALE_REVISION`). Requests are idempotent per `request_id`.
- **Authorization:** `products.manage`, recent SMS MFA, CSRF, Origin and RBAC, through the existing Admin operation path. The browser proxy allowlist contains exactly the five new routes.

## API

Public `GET /products` adds `effective_price_irr` and `promotion` (`null` unless active and the product is `published`). `price_irr` stays the list price. Quote responses add `promotion_discount_irr`, `coupon_discount_irr` and `promotion`. Admin: `GET`/`POST /admin/products/{sku}/promotions`, `PATCH /admin/promotions/{id}`, `POST /admin/promotions/{id}/deactivate|restore`. The OpenAPI snapshot and generated browser types are regenerated.

## Persian UI

- **Admin** (`/zanyari/products`, button «قیمت ویژه و تخفیف محصول»): read-only list price, promotion price in Toman, live percentage preview (the server stores the authoritative value), optional start, mandatory end (Solar Hijri picker), mandatory reason, explicit confirmation, a product-card preview, status list (فعال، زمان‌بندی‌شده، پایان‌یافته، غیرفعال), edit, change end, deactivate, restore, history with the approving Admin, Persian validation messages and stale-revision handling. The product row shows the current promotion state.
- **Customers:** catalog cards, product detail and the checkout summary show the struck-through original price, the prominent promotional price, a percentage badge and the end time. Without an active promotion only the regular price appears. Availability is shown separately: grades 2-6 stay «به‌زودی» and never show a discount, and a discount never implies that a product can be bought. The checkout page disables the coupon field with an explanation when a promotion applies.

## Public-only storefront

The storefront has no Backend. A promotion reaches it only through the reviewed, versioned list `apps/web/shared/published-promotions.ts` (empty), validated against the approved list price, with an owner approval reference, a closed window and no overlap, and shown only while its window is active at render time and only for the published product. Changing a price in an undeployed Admin does not change the public site. No structured-data (JSON-LD) price markup exists yet; when it is added it must use the same catalog function so metadata and cards cannot disagree.

## Evidence

- Backend, PostgreSQL 17 (`test/integration.test.ts`, three tests): exact percentage, public catalog, quote and order snapshot; coupon refusal (API and database); payment settles the promotional amount and the license follows only verified payment with duplicate callbacks; deactivation changes new quotes only; scheduled/expired on database time; overlap; base-price rule and restore; stale revisions; active lock; authorization (anonymous, support role); idempotency; audit; concurrent checkout racing a deactivation; concurrent creation (one wins).
- Web unit (`tests/unit/promotion.test.ts`): exact integer percentages, window logic, publication list validation, components, the proxy allowlist and Persian messages.
- Full-application Playwright (`tests/e2e/promotions.spec.ts`, real Backend and PostgreSQL): the Admin editor end to end, customer card/detail/checkout, order snapshot, no license before payment, scheduled/expired/deactivated states and phone width.
- Screenshots (local, sanitized, synthetic data): `apps/web/.local/screenshots/promotions/`.

## Remaining before production use

The full Backend deployment and its gates, an owner decision on the first real promotion (price, window, approval reference), a reviewed storefront publication if it should appear on the public site, and ZarinPal activation for real payments.
