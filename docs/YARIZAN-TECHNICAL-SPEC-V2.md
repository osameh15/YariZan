# YariZan V2 — Commercial Platform Technical Specification

> **Status:** Product requirements approved; target technical design proposed and documented, **not implemented**.
> **Date:** 2026-10-14
> **Owner:** OAR NOVA Games Studio
> **Source baseline:** `main` at `12e6553fc6748c2a5bb551dc887957f11e3098c3`, legacy desktop release `1.1.0`.
> **Canonical companion documents:** [Data model](YARIZAN-DATA-MODEL-V2.md), [API contracts](YARIZAN-API-CONTRACTS-V2.md), [Roadmap](YARIZAN-IMPLEMENTATION-ROADMAP-V2.md).

## 1. Purpose, scope, and status

YariZan is a Windows educational game collection distributed in **six separate grade-specific packages** (G1–G6). This document defines the approved *future* product behavior and a buildable target architecture. It does not assert that the current repository or deployed PHP service already implements these features. Existing UI, game packaging, encryption, WPF book navigation, and useful tests should be reused where practical. The old licensing protocol and database **do not require backwards compatibility** because the previous release has not been commercially launched. No old production database, signing key, or service may be removed before an explicit operational cutover.

Classification:
- **Approved business rules:** statements marked MUST in sections 2–5 and refund/support policy.
- **Target design / proposed engineering choices:** implementation details in sections 6–11; refine through ADRs and tests without changing approved behavior.
- **Requires verification:** real ZarinPal merchant API/permissions, MeliPayamak account/SMS mode, Windows fingerprint stability, licensing security assumptions, VPS capacity, legal/tax requirements, and live deployment credentials.

## 2. Approved commercial rules

| Product | SKU | Initial price (Toman) | Initial sale and activation |
|---|---|---:|---|
| First grade | YARIZAN-G1 | 1,299,000 | Enabled |
| Second grade | YARIZAN-G2 | 1,299,000 | Coming soon / disabled |
| Third grade | YARIZAN-G3 | 1,299,000 | Coming soon / disabled |
| Fourth grade | YARIZAN-G4 | 1,299,000 | Coming soon / disabled |
| Fifth grade | YARIZAN-G5 | 1,299,000 | Coming soon / disabled |
| Sixth grade | YARIZAN-G6 | 1,299,000 | Coming soon / disabled |

- Catalog entries for all grades MUST be visible from day one. Separate `publication_status`, `sale_enabled`, and `activation_enabled` flags MUST be controlled server-side through Admin; disabled products cannot be purchased or newly activated via forged requests.
- Price MUST be editable by Admin without rebuilding a client. All prices, coupon discounts, totals, and tax/fee calculations MUST be performed server-side; snapshots must be retained on order items. Store monetary amounts as integer **IRR** (initial single-grade price = 12,990,000 IRR) and convert for display in Toman. Confirm gateway amount-unit contract at integration time.
- Each purchase grants **one grade-specific perpetual entitlement for one identified device**; no expiration for purchased use. An entitlement for G1 must never unlock G2–G6.
- A customer may purchase multiple different grades, using the same account and device identity. Prevent an accidental second purchase of a currently owned grade; preserve payment attempts and refunds for audit.
- Support percent or fixed-amount coupons; per-code/per-campaign limits, per-customer limits, eligible products, validity windows, minimum spend, optional percentage discount caps, enable/disable, and non-stackable default. Enforce all constraints in transactions, not merely client UI.
- Initial provider: **ZarinPal**; treat browser return as untrusted. Verify payment via authenticated server-side provider API before recording Paid/issuing a license. Duplicates and ambiguous outcomes must not duplicate fulfillment.
- Refund requests require **manual administrative review and approval**. Refund request, actual gateway refund, and license revocation are distinct auditable transitions.
- Customer SMS provider for a subsequent stage: **MeliPayamak**. First release MUST NOT depend on SMS/OTP availability.

## 3. Definitive desktop access policy

### 3.1 Perpetual paid access (offline-first)

1. On each launch the app locally validates the license signature, `kid`, correct grade/SKU, device fingerprint and locally cached revocation state.
2. A valid active license MUST allow opening the paid product **immediately and fully offline**. No launch-time network requirement, online timeout, heartbeat or time-limited lease is permitted for paid users.
3. When connectivity exists, attempt a **non-blocking startup synchronization** and optionally a throttled later refresh. Failed/slow/unavailable network or backend MUST NOT terminate licensed games or block offline launch.
4. A valid authoritative signed server decision marking the license revoked is persisted locally; future launches must honor this state. A transient HTTP failure is **not revocation**. Support recovery/reissue paths for false revocation.
5. A valid entitlement survives program restarts. The license is for its product and the bound device for the product lifetime. Grade updates are included by default; other grades are not.
6. Offline perpetual operation means **remote revocation/refund cannot be guaranteed until a future successful online sync**. Disclose this tradeoff in terms and support tooling. Never claim perfect DRM.

### 3.2 Trial access (online only to start each session)

1. Without a valid paid local license for that **grade**, show Lock. The app queries online trial status for the pair (`device_id`, `product_id`) while Lock is visible. The status request never consumes an entry.
2. Each device has **two trial entries per grade** (the agreed grade-specific policy), counted transactionally on the server. User explicitly presses `Start trial`; only this action consumes one entry and receives a signed session-start grant. Duplicated requests with the same idempotency nonce consume once.
3. A successful start grants the **current application process session** access to the chosen grade, with **no time limit**. **No internet is required after that start**: neither one hour of play nor disconnection nor switching games/pages within the open process may terminate the trial. **No heartbeat, periodic authorize, per-game online check, or network-triggered forced closure in an active trial.**
4. Trial ends at **full process exit** (or explicit app shutdown); re-launch without a paid license requires internet and consumes the next entry when explicitly started. A retry of a lost response in the same pending start must be idempotent. Do not persist a reusable offline trial credential allowing a fresh process to restart for free.
5. Lock should automatically refresh connectivity/status when networking returns; a UI disconnect from Wi-Fi is not proof the API is unreachable. Purchase/activation requires connectivity.
6. The desktop is customer-controlled: process cloning, VM snapshots or modified executables can subvert local session protections. Test and mitigate practical abuse without promising absolute DRM.

### 3.3 Access decision table

| State | Need network to start? | Network loss after entry | End of process |
|---|---|---|---|
| Paid, locally valid G1 license | No | Continue playing | Next launch offline allowed |
| No license, G1 trial count available | Yes, to consume one | **Continue playing indefinitely** | Session ends; next trial start needs internet |
| No license, no remaining trials | Yes, for purchase/activation | Lock remains until paid activation | No change |
| Paid G1 installed alongside G2 | G1: No; G2: trial online or purchased | Independent per-product policy | Independent per-product licenses |
| Local revoked state confirmed by signed sync | Recovery action online | Do not treat a network error as revocation | Block future paid launches until reissued |

## 4. Device identity, customer accounts and activation

- All six installers MUST use a single versioned `DeviceIdentity` implementation and return the **same stable displayed username** on the same supported machine. Username example: `YZ-K7M2-P9XR-4D8Q`. This is an illustration, not a final encoding or entropy claim.
- Use an explicit fingerprint version and deterministic, documented normalization of selected Windows hardware signals. Test reboot, reinstall, hardware replacement, VM/WMI failure and distinct Windows users. A raw HWID must not be shown or treated as a password. A deterministic hardware-derived ID is **not** proof of device possession.
- First installation creates/recovers a device-bound asymmetric keypair (prefer Windows-protected/TPM-backed non-exportable keys where available) and uses proof-of-possession challenge response for web pairing. The key is separate from the licensing server signing key. Per-machine identity storage/ACLs and Windows multi-user behavior need a dedicated ADR.
- Account model is **one customer account per identified device**. The stable device username is the login identifier. First successful device-to-browser pairing permits choosing a password (and confirmation), without email/OTP gate. Subsequent web logins use username + password. Never allow anonymous knowledge of username/HWID alone to claim a device or set the password.
- Pairing uses short-lived high-entropy secrets, one-time verification, expiry, rate limits, explicit confirmation and proof that the requesting desktop controls the device key. Do not include serials/passwords/long-lived credentials in browser URLs. Treat pairing code interception and forged HWIDs as concrete threats.
- Use strong password hashing (Argon2id), server-side sessions (secure HttpOnly cookies), CSRF protection where cookie-authenticated, session rotation and throttling. Customer sessions and Admin sessions/roles are isolated.
- Password forgotten in Phase 1: customer contacts support, support verifies **independent evidence** of ownership, and Admin issues a **one-time temporary credential** requiring immediate password change. Do not reveal an existing password or reset based only on publicly reportable HWID. Prefer an admin-issued one-time reset link over transmitting new passwords when an already verified delivery channel becomes available.
- Phase 2: MeliPayamak sends a **short-lived, one-use reset URL** to a previously verified phone; customer enters new password themselves. SMS delivery does not replace ownership review for unverified numbers. No SMS/OTP dependency in first release.
- Hardware replacement/rebind is reviewed by support, with audit history. The original device license can be marked revoked, but offline copies remain usable until they sync.

## 5. Customer and Admin UX

Public/customer routes: `/`, `/products`, `/products/:slug`, `/connect`, `/login`, `/checkout`, `/payment/result`, `/account/orders`, `/account/licenses`, `/account/devices`, `/account/downloads`, `/support`. Admin path: **`/zanyari`**. Routing secrecy is not security; enforce authenticated RBAC and record-level authorization.

- User opens G1 launcher, sees common username/lock, initiates device pairing, browser confirms, chooses password, sees six products, buys enabled G1 via ZarinPal, and receives signed grade/device-bound offline license through an authenticated desktop pickup/poll channel. Manual activation code remains optional recovery path; not in URL.
- Customer portal shows order/payment status, discount applied, download, purchased grade, licenses and support. Admin includes current device search/edit, manual issuance, regenerate/revoke, reset trial, block, audit; new catalog/pricing/sale flags, coupon campaigns, payments, unknown reconciliations, refunds, reports, license/device lifecycle.
- Make Nuxt 4 UI Persian-first, RTL, responsive, accessible and keyboard usable. Show human-friendly states for Pending, Failed, Unknown, Expired, Paid, Refunded and activation errors. Backend policies always authoritative.

## 6. Target technology and decomposition

**Agreed target:** Nuxt 4 / Vue 3 / Tailwind for Store + Customer Portal + Admin Console; NestJS/TypeScript backend; PostgreSQL 17; WPF/.NET desktop retained. Prisma and migration tooling are the proposed data access approach; pin and verify compatible versions during bootstrap. Docker Compose per YariZan project behind studio Traefik; GitHub Actions for CI/CD. No Redis or broker needed until measurements justify it.

Prefer **modular monolith**, not microservices: Identity, Device, Catalog, Coupons, Orders, Payments, Licensing, Trial, Admin/RBAC, Audit/Support, Notification. Each module has typed domain/application/infrastructure boundaries and one authoritative PostgreSQL database. Use an internal outbox and worker for reliable notifications/reconciliation. Payment adapter and SMS adapter isolate providers.

Suggested repository evolution (proposed, **not an existing layout**):
- `apps/web` (Nuxt 4)
- `apps/api` (NestJS; Prisma schema/migrations)
- `apps/desktop` (WPF app/core/packer plus new DeviceIdentity and Licensing modules)
- `packages/api-contracts` (OpenAPI and shared generated client types)
- `infrastructure` (Compose/Traefik/backup/monitoring definitions)
- `docs`, `tests`, `.github/workflows`

Reuse current book/game UI and packer mechanics, but **replace** current shared-HWID PHP online-only licensing; never mislabel its current code as V2. No application, CI workflow, DB or production infrastructure is modified by this specification.

## 7. Security and failure-model contract

- Signed offline entitlement uses ECDSA P-256/SHA-256 with versioned canonical representation and server-managed `kid`. Private signing material stays outside public repo/container image/web roots and has tested encrypted backup and rotation procedure; no public/CI build contains production key material.
- Signature claims include at least format version, license ID, customer, SKU/grade, device binding, issued time and key ID. No paid license expiry. Verify strict canonical bytes, algorithm, allowed key ID, product match and device match. Define signed revocation/sync responses to prevent spoofed rollback.
- Offline licenses do not prevent tampered clients extracting embedded AES game key or decrypted games. Add publisher code-signing, installer integrity hashes, signed manifest/content checks and sensible temporary-file permissions; document limitations.
- Financial records and grant history are immutable through ordinary customer/device deletion. Use soft blocking and separate audit/retention controls. Protect Admin with MFA (before live payments), least-privilege roles and independent admin sessions.
- Verify server merchant, currency/unit, amount, unique authority/ref, final provider status, and order state. Browser return is only a trigger. Duplicate callback and double clicks cannot create multiple entitlements. Unknown payments are reconciled; never automatically mark failed solely on network timeouts.
- Server is authoritative for coupons, price, per-product purchase availability, payment confirmation, and trial counters. Bound retry nonces; DB uniqueness + row locks + transactional outbox prevent concurrent double use. Rate-limit account claim, trial requests, pairing, coupon probing and reset flows.
- GDPR/privacy and local sale/refund/tax terms, personal-data retention, receipts, consumer protection, payment merchant acceptance and SMS sender eligibility require business/legal review before release.

## 8. Deployment and observability boundaries

- Target host: `https://yarizan.oarnova.games`; Admin: `https://yarizan.oarnova.games/zanyari`. Old `yarizan.osameh.dev` currently runs legacy PHP/MySQL and must not be modified or deleted as part of documentation work. New system needs no v1 customer/license data migration, subject to a final operational check before cutover.
- Coordinate first with the separate studio VPS infrastructure owner: Frankfurt Ubuntu 24.04, 2 vCPU, 4GB RAM, shared Traefik. Capacity for YariZan **and** CHISTA/DOOMA must be benchmarked before committing resource reservations.
- Isolate web/API/DB network, enforce TLS, CDN bypass for all auth/API/payment routes, send large signed/hashed installers and game payloads through CDN/object storage. Production should use off-site encrypted backups and successful restore drills; backup service currently not guaranteed.
- Metrics: web/API health, auth failures, pending payment ages, reconciliation queue, coupon exhaustion/race failures, license issuance lag, SMS failures, storage, DB, and backup age. Audit financial/admin operations with correlation IDs but exclude raw passwords, tokens, payment sensitive fields and raw hardware identifiers from logs.
- Gradual cutover: staging + dry-run DB; sandbox payment; desktop G1 signed package on clean Windows; backups/restore; DNS/TLS; end-to-end buy/activate/offline/restart/trial tests; launch monitoring; recover with roll-forward or financial replay, never blind DB snapshot restore after real payments.
- Do not deploy, create secrets or release games until an explicit deployment approval. Docs-only commits are intentionally outside the current `web/licensing/**` automatic public deployment workflow.

## 9. Acceptance criteria and engineering gates

1. Same Windows device, all six installers, same displayed username even when different grades are opened.
2. G1 purchase/activation never grants G2 access; disabled G2–G6 reject purchase/activation server-side.
3. Two trials *per grade/device*, status view consumes zero. Two concurrent distinct starts consume at most two; duplicate same nonce consumes once.
4. Trial starts only online. Cut all connectivity **after entry**; play for 60+ minutes, navigate multiple games, no forced lock, no heartbeat, no extra consumption. Full process exit ends trial; relaunch requires online start and next entry.
5. Paid G1 activation needs internet once; after that launch and play with airplane mode and after reboot without delays. Startup online sync failure never prevents paid launch.
6. A signed explicit revocation received online persists and blocks next paid launch; ordinary server error does not revoke.
7. Coupon max-use and time-window limits hold under parallel checkout/payment; expired/failed reservations safely released; paid unknowns are reconciled.
8. Provider callback/retry/worker race creates exactly one entitlement/license per paid order item.
9. Forged HWID alone cannot set a claimed account password or complete pairing. Lost-device recovery verified and audited.
10. Payments, licenses, devices and audit history remain queryable after device block/refund; Admin RBAC/MFA verified.
11. Tested backup restore, signing-key continuity, installer integrity and production-grade observability before initial commercial sale.
12. No test/CI job touches real gateway, production data, private keys, or publicly deploys builds without the expected release gate.

## 10. Unresolved engineering verification (not open product decisions)

- Determine fingerprint version/migration and same-machine behavior across Windows users; choose TPM fallback and private-key ACL strategy.
- Formalize canonical license/signature encoding, trusted `kid` rotation, anti-rollback persisted revocation and protected local license store.
- Confirm ZarinPal current merchant-specific APIs, payment amount currency, sandbox environment and refund permissions; do not infer availability from an SDK alone.
- Confirm MeliPayamak delivery mode and verified-phone enrollment for future password-reset links.
- Confirm customer receipt/tax policies, refund disclosures and downloadable distribution/legal licenses.
- Pin Nuxt/NestJS/Prisma/.NET supported versions and produce a tested local Docker development setup.
- Validate hosting resources and CDN availability for users in Iran.

Provider reference starting points (must be revalidated during integration):
- ZarinPal API workspace: https://www.postman.com/zarinpal-team/zarinpal/overview
- MeliPayamak Node samples: https://github.com/Melipayamak/melipayamak-node
