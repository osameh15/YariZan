# Payment Readiness Dashboard — Technical Design (read-only)

Status: design only. Nothing here is implemented, deployed or exposed. The dashboard lives inside the existing protected Admin (`/zanyari`) of the **full application**, which is not deployed publicly (the storefront has no Admin). It reports readiness; it never turns anything on.

## 1. Goal and non-goals

**Goal:** give the owner one honest view of whether real payments could be enabled: which gates are closed, what evidence is missing, and whether the money path is healthy in the current environment.

**Non-goals (enforced):**
- No control that enables payments, selects a provider, edits `COMMERCE_MODE`, stores merchant credentials or opens any gate. Enabling live payments remains a reviewed code and configuration change (`ZARINPAL_LIVE_GATE_CLOSED` is closed in source).
- No secret, merchant id, callback secret, customer mobile or card data is ever returned.
- Not reachable on the public storefront; not a public status page.

## 2. Access control

- Route: `/zanyari/payment-readiness` (Nuxt page inside the existing Admin shell).
- API: `GET /api/v2/admin/payment-readiness` only. No POST/PATCH/DELETE route exists for this feature.
- Permission: new `finance.read`-gated read (existing permission; granted to `owner` and `auditor`). Requires an Admin session with recent SMS MFA like other finance views.
- Browser proxy: add exactly one GET pattern to `shared/proxy-policy.ts`; Origin/CSRF rules unchanged.
- Audit: each view writes an `admin.payment_readiness.viewed` audit row (actor id only).

## 3. Data shown (all derived on the server, read-only)

| Section | Source | Shown |
| --- | --- | --- |
| Gate status | `productionGates` and `ZARINPAL_LIVE_GATE_CLOSED` in `backend/src/config.ts` | Each gate id, reason, `open: false`, link to `docs/YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md` |
| Runtime mode | Validated configuration | `NODE_ENV`, `COMMERCE_MODE` (`disabled`/`fake`), whether real payments are possible (`false`); never secrets |
| Merchant checklist | Static, reviewed JSON shipped with the release (16 items from the gates document) | Item, required evidence, status `missing`/`provided-offline` set only by a reviewed code change |
| Catalog and pricing | `products`, current `product_prices` with `source` and `pricing_revision` | Per SKU: publication, sale flag, current price, provenance, drift against the approved revision |
| Commerce health (current environment) | `orders`, `payment_attempts`, `commerce_jobs`, `commerce_exceptions`, `order_fulfillments` | Counts by state for the last 24 h/7 d: pending, paid, unknown verifications, open exceptions, jobs overdue, fulfillments without license; oldest unresolved age |
| Reconciliation | Existing finance report | Paid totals vs fulfilled totals; mismatches count; link to per-order reconciliation |
| Infrastructure prerequisites | Static checklist | Egress to `payment.zarinpal.com`, callback route, trusted client IP (G5), secret custody (G8); status from the gates document |

A summary banner shows **«پرداخت واقعی غیرفعال است»** whenever any gate is closed (always, today).

## 4. API contract (sketch)

```
GET /api/v2/admin/payment-readiness
200 {
  "real_payments_possible": false,
  "gates": [{ "id": "G6_ADMIN_SMS_MFA", "open": false, "reason": "..." }, ...],
  "runtime": { "node_env": "test", "commerce_mode": "fake" },
  "merchant_checklist": [{ "id": "amount-unit", "status": "missing" }, ...],
  "catalog": [{ "sku": "YARIZAN-G1", "price_irr": 12990000, "source": "BOOTSTRAP", "pricing_revision": "pricing-2026-10-18-r1", "drift": false, ... }],
  "health": { "window": "24h", "unknown_verifications": 0, "open_exceptions": 0, "overdue_jobs": 0, "oldest_unresolved_seconds": null },
  "generated_at": "..."
}
```
Strict zod response schema, OpenAPI entry, `Cache-Control: no-store`.

## 5. Implementation plan (when approved)

1. Backend read model and controller (single SQL transaction, read-only role, no writes except the audit row); unit and integration tests asserting no mutating route exists and no secret field appears.
2. Admin page with Persian RTL cards; no buttons other than navigation and refresh.
3. Playwright tests: access denied without `finance.read` or recent MFA; banner always shows real payments disabled; no form controls submit anything.
4. Documentation and screenshots from the isolated full-application environment only.

## 6. Security review checklist

Read-only role; GET only; permission plus MFA; no secrets; no public route; audit on view; no feature flag that could enable payments; tests prove the absence of mutating endpoints.
