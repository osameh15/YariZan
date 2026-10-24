# YariZan V2 — Pricing and Catalog Contract

Status: implemented in Draft PR #7 (`feat/yarizan-v2-full-web-release`). Prices are approved for public display. No product is purchasable on the public site, and live payment stays closed.

## 1. Approved initial prices (revision `pricing-2026-10-18-r1`)

| SKU | Grade | Display price | Authoritative amount | Initial availability |
| --- | ---: | ---: | ---: | --- |
| YARIZAN-G1 | 1 | ۱٬۲۹۹٬۰۰۰ تومان | 12,990,000 IRR | Launch candidate (`published`) |
| YARIZAN-G2 | 2 | ۱٬۲۹۹٬۰۰۰ تومان | 12,990,000 IRR | Coming Soon |
| YARIZAN-G3 | 3 | ۱٬۲۹۹٬۰۰۰ تومان | 12,990,000 IRR | Coming Soon |
| YARIZAN-G4 | 4 | ۱٬۲۹۹٬۰۰۰ تومان | 12,990,000 IRR | Coming Soon |
| YARIZAN-G5 | 5 | ۱٬۲۹۹٬۰۰۰ تومان | 12,990,000 IRR | Coming Soon |
| YARIZAN-G6 | 6 | ۱٬۲۹۹٬۰۰۰ تومان | 12,990,000 IRR | Coming Soon |

Source of truth: `backend/src/catalog/approved-pricing.ts`. The web copy `apps/web/shared/approved-pricing.ts` must be identical; `apps/web/tests/unit/pricing.test.ts` fails if the two differ. A price change requires a new revision in both files plus owner approval.

## 2. Money rules

- Integer IRR (`bigint` in PostgreSQL, safe integer in JSON) is the only authoritative amount. Toman exists only in display (`financialToman`, BigInt arithmetic, 1 Toman = 10 IRR). Approved prices are exact Toman multiples.
- The browser never sends a price, total, discount or revision. `POST /orders` and `/discounts/quote` are strict schemas (`{sku, coupon?, request_id}`); any extra field is `INVALID_REQUEST` (tested).
- Every order is priced from the live `product_prices` row under `FOR SHARE`. Discounts are computed on the server, are not stackable (one coupon per order), and quota reservations are transactional (existing tests: twenty concurrent checkouts, per-customer quotas).
- `order_items` keeps an immutable snapshot (`unit_price_irr`, `discount_irr`, `total_irr`, `snapshot`). A later price change never alters an existing order (tested in backend integration and the browser).

## 3. Price is not availability

| Flag | Meaning | Who changes it |
| --- | --- | --- |
| `publication_status` | `published` / `coming_soon` / `hidden` | Admin (`products.manage`, recent SMS MFA) |
| `sale_enabled`, `trial_enabled`, `activation_enabled` | Capabilities | Admin, only for `published` products |
| `product_prices` current row | Price shown and charged | Admin; production bootstrap for the first price only |
| `COMMERCE_MODE` | Whether checkout exists at all | Deployment configuration; `zarinpal` is rejected in source |

Showing a price never enables sale, trial or activation. The public storefront snapshot sets all three flags to `false` for every grade, so G1 reads «فروش اینترنتی به‌زودی» and G2–G6 «به‌زودی».

## 4. Price history and provenance (migration 010)

- `product_prices.source` ∈ `ADMIN` (has `changed_by`), `BOOTSTRAP` (no Admin, named `pricing_revision`), `UNATTRIBUTED` (rows written before migration 010 without an Admin, for example development seeds). The CHECK constraint is NULL-safe; a test proves a NULL revision is refused.
- History is append-only: a trigger allows only closing the current row once (`ended_at` NULL → timestamp). Amounts, sources and revisions can never be rewritten; deletes were already refused.
- One current price per SKU (`product_price_current`) and no overlapping periods (`price_no_overlap`).

## 5. Production price initialization

```
node dist/src/database/production-bootstrap.js                                  # catalog + RBAC only
node dist/src/database/production-bootstrap.js --initialize-prices=pricing-2026-10-18-r1
```

- Runs as the migration owner (`MIGRATION_DATABASE_URL`), after migrations, never at API start.
- The operator must type the exact approved revision; any other value is `PRICING_REVISION_MISMATCH` and writes nothing.
- It records an approved price only where a SKU has no current price, as `source='BOOTSTRAP'`, and writes one `price.initialized` audit row per SKU (actor `SYSTEM`, no Admin identity is fabricated).
- Existing prices are never overwritten: equal ones are reported `unchanged`, different ones `differing` for the owner to review in Admin. Re-running is a no-op.
- Products stay `hidden` with every capability `false`; publishing G1 and marking G2–G6 Coming Soon is a separate, audited Admin action.
- The development seed refuses `NODE_ENV=production` and now mirrors the approved revision, so local data cannot drift.

Tests (`backend/test/pricing.test.ts`): fresh database, wrong revision, exact IRR values and audit rows, duplicate execution, append-only history and provenance, a later revision, differing existing price, and an upgrade from a 009 database with legacy prices.

## 6. Keeping the public snapshot and live catalog aligned

| Layer | Mechanism |
| --- | --- |
| Source | One approved object, two identical copies, unit test compares them |
| Build | Storefront image renders `publicCatalog('storefront')` from the web copy; no API call |
| Live | `node tools/release/check-catalog-drift.mjs https://<host>/api/v2/products` compares a live catalog to the approved revision (price, availability, missing or unapproved SKUs, non-integer amounts) and exits 1 on any drift |
| Rehearsal | The full-stack rehearsal publishes the catalog through Admin and asserts zero drift |

Any Admin price change after launch makes the drift check fail by design: the storefront image must then be rebuilt with a new approved revision, or switched to the live catalog in full mode.

## 7. Admin

Admin changes price and capability flags at `/zanyari` → «محصولات و قیمت» (`PATCH /api/v2/admin/products/{sku}`): `products.manage` permission, SMS MFA within the last hour (the Admin session lifetime), `expected_revision` conflict check, audit row, and a new `ADMIN` price row. Admin cannot enable live payments; that remains the reviewed configuration gate `ZARINPAL_LIVE_GATE_CLOSED` (see `YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md`).
