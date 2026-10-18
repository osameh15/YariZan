# YariZan ZarinPal contract evidence and readiness matrix

Scope: the server-side ZarinPal adapter in `backend/src/commerce/gateway.ts` and its settlement in `backend/src/commerce/payments.ts`. The production commerce gate is unchanged: `COMMERCE_MODE=zarinpal` is still refused at startup (`ZARINPAL_LIVE_GATE_CLOSED`). The merchant account is provisioned but not activated. No real payment has been attempted and none is possible.

## 1. Documented contract (confirmed by the owner from the official docs)

Sources: the official ZarinPal Node SDK documentation (`request`, `verify`, `inquiry`, `configuration`) and the `ZarinPal/ZarinPal-node-SDK` repository.

| Fact | Adapter behaviour |
|---|---|
| Request fields: `amount`, `description`, `callback_url`, optional `currency` | Sends exactly `merchant_id`, `amount`, `currency`, `description`, `callback_url`. A test asserts this key set. |
| Default currency is `IRR`, `IRT` is supported | Always sends `currency:"IRR"` explicitly. All stored amounts are IRR integers. |
| Minimum is 10,000 IRR | `create` rejects less than 10,000 and any non-safe-integer amount. |
| Verify uses the original `authority` and the original order amount | `verify` sends the attempt's stored `authority` and `amount_irr` from the database. Callback query values are never used as an amount. |
| Code 100 = verified | Accepted as a new verification when a positive numeric `ref_id` is present. |
| Code 101 = previously verified | Accepted only with order-bound evidence (section 3). |
| Authority is issued by the request call | 36-character form (`A` plus 35) accepted; pattern is alphanumeric-only so it cannot alter the StartPay URL path. |
| Redirect | `https://payment.zarinpal.com/pg/StartPay/<authority>` built server-side from a validated authority. |
| The SDK shows merchant ID and sandbox configuration | Merchant ID is a private secret (UUID shape checked at construction). The sandbox is not used. |

## 2. Settlement invariants (enforced and tested)

- The server decides the SKU and price. A full-price grade is 12,990,000 IRR unless the order's stored discount snapshot changes the total. The client cannot send an amount.
- `settle` accepts a verified result only when the result's authority, amount, currency, merchant configuration and a non-empty reference all equal the stored attempt. Any mismatch moves the attempt to `UNKNOWN` and records a `VERIFICATION_MISMATCH` exception for reconciliation.
- A provider reference can belong to only one attempt (advisory lock plus unique business key). A reused reference records `REFERENCE_REUSED` and never grants a second entitlement.
- One accepted payment per order. A second captured attempt records `DUPLICATE_CAPTURE`.
- Browser callback parameters are untrusted: the callback only schedules a server-side verify job.
- Timeouts, malformed bodies, oversized bodies, redirects and transport errors all produce `UNKNOWN` (never paid). The adapter never retries inside one call.
- Fulfillment is a separate durable job (`FULFILL`) and is idempotent per order item. The purchase SMS is a separate durable notice and is sent at most once.

## 3. Code 101 policy

101 means the authority was already verified by an earlier call. It is not proof that this server captured the payment, so it is not treated as a new capture by default.

- Before every provider verification call the job writes a `verify_requested:<attempt>` event. When the provider returns a parsed, documented answer it writes `verify_answered:<attempt>`.
- A 101 result is accepted only when an earlier call for the same attempt was requested and never answered (a lost or timed-out response that may have captured the payment). The check reads that state before the current call writes its own marker.
- Any other 101 (first call, or an earlier call that was answered) leaves the attempt unpaid and records the `ALREADY_VERIFIED_UNPROVEN` exception. Resolving it needs the existing Admin reconciliation process with evidence from the ZarinPal panel.
- A status check is now a single server-side verify call. The adapter no longer calls inquiry (see section 5).

Tests: unit tests for 100, 101, other codes and transport failure; integration tests for an unexplained 101 (no capture, repeated 101 still no capture) and a 101 after an unanswered call (captured once, one fulfillment).

## 4. Readiness matrix

| Item | State | Evidence or blocker |
|---|---|---|
| Request, authority, redirect, verify mapping | Implemented, mocked | `commerce.test.ts`, `integration.test.ts` |
| Currency and minimum | Implemented | IRR explicit, 10,000 IRR floor |
| Code 100 / 101 semantics | Implemented | section 3 |
| Idempotent settlement and fulfillment | Implemented | duplicate-worker and replay integration tests |
| Merchant ID handling | Private only | never committed, logged or sent to the browser; live gate still closed |
| Merchant activation | **Blocked (owner)** | account provisioned, not activated |
| Callback domain acceptance | **Unverified** | assumption: ZarinPal accepts only the merchant's registered domain; confirm in the panel before cutover |
| Callback query parameter names (`Authority`, `Status`) | Assumed from the SDK | used only to schedule a verify; confirm in a sandbox or activation test |
| Provider error codes other than 100 and 101 | **Unmapped** | all treated as `UNKNOWN`; no behaviour depends on them |
| Inquiry endpoint status vocabulary | **Unresolved** | inquiry exists in the official docs; its status values are not mapped, so inquiry is never used |
| Sandbox | Not used | the SDK supports sandbox mode; endpoints and behaviour not validated; CI uses deterministic mocks |
| Refunds and reversals | **Unresolved** | no refund method exists in the adapter; refund needs a reviewed API contract or panel process and explicit order states |
| Settlement timing and fees | **Unresolved** | merchant-specific; needs the activated account and finance sign-off |
| Reconciliation | Partial | Admin reconcile route and exceptions exist; no scheduled provider-side reconciliation |
| Egress to `payment.zarinpal.com` | **Not built** | API container has no unrestricted egress; needs the restricted-egress infrastructure PR |
| Legal pages, merchant information | **Not started** | needed for merchant activation review |

## 5. Why inquiry is not used

The previous adapter called inquiry and then verify inside one status check, and the job then called verify again. That made a real capture look like a 100 followed by a 101. Because the inquiry status vocabulary is not mapped, the status check is now one verify call and inquiry stays out of the money path until it is mapped and reviewed.
