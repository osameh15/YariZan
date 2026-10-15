# Commerce contracts and operational policy

Phase 4 implements synthetic commerce under `/api/v2`. The implemented OpenAPI is authoritative. `COMMERCE_MODE=disabled` is the default; explicit `fake` enables isolated simulations. `zarinpal` always refuses startup. Production startup remains independently blocked. No merchant, refund or SMS transport is enabled by commerce.

## Customer API

| Method and route | Contract and authority |
|---|---|
| GET commerce/capabilities | Public capability, enabled/mode/provider; no secret |
| POST discounts/quote | Customer cookie, exact Origin and CSRF; `{sku,coupon?}`; authoritative IRR quote, no reservation |
| POST orders | Same authority; `{sku,coupon?,request_id:UUID}`; immutable single-grade snapshot |
| GET orders; GET account/orders | Current customer only; bounded pagination/filtering |
| GET orders/:id | Owner only; snapshot/payment/fulfillment status and license identifier, never desktop artifacts |
| POST orders/:id/payments | Owner/CSRF; `{request_id:UUID}`; persisted attempt and allowlisted continuation |
| POST orders/:id/simulate | Owner/CSRF, fake mode only; SUCCESS/FAILED/CANCELLED/UNKNOWN synthetic ledger transition |
| GET payments/zarinpal/return | Untrusted Authority/Status hint; schedules verification, never settles payment |
| POST orders/:id/refund-request | Paid owner/CSRF; reason 10–1000 characters; money_returned=false |

Nuxt `/payment/return` validates Authority, uses the fixed configured backend and redirects only to its own result page with an order UUID. Browser Status, amount, reference and redirect targets never authorize settlement. Sensitive pages/responses are no-store. Nuxt never reads PostgreSQL; direct SQL is confined to isolated tests.

Order/payment UUID idempotency keys are separate. Changed input under an existing key is rejected. Device serialization and partial actionable-order uniqueness prevent competing checkouts. An unresolved attempt prevents another order. Any existing generation entitlement, including revoked ownership, requires support rather than another purchase. Desktop profiles and trial allocations are unaffected.

## Prices, expiry and coupons

Money is integer IRR, bounded by the JavaScript safe integer. Percentage arithmetic uses BigInt, floors fractional IRR and applies an optional cap; fixed discounts clamp to subtotal. One ASCII uppercase normalized coupon is allowed, without stacking. Unicode lookalikes are rejected. Total below 10,000 IRR, including zero, is blocked. Toman display divides by ten exactly.

Orders snapshot SKU/title, public username, customer/device/generation, unit price, discount, total, currency and pricing/coupon revisions. Price edits never rewrite snapshots. Uninitiated orders expire after 15 minutes. Initiation checks current flags, bans, ownership and expiry. Once an attempt exists, later sales disabling cannot erase a capture. Ordinary API admission permits one attempt/order; definitive failure requires a fresh order. Historical multiple attempts/captures remain representable and tested.

Lock order is device, order, payment, campaign, code, reservation, entitlement/license. Quote observes quotas without consumption. Creation counts successful redemptions plus all RESERVED/UNKNOWN allocations under campaign/code locks, enforcing global and per-customer limits at both levels. Quota edits cannot lower limits below allocated usage. Start is inclusive and end exclusive. Disabled/edited coupons affect future checkout, never historical snapshots.

TTL never releases an initiated or UNKNOWN reservation. EXPIRE cancels only expired orders without attempts. Definitive fake failure/cancellation releases quota. Late verification after release records paid state and LATE_RELEASED_COUPON, without granting ownership or silently overselling. Human finance resolution/refund is separate.

## Payment and fulfillment

Attempt: CREATED → PENDING or UNKNOWN; unresolved → VERIFIED/FAILED/CANCELLED. Timeout/5xx is UNKNOWN. Late authoritative evidence may promote a terminal unpaid result to VERIFIED. Verified evidence cannot be rewritten.

Order: PENDING → FULFILLMENT_PENDING after verified capture → FULFILLED. Definitive unpaid terminal results become FAILED/CANCELLED. Paid timestamps/accepted payment cannot be cleared. REFERENCE_REUSED, DUPLICATE_CAPTURE, VERIFICATION_MISMATCH, LATE_RELEASED_COUPON, ACCOUNT_GENERATION_CHANGED, PRODUCT_BLOCKED and OWNERSHIP_CONFLICT remain auditable exceptions. Reused references retain reported evidence without granting ownership. Duplicate captured funds are reported separately from order revenue.

Attempt and recovery job commit before provider creation; network calls hold no SQL locks. Ambiguous create is never retried automatically. Fake inquiry can recover its durable authority by attempt UUID; live orphan authorities would require merchant/manual reconciliation. Only validated continuation URLs reach the browser.

Verification checks authority, original amount/currency/configuration and positive reference. It commits payment, coupon redemption, audit/outbox and fulfillment job before signing. Fulfillment atomically creates one PURCHASE entitlement linked to the item, the existing perpetual signed license and unique fulfillment record. Signing failure rolls back fulfillment only; order stays paid/pending. The customer must never pay again. Desktop pickup keeps the existing enrolled-device authentication and ADR-0004 verifier. Browser receives license ID/status only.

Reset retains financial tombstones but blocks stale-generation fulfillment. Product bans hold captured payments for review. Unblocking alone does not grant ownership: recent-MFA reconciliation reruns checks. Revoked/conflicting ownership is not replaced silently. Offline paid access, per-grade binding, two trial starts and unlimited current-process offline trial continuation remain unchanged.

## Durable reconciliation and notifications

PostgreSQL commerce_jobs is the reliable queue: VERIFY/FULFILL/EXPIRE/PURCHASE_NOTICE. SKIP LOCKED, 60-second leases and UUID fencing support concurrent workers/restart. Fake runtime drains at most four jobs every two seconds without overlap; explicit batches are bounded to 50. Backoff is min(3600, 5×2^attempt) seconds. Eight unsuccessful attempts enter REVIEW. Revisioned manual reconciliation schedules another attempt without resetting history. A crash leaves STARTED history and an expiring lease; a stale worker cannot complete a replacement lease. Immutable commerce_job_runs records STARTED/DONE/RETRY/REVIEW.

Audit also inserts the existing durable outbox event. PURCHASE_NOTICE runs only after fulfillment, deduplicated by order, records PURCHASE_SMS_TEMPLATE and purchase.notification_recorded, and performs no vendor call. Future consumers must reuse the existing Sms provider boundary with an approved purchase template/variables and deduplicate event/order IDs. Real purchase SMS is blocked, not claimed as delivered. The Phase 3 OTP queue remains process-local; financial correctness does not depend on it.

## Admin contracts and reports

GET admin/commerce/:section supports orders/payments/campaigns/coupons/reservations/redemptions/jobs/exceptions/finance/refunds. GET admin/commerce/orders/:id includes safe transitions and job history. commerce.read governs records; finance.read governs aggregates. Existing Admin cookie, CSRF and recent SMS MFA apply. No lease token, merchant credential, raw gateway payload or full phone is exposed.

POST/PATCH admin/commerce/campaigns[/:id] and coupons[/:id] require commerce.manage. POST admin/commerce/orders/:id/reconcile requires finance.reconcile. POST admin/commerce/refunds/:id/review requires refunds.review, accepts UNDER_REVIEW/APPROVED/REJECTED and always reports money_returned=false. Mutations require reason, UUID request ID and expected revision; existing Admin receipts enforce idempotency/stale conflicts. Refund review neither moves money nor changes a license.

Existing revisioned notes extend to orders/payments/campaigns/coupons, requiring notes.manage plus entity read permission. Paginated lists search escaped literal IDs, usernames, device/SKU/references and note previews. UTC from is inclusive/to exclusive, offset≤100000 and limit≤50. Existing note trigram and new scope/date/job indexes support administration. Leading-wildcard identifier/projection search remains a bounded Admin scan; high-volume production needs measured query plans/keyset/search tuning.

Finance uses order-created periods for paid gross/discount/net and pending fulfillment/exceptions; attempt-created periods for state breakdown; redemption-created periods for coupon usage; verified_at periods for all verified captures including duplicates. Initiation is never revenue. Aggregates are PostgreSQL decimal strings displayed with exact Toman conversion. These are operational reports, not bank settlement/accounting.

## ZarinPal research and closed gates

Reviewed official [SDK source](https://github.com/ZarinPal/ZarinPal-node-SDK), [Postman overview](https://www.postman.com/zarinpal-team/zarinpal/overview), and [request](https://www.zarinpal.com/docs/sdk/nodejs/method/request), [verify](https://www.zarinpal.com/docs/sdk/nodejs/method/verify), [inquiry](https://www.zarinpal.com/docs/sdk/nodejs/method/inquiry), [configuration](https://www.zarinpal.com/docs/sdk/nodejs/method/configuration) docs. Postman collection detail did not load. No gateway endpoint was contacted.

The real adapter uses fixed HTTPS payment.zarinpal.com/pg/v4/payment/{request,verify,inquiry}.json, merchant_id and explicit IRR. Optional IRT is not enabled. Documentation specifies a 10,000 IRR minimum; SDK comments/validation differ, so the conservative documented minimum is enforced. Redirect host/path is fixed payment.zarinpal.com/pg/StartPay/authority. SDK sandbox host is sandbox.zarinpal.com; no sandbox request was made.

Verify sends the original amount; codes 100/101 plus positive ref_id are accepted. Its documented response does not independently echo amount/currency: normalized amounts are request-bound, not provider-returned evidence. Inquiry terminal vocabulary/merchant behavior remains unaccepted, so real adapter failures stay UNKNOWN. Transport is injected with no network default, redirects forbidden, ten-second timeout and 16KiB response cap. Tests supply offline transports. Runtime cannot select the real adapter. No refund operation exists.

Before real use: confirm merchant IRR/minimums, callback registration, inquiry/verification/101/reference semantics, authority retention, rate limits, settlement and refund permissions. Approved secret custody, signing keys, first-claim ownership assurance, physical Windows acceptance and separate live-operation approval remain required.

## Migration and recovery

009 extends existing 002 tables, identity/license/note structures: composite ownership/payment/fulfillment FKs, partial actionable-order/unresolved-attempt uniqueness, immutable snapshots/evidence/history, money/scope checks and leased jobs. 001–008 are unchanged. Historical orders must contain exactly one item and resolve customer/device scope or migration refuses for a reviewed backfill. No destructive down migration. PostgreSQL rolls back a failed migration transaction; correct an applied defect with a new migration and preserve checksums/history.

check-schema compares five catalog groups, including all public functions/triggers, with an isolated 001–008 database upgraded through 009. Seed keeps six products, initial 12,990,000 IRR and only G1 commercially available when explicitly enabled. Database exposure remains loopback-only. Never run these tools against live services or customer data.
