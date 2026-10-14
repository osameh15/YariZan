# YariZan V2 — Data Model and Concurrency Design

> **Status:** Proposed implementation contract; not migrated or deployed. Read [Technical specification](YARIZAN-TECHNICAL-SPEC-V2.md) first.
> **Database:** PostgreSQL 17; Prisma proposed. Integer money storage in **IRR**, UTC timestamptz; use local Tehran time only for display/campaign authoring.

## 1. Core invariants

See [activation/lifecycle schema and transactions](YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md) for activation verifiers/redemptions, durable SKU restrictions, reset events and signed replacements. Those additions supersede the baseline customer global UNIQUE and trial composite keys below: retain historical customers with partial ACTIVE uniqueness; include account_generation in trial/idempotency keys. Only authorized Admin reset advances generation. New profiles/reissue do not reset trials. Device/product bans never cascade with customer deletion. These are proposed migrations, not deployed tables.

- A normalized stable device fingerprint identifies one primary device record; the displayed username is a separate stable public identifier, uniquely constrained and never used as authentication proof.
- A device maps to one active primary customer account; grade ownership is separate and unique by customer + product for an active perpetual entitlement. Device transfer/rebind is support audited.
- Products have stable SKU and grade 1–6, configurable sale/activation flags and catalog status. A purchase for G1 is never a license for G2.
- Exactly one successful fulfillment per paid order item; payments can have multiple attempts and refunds. Never erase a payment, entitlement or audit on a device block.
- Trial budget is exactly 2 per device/product; one confirmed entry per unique client request nonce. An entry is the *whole current process session*, not time slices or individual launched games.
- A paid license has no expiry date but can have a separately persisted signed revocation state. Offline clients can remain usable until sync.
- Monetary amounts and discount applicability are captured as immutable order snapshots; history does not change when Admin changes prices, SKU names or coupon rules.

## 2. Proposed tables (keys and indexes)

| Table | Minimum columns / notes |
|---|---|
| `grades` | `id` SMALLINT PK (1..6), `name_fa`, `sort_order` |
| `products` | `id` UUID PK, `grade_id` UNIQUE FK, `sku` UNIQUE, `slug` UNIQUE, `title_fa`, `description_fa`, `publication_status`, `sale_enabled`, `activation_enabled`, `min_client_version`, `current_release_id` nullable |
| `product_prices` | `id`, `product_id` FK, `amount_irr` BIGINT CHECK >= 0, `effective_at`, `ended_at` nullable, `changed_by_admin_id`; disallow ambiguous overlapping active prices |
| `product_releases` | `id`, `product_id`, `version`, `installer_url`, `sha256`, `size_bytes`, `published_at`, `minimum_launcher_version`; UNIQUE(product_id,version) |
| `devices` | `id` UUID, `fingerprint_version`, `fingerprint_digest`, `username` UNIQUE, `display_name`, `state`, `last_seen_at`; unique(version,digest), protect raw signals |
| `device_keys` | `device_id`, `key_id`, `public_key`, `status`, `created_at`, `revoked_at`; unique key ID, device-bound challenge proof |
| `customers` | `id` UUID, `device_id` UNIQUE primary ownership, `username` UNIQUE, `password_hash` nullable until claimed, `claimed_at`, `state`, `phone_e164` nullable, `phone_verified_at` nullable |
| `customer_sessions` | `id`, `customer_id`, `session_hash` UNIQUE, `expires_at`, `revoked_at`, `last_seen_at` |
| `device_pairings` | `id`, `device_id`, `request_secret_hash`, `user_code_hash`, `expires_at`, `consumed_at`, `status`, `attempt_count`; enforce one-time transition |
| `password_reset_requests` | `id`, `customer_id`, `token_hash` UNIQUE, `requested_by_admin_id`, `expires_at`, `used_at`, `verified_support_evidence_ref`; never store raw token |
| `orders` | `id`, `customer_id`, `status`, `currency`='IRR', `subtotal_irr`, `discount_irr`, `total_irr`, `pricing_version`, `idempotency_key`, `created_at`, `paid_at`; UNIQUE(customer_id,idempotency_key) |
| `order_items` | `id`, `order_id`, `product_id`, `unit_price_irr`, `discount_irr`, `total_irr`, `quantity`=1, `product_snapshot_json` |
| `payment_attempts` | `id`, `order_id`, `provider`='zarinpal', `authority` nullable, `provider_ref` nullable, `requested_amount_irr`, `state`, `verified_at`, `failure_code`; unique(provider,authority) where not null, unique(provider,provider_ref) where not null |
| `payment_events` | `id`, `payment_attempt_id` nullable, `external_event_id` nullable, `payload_digest`, `verification_state`, `received_at`; dedupe using provider event key where offered |
| `entitlements` | `id`, `customer_id`, `product_id`, `source_order_item_id` nullable, `source_type`='purchase'|'admin', `state`, `granted_at`, `revoked_at`; UNIQUE(source_order_item_id) where not null; active customer+product uniqueness policy |
| `licenses` | `id`, `entitlement_id`, `device_id`, `key_id`, `format_version`, `signed_payload`, `payload_digest` UNIQUE, `state`, `issued_at`, `revoked_at`; retain superseded license records |
| `license_sync_events` | `id`, `license_id`, `device_id`, `decision`, `response_version`, `created_at`; bounded retention + security audit |
| `trial_counters` | composite PK (`device_id`,`product_id`), `used` SMALLINT CHECK BETWEEN 0 AND 2, `updated_at` |
| `trial_starts` | `id`, `device_id`, `product_id`, `nonce_hash`, `grant_digest`, `signed_grant`, `started_at`; UNIQUE(device_id,product_id,nonce_hash), limited retry retention |
| `discount_campaigns` | `id`, `name`, `starts_at`, `ends_at`, `enabled`, `max_redemptions` nullable, `max_per_customer` nullable, `eligibility_type` |
| `discount_codes` | `id`, `campaign_id`, `code_normalized` UNIQUE, `type` ('percent'|'fixed'), `value`, `max_discount_irr` nullable, `min_order_irr` nullable, `max_redemptions` nullable, `enabled` |
| `discount_products` | composite PK (`discount_code_id`,`product_id`) |
| `discount_reservations` | `id`, `discount_code_id`, `order_id` UNIQUE, `customer_id`, `expires_at`, `state`, `created_at`; lock counters atomically |
| `discount_redemptions` | `id`, `discount_code_id`, `order_id` UNIQUE, `customer_id`, `redeemed_at` |
| `refund_requests` | `id`, `order_id`, `customer_id`, `reason`, `state`, `reviewed_by` nullable, `reviewed_at`, `decision_notes` |
| `refunds` | `id`, `refund_request_id`, `payment_attempt_id`, `amount_irr`, `provider_ref` nullable, `state`, `processed_at`; UNIQUE provider ref when present |
| `admin_users`, `admin_roles`, `admin_user_roles` | hashed password, MFA enrollment, disabled/locked status, RBAC |
| `audit_logs` | immutable append-only regular operations, `actor_type`, `actor_id`, `action`, `entity_type`, `entity_id`, `correlation_id`, `metadata_redacted`, `created_at` |
| `outbox_events` | `id`, `type`, `aggregate_id`, `payload_redacted`, `state`, `created_at`, `processed_at` |

**Implementation note:** DB CHECKs, FK deletion strategy, case-insensitive coupon/username normalization, partial UNIQUE indexes, time-window exclusion constraints and retention policies must be explicitly written in migrations; Prisma declarations alone may be insufficient for PostgreSQL-specific constraints. No production migrations in this documentation phase.

## 3. Key transaction algorithms

### 3.1 Consume one trial

1. Validate product is published/eligible for trial, rate limits, authenticated pairing/device assertion, normalized nonce and signed request proof.
2. BEGIN; insert-or-lock `trial_counters(device,product)` with `FOR UPDATE`.
3. Look for `trial_starts` by unique nonce. If found, return the exact previously stored signed grant (including if used=2).
4. If used=2, reject. Otherwise sign a start grant for grade/device/session nonce; insert `trial_starts`, increment used, write audit if needed, COMMIT. On signature or DB failure, rollback.
5. Use durable atomic unique constraints to serialize parallel requests. Grant allows the **current open process** to play offline without subsequent network calls. The server does not maintain a heartbeat or time lease. Client avoids persisting a reusable offline trial session for a new process.

### 3.2 Reserve and redeem a bounded coupon

1. Normalize code; verify enabled state, campaign interval, eligible SKU, per-account and global limits.
2. BEGIN; lock coupon + campaign quota state in a consistent order; reclaim expired *unpaid, fully reconciled* reservations.
3. Reserve quota against an order, with short TTL; enforce `successful_redemptions + live_reservations <= configured_limit`; COMMIT.
4. Verified payment fulfillment converts reservation to a unique redemption. If payment fails/expired and settlement has been resolved, release the reservation. If provider outcome is UNKNOWN, hold/reconcile before release or deny new checkout at quota.
5. Never issue both a successful discounted sale and a freed quota for a late-paid attempt: reconcile late success into an explicit exception/refund workflow if capacity was reallocated.

### 3.3 Verify and fulfill a payment

1. Persist payment attempt and redirect; callback/browser return is only a hint.
2. Query provider server-to-server outside a long DB transaction. Validate provider merchant, amount in verified units, authority/ref, and final success response. Timeouts => UNKNOWN, not Failed.
3. BEGIN; lock order and affected payment attempt (consistent order); match expected order amount; store idempotent verified payment; transition order to Paid once.
4. Insert `entitlement` with unique source order item; create grade/device-bound signed license if absent; redeem coupon reservation; append audit and outbox; COMMIT. A duplicate verifier repeats lookups and returns the existing result.
5. Deliver license to authenticated desktop pickup via outbox/retry. If after a confirmed payment license signing fails, keep a tracked Paid / FulfillmentPending state and safely retry; do not charge again.
6. Separate refund request approval from provider refund completion and revocation. Preserve audit, payment records and issued/revoked license history.

### 3.4 Rebind/revoke

1. Admin verifies ownership evidence, MFA and RBAC; records reason and links old/new device.
2. Issue a fresh product-bound license for the new device and persist signed revocation decision for old one; never delete historical payment or entitlement.
3. Old device with no internet can still use cached perpetual license until sync. This is an accepted offline-first limitation.

## 4. Migration and rollback

### Activation and lifecycle extension tables

- `activation_codes`: unique keyed verifier, product, intended recipient constraints, optional expiry, ISSUED/REDEEMED/CANCELLED state and Admin issuance/cancellation audit. No plaintext.
- `activation_redemptions`: unique device+account_generation+request_id, canonical request digest, unique consumed code reference and exact signed response for retries.
- `device_product_restrictions`: stable device+product primary key, BLOCKED/UNBLOCKED, monotonic revision, actor/reason/time; no customer-reset cascade.
- `customer_reset_events`: prior/new generation, customer/device, idempotent request and durable signed old-license tombstone references.
- `license_replacements`: old/new IDs, same customer/device/product, monotonic lifecycle_revision, payload hash and signed replacement authorization; preserve previous decisions.
- Partial ACTIVE customer uniqueness replaces global historical username/device uniqueness; trial keys include account_generation. Ordinary reissue/profile enrollment do not change generation.

See [full columns, locking order, crash-safe replacement and retention](YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md). Implement and test PostgreSQL constraints/migrations in the future backend, never the live MySQL service.

- Legacy MySQL schema stays untouched while new PostgreSQL schema is developed. **No backwards-compatible migration of the old unsigned product scope is needed** because no commercial legacy customers are asserted; verify operational reality before retiring old service.
- Apply new schema only in disposable dev/staging with test fixtures. Use versioned migrations, migration drift detection, and backup/restore drills.
- Pre-launch rollback can revert stateless services against compatible migrations. **After real payments, never restore an older database snapshot without reconciling new payments/licenses first.** Prefer roll-forward or a tested replay plan.
- Preserve an immutable monetary ledger/audit; expired session/coupon data can be pruned only with documented retention and no loss of finance/reconciliation evidence.

## 5. Test matrix

- Multi-grade one-device username, per-grade entitlement isolation, reinstall/hardware variation.
- Trial counter 0→1→2, third denied, same nonce returns same grant, parallel starts, snapshot/restart abuse boundaries.
- Trial offline after successful start, one hour or more uninterrupted; full app exit ends session.
- Paid offline activation and next reboot; invalid signature/device/grade rejected.
- Concurrent coupon checkout at exact cap and boundary timestamps, unknown late payment.
- Double gateway callbacks and concurrent worker fulfillments; exactly one purchase entitlement.
- Admin refund without deleting audit; pending/unknown reconciliation; partial failures and rollback/retry.
