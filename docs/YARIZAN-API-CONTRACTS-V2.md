# YariZan V2 — HTTP API and Signed Artifact Contracts

> **Status:** Proposed, versioned interface contract (not live endpoints). [Technical specification](YARIZAN-TECHNICAL-SPEC-V2.md) · [Data model](YARIZAN-DATA-MODEL-V2.md).
> **Base URL target:** `https://yarizan.oarnova.games/api/v2`. NestJS owns API; Nuxt SSR/customer UI must call it through appropriately secured boundaries.

> Phase 1 refines signed artifact fields/canonical bytes in [ADR-0004](adr/0004-phase-1-desktop-artifact-profile.md). Routes remain future contracts. Secure device enrollment/credential issuance is deliberately blocked pending an anti-claim-race protocol; no anonymous HWID fallback exists.

## 1. General conventions

- JSON over TLS only; versioned routes. Use RFC 3339 UTC timestamps and UUID/opaque IDs; stable `YARIZAN-G1`–`YARIZAN-G6` SKUs.
- Password/session and Admin requests: HttpOnly Secure SameSite cookies + CSRF defense for state changes. Desktop: device-key challenge/session credentials; no implicit browser cookie reliance.
- `Idempotency-Key` header on mutating order/payment/device-pairing operations; unique per account/operation and retained long enough for user retries. Trial consumes an explicit cryptographic nonce in its body.
- Traceable `request_id`; non-sensitive validation errors; refuse user-supplied money/discount total as authoritative. Rate-limit unauthenticated and financial operations.
- Representative error envelope (illustrative):

```json
{
  "error": {
    "code": "PRODUCT_NOT_AVAILABLE",
    "message": "This product is not available.",
    "request_id": "req_example"
  }
}
```

Suggested HTTP mapping: 400 invalid input; 401 unauthenticated; 403 forbidden/blocked; 404 resource hidden/not found; 409 conflict/idempotency mismatch/already purchased; 410 expired pairing; 422 business-rule rejection; 429 throttling; 503 provider/backend unavailable. Final OpenAPI must enumerate schemas and response codes.

## 2. Public catalog

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/products` | No | Six records; sale status, configured price, current release, image and description |
| GET | `/products/:sku` | No | Single record including supported grade, publication and minimum client |
| POST | `/discounts/quote` | Customer | Server-side quote; no reservation until order checkout |

Example catalog record:

```json
{
  "sku": "YARIZAN-G1",
  "grade": 1,
  "title_fa": "یاریزان پایه اول دبستان",
  "price_irr": 12990000,
  "publication_status": "published",
  "sale_enabled": true,
  "activation_enabled": true
}
```

Products G2–G6 start in `coming_soon` with purchase/activation disabled. Admin can enable without client rebuild. Existing perpetual entitlement remains valid if new sales are disabled.

## 3. Device identity, pairing and authentication

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/devices/challenges` | Rate-limited desktop | Create challenge bound to declared fingerprint + public device key; server must not trust raw HWID |
| POST | `/devices/register` | Challenge signature | Establish/recover device identity; return stable display username |
| POST | `/device-pairings` | Device proof | Create high-entropy one-time pairing session |
| POST | `/device-pairings/:id/confirm` | Customer browser + pairing code | Confirm account claim/association; consume one-time code |
| GET | `/device-pairings/:id` | Desktop device proof | Poll status; never expose password/serial in browser redirect |
| POST | `/auth/claim` | Confirmed pairing | First password setup, atomically mark account claimed |
| POST | `/auth/login` | Username + password | Secure customer session |
| POST | `/auth/logout` | Customer | Revoke session |
| POST | `/support/password-resets` | MFA Admin with audit | Issue short-lived one-use reset/temporary credential after independent ownership verification |
| POST | `/auth/password-reset/complete` | Valid one-use reset grant | Choose/confirm new password, revoke old sessions |
| GET | `/account` | Customer | Profile and device username |
| GET | `/account/devices` | Customer | Linked device info, no secret key disclosure |

Registration must not let an anonymous requester who knows a HWID preemptively claim its username. A first-claim physical possession/counterfeit-device threat review is a mandatory Phase-1 gate; proof of possession for an attacker-created software key alone is not hardware attestation.

Illustrative pairing request:

```json
{
  "fingerprint_version": 2,
  "fingerprint_digest": "UPPERCASE_SHA256_HEX",
  "device_public_key": "BASE64URL_SPKI",
  "challenge_id": "opaque_challenge_id",
  "challenge_signature": "BASE64URL_SIGNATURE",
  "grade": 1
}
```

The response returns opaque `pairing_id`, a short displayed code, URL `/connect` and a short expiry; do **not** put device secret or serial in that URL. Exact claim protocol and chosen key storage are pending a security ADR.

## 4. Trial

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/desktop/trials/:sku/status` | Device proof | Returns remaining 0..2; **does not consume** |
| POST | `/desktop/trials/:sku/start` | Device proof + nonce | Consumes **one** of 2 per (device,product), idempotently; returns signed current-process grant |

Example trial start:

```json
{
  "device_id": "dev_example",
  "client_nonce": "64_UPPERCASE_HEX_CHARS",
  "client_process_session_id": "random_session_id"
}
```

Result includes `grant` (a server-signed, product/device/process-scoped start artifact), `remaining` and `server_time`. Retry with identical device/product/nonce returns the **same** result. Third distinct nonce fails when exhausted.

**Critical contract:** A successful trial start is the last required online request until the desktop process exits. There is **no** `/trial/heartbeat`, periodic online `authorize`, per-game network check or active-trial forced termination on disconnect. Server-side count cannot reliably prevent a tampered local client from replaying an already delivered start artifact in a new process; mitigate casual replay and document limitations.

## 5. Offline paid licensing and synchronization

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/desktop/entitlements` | Device proof | Product list for connected device |
| POST | `/desktop/licenses/pickup` | Device proof + paired account | Return signed paid artifacts for entitled grade |
| POST | `/desktop/licenses/sync` | Device proof | Return signed current license decisions; timeout does not affect valid local license |
| GET | `/account/licenses` | Customer | Owned products, issued licenses, status and download/activation support |

Example paid license **payload before signature**, using ADR-0002/0004:

```json
{
  "format": "YARIZAN-LICENSE-V2",
  "license_id": "20000000-0000-4000-8000-000000000001",
  "customer_id": "30000000-0000-4000-8000-000000000001",
  "device_id": "10000000-0000-4000-8000-000000000001",
  "sku": "YARIZAN-G1",
  "grade": 1,
  "device_fingerprint_version": 2,
  "device_fingerprint_digest": "UPPERCASE_SHA256_HEX",
  "issued_at": "2026-10-14T00:00:00Z",
  "expires_at": null,
  "kid": "license-signing-2026-v1",
  "license_revision": 1
}
```

Sign exact canonical payload bytes with ECDSA-P256/SHA-256 and encode detached signature with a fixed, documented format. Validation MUST reject unknown format/kid/grade, wrong device, altered bytes and locally confirmed revocation. Public key can ship with desktop, private key stays server-only. Revocation response MUST be authenticated/signed and protect against stale response rollback (monotonic decision version or equivalent).

**Offline requirement:** desktop verifies locally and opens purchased grade without network. If network is up, sync asynchronously on startup; transient error has no lock/revocation effect. Explicit signed remote revocation persists for next launch. The license does not expire for time offline; strict immediate remote revoke is impossible.

## 6. Orders, discounts and payments

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/orders` | Customer | Create one-grade order using authoritative price and optional coupon |
| GET | `/orders/:id` | Order owner/Admin | Poll payment and fulfillment status |
| POST | `/orders/:id/payment-attempts` | Order owner | Prepare ZarinPal redirect, server calculated amount |
| GET | `/payments/zarinpal/return` | Public browser return | Untrusted hint only; initiate/retrieve backend verification |
| POST | `/payments/zarinpal/webhook` | Provider if supported | Must verify provider mechanism and server-side final state; never rely on unauthenticated payload |
| POST | `/orders/:id/reconcile` | Admin/worker | Idempotent recheck of unknown payment |
| GET | `/account/orders` | Customer | Ownership-filtered list |
| GET | `/account/licenses` | Customer | License states, no secret in URL |

Example create order request:

```json
{
  "sku": "YARIZAN-G1",
  "coupon_code": "NOWRUZ",
  "device_id": "dev_example"
}
```

Never accept user-supplied `price_irr` or `discount_irr` as authoritative. Response snapshots `unit_price_irr`, `discount_irr`, `total_irr`, currency `IRR`, coupon reservation deadline and payment state. ZarinPal amount **unit conversion** must be confirmed against current merchant docs before integration.

Order state examples: `PENDING`, `PAID`, `FULFILLMENT_PENDING`, `FULFILLED`, `FAILED`, `CANCELLED`, `REFUNDED`. Payment-attempt state examples: `CREATED`, `PENDING`, `UNKNOWN`, `VERIFIED`, `FAILED`, `CANCELLED`, `REFUNDED`. Transitions and refund statuses are separate, monotonic and audited.

ZarinPal provider boundary:
1. Create payment with authoritative expected amount and associated server order.
2. Redirect browser to provider URL.
3. On browser return, retrieve mapped attempt and call provider verification server-to-server.
4. Match merchant, authority, amount/unit and provider status before setting `VERIFIED`.
5. Lock order; upsert immutable payment and entitlement by unique keys; create signed license; redeem coupon; outbox notification. Duplicate callbacks cannot reissue.
6. Unknown/timeout remains `UNKNOWN` and is retried by a bounded reconciliation worker. Approval of refund is not proof of money returned.

## 7. Admin operations (under /zanyari)

| Method | Route | Admin RBAC |
|---|---|---|
| GET/PATCH | `/admin/products`, `/admin/products/:id` | Catalog manager |
| POST | `/admin/coupons` | Sales/Admin |
| GET | `/admin/orders`, `/admin/payments` | Sales/ReadOnly per role |
| GET | `/admin/devices`, `/admin/customers` | Support |
| POST | `/admin/licenses/issue` | License issuer, audited |
| POST | `/admin/licenses/:id/revoke` | Restricted admin, audited |
| POST | `/admin/trials/:deviceId/:sku/reset` | Restricted support, audited |
| POST | `/admin/refund-requests/:id/review` | Refund approver, MFA |
| POST | `/admin/refunds/:id/process` | Refund operator, idempotent |
| GET | `/admin/audit`, `/admin/reports` | Auditor/Admin |

Support manual issue MUST specify target device and SKU; cannot mint unrestricted all-grade licenses. Device block is soft; order/payment/audit records persist. Admin visibility of license codes is role-limited and access logged.

## 8. Contract and security testing

- Generate OpenAPI from DTO/schema; version and snapshot it. Test NestJS controller contracts and desktop C# client types.
- Cross-language deterministic fixtures for canonical bytes, `kid`, signing/verification, device+grade scope, stale revocation responses.
- Parallel calls for trial nonce and quota boundary, order/payment idempotency, first-claim device registration and password reset reuse.
- Full flow: install G1, claim stable device username, buy G1, download signed license, disconnect and play/restart; G2 remains locked. Trial disconnect after start must **continue unlimited within current open process**.
- Provider integration fixture/sandbox for request/verify/timeout/refund and authenticated callback; never run destructive payment tests in production.

## 9. External API references (verify again before implementing)

- ZarinPal API workspace: https://www.postman.com/zarinpal-team/zarinpal/overview
- MeliPayamak official Node sample: https://github.com/Melipayamak/melipayamak-node

These references establish candidate integration resources, **not** merchant-approved refund capability, production keys, currency behavior, or final route names.
