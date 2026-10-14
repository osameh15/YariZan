# ADR-0003 — ZarinPal Payments, Coupon Quotas and Refund Audit

- **State:** Proposed technical decision; commercial behavior approved
- **Date:** 2026-10-14
- **References:** [Data model](../YARIZAN-DATA-MODEL-V2.md), [API](../YARIZAN-API-CONTRACTS-V2.md), [Threat model](../YARIZAN-THREAT-MODEL-V2.md)

## Context and decision

Six independently priced products initially cost **1,299,000 Toman each**. Server stores money in integer **IRR** (12,990,000 IRR default), not floating-point. Admin may change future prices, sales switches and limited coupons without client deployment. Orders capture immutable price/discount/tax snapshots. First payment adapter is **ZarinPal**, but interfaces avoid provider lock-in. Admin must approve refunds; refund completion is distinct from requested/approved state and license revocation.

## Order and payment state machine

- Order: `PENDING -> PAID -> FULFILLMENT_PENDING -> FULFILLED`; failure/cancellation only when gateway outcome is conclusively settled. `REFUND_REQUESTED` and `REFUNDED` are separate business transitions.
- Payment attempt: `CREATED -> PENDING -> UNKNOWN|VERIFIED|FAILED|CANCELLED`; `UNKNOWN` is eligible for inquiry/reconciliation and may later become `VERIFIED`. Never mark failed on timeout alone. Multiple attempts may exist per order.
- Browser redirect and provider callback **are hints**, not proof of payment. Server verifies with configured merchant credentials and checks amount, provider authority/ref, currency, accepted provider status and linked order. Integration-specific codes/units are validated from merchant docs and live test account before production.
- Verification outside a long SQL lock; commit inside transaction with consistent lock ordering: order, attempt, coupon reservation and entitlement. Unique `provider+authority` and `provider+reference` (when supplied), `entitlement.source_order_item_id`, and (`customer_id`, `idempotency_key`).
- Fulfillment failure after provider success -> persist `PAID/FULFILLMENT_PENDING` for idempotent retry; no new charge. License production and outbox event are coupled to the same transaction as entitlement where possible. An external signing service failure is recorded and retried rather than lost.
- Payments and licenses remain immutable-history records after device block or refund.

## Limited coupon allocation

- Normalize code using ASCII case folding, prohibit confusing Unicode lookalikes for first release. Admin configures percent/fixed discount, cap, applicable grade(s), campaign validity UTC window, maximum total successes, optional per-customer max, minimum order, and enable toggle. Default non-stackable.
- In transaction lock campaign/code quota row(s), check `redeemed + reserved < limit` then create one reservation per order; do not count an unpaid browser visit as redeemed.
- When provider VERIFIED, convert active reservation to a unique redemption under lock. When provider conclusively fails/expires, release reservation. If UNKNOWN, keep reserved and reconcile; do not free until status is settled. If a previously released attempt is later confirmed paid, move to explicit exception handling / refund review to avoid overselling quota.
- Cap concurrent reservations and define short TTL, but TTL alone never justifies releasing an UNKNOWN real payment.
- Distinct refund approval and gateway success flags: `REQUESTED -> UNDER_REVIEW -> APPROVED|REJECTED -> PROCESSING -> REFUNDED|FAILED`, with idempotent provider operations, actor/time/reason and payment references.
- A signed offline perpetual license may remain usable without internet after refund until server revocation is synced; customers and support must be informed.

## Provider adapter contract

`PaymentGateway.createPayment`, `verifyPayment`, `queryPayment`, `refundPayment` return typed normalized records with amount and status. The official ZarinPal Node SDK supports payment/verify/inquiry/refund methods, but **merchant access to refund, exact currency unit and live sandbox constraints are unknown until verified**. Provider SDK is never the domain source of truth.

## Required tests

- Double click and callback replay yield one entitlement; independently paid duplicate attempts require financial exception handling.
- Payment timeout stays UNKNOWN; inquiry/verification can move it to VERIFIED; worker can crash/retry with same idempotency key.
- At last coupon use, 20 parallel checkouts never exceed quota. Expiration boundary and disabled-campaign state enforced server-side.
- Coupon quote manipulated by frontend cannot change order total.
- Admin can reject refund without touching license; only provider-confirmed refunded transaction sets `REFUNDED`. Support/admin audit retained.
- No credential, PAN, raw gateway secret, SMS secret or HWID is logged.
