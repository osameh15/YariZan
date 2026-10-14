# Activation codes and independent customer lifecycle operations

Status: approved product direction, proposed future NestJS/PostgreSQL contracts. Desktop redemption UI/client and existing local signed-artifact validation are implemented; production issuance, redemption, enrollment and all Admin operations are **Blocked by Backend**. No live PHP/MySQL changes. This extends the V2 specification, data model, threat model and ADR-0004; it does not describe a deployed service.

## Desktop experience and boundaries

Lock identifies the selected grade, displays the common public username in a selectable LTR field, separates the two-entry trial count from actions, and offers automatic pickup or an expandable manual-code form. Normal availability is not styled as an error. Parchment/gold RTL presentation uses wrapping and vertical scrolling at small sizes. Success stays visible until explicit offline entry. Purchase currently refers to support; the future portal URL/checkout integration is not assumed deployed.

A manual code is a confidential **online one-time credential**, never a legacy serial, offline unlock, account claim or enrollment credential. Redemption requires the independently enrolled device identity and approved device authentication. After redemption, only the existing signed perpetual artifact grants offline access. It is bound to one grade/SKU and the independently enrolled device UUID/fingerprint. There are no embedded private roots or fixture fallbacks.

Code profile: `YZ2-` followed by eight groups of four Crockford-base32 characters (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`). Generate 32 independent uniformly random symbols with a CSPRNG (160 random bits); prefix/separators carry no entropy. Desktop accepts ASCII spaces/hyphens and case, rejects Unicode lookalikes, ambiguous I/L/O/U, legacy formats and inputs longer than 64 characters. Format validation is not proof of validity. Do not log/store codes in desktop settings, request diagnostics, URLs, analytics, audit metadata or screenshots. Input is cleared on successful activation and page unload. A pending retry request remains only in the owning process memory; managed strings cannot guarantee erasure.

`POST /desktop/activation-codes/redeem` uses the usual enrolled-device credential and JSON:

```json
{
  "activation_code": "YZ2-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA",
  "device_id": "10000000-0000-4000-8000-000000000001",
  "sku": "YARIZAN-G1",
  "request_id": "40000000-0000-4000-8000-000000000001"
}
```

This is a public test-only example, not a working code. Success returns **SignedLicense directly**, matching pickup and ADR-0004; no response flag can unlock the application. Structured errors: `ACTIVATION_CODE_INVALID`, `ACTIVATION_CODE_USED`, `ACTIVATION_CODE_EXPIRED`, `ACTIVATION_CODE_CANCELLED`, `PRODUCT_BLOCKED`, `ACCOUNT_RESTRICTED`, `IDEMPOTENCY_MISMATCH`, `ENROLLMENT_REQUIRED`, `RATE_LIMITED`. Invalid/not-found/wrong-SKU responses use the same public invalid message. Authentication mismatch must be rejected before code lookup. No raw code is echoed in errors.

Desktop generates a random UUID request_id on first submission, retaining it when the same normalized code is retried in that controller. Concurrent submissions serialize; after success it is cleared. Editing to another code selects a new request. Across complete process exit the retry state is not persisted: use authenticated pickup for a redemption already committed, or return support guidance if the code reports used. This trades restart-transparent retries for avoiding a persisted activation secret. Trial access is never suspended by optional pending/failed activation. A purchased controller makes no further redemption request. Cached signed revocation cannot be cleared by a code or by a different-license-ID response.

## Backend issuance and redemption transaction

- MFA/recent reauthentication + `activation_codes.issue` role, independently verified ownership/manual grant reason and request_id authorize Admin issuance. Scope is exactly one product; optional intended customer/device constraints, expiry and explicit cancellation. Do not count manual issuance as a payment or initiate refunds.
- Persist only a keyed secure verifier, e.g. `HMAC-SHA256(server code-verifier key, domain || canonical code)`, with key version. Key is in server secret management, never desktop/source/database plaintext. High entropy prevents practical offline enumeration; compare verifiers safely. Rotate by retaining needed verifier keys for outstanding codes. Code is delivered once over a secure channel in the issuance response. Lost issuance delivery requires audited cancellation/replacement; there is no plaintext retrieval endpoint.
- Rate limit per IP, enrolled device, customer and global budget; audit failed attempts with redacted code identifier/request correlation, never credential bodies. Alert on enumeration. Limit request/response sizes, cancellation and deadlines. Reverse proxies/APM must redact bodies and authorization.
- Authenticate device proof; verify current customer/generation/profile and exact body device_id. Reject account restrictions and durable product block before idempotent replay. BEGIN with consistent lock order: device/reset generation, product restriction row, code verifier, active entitlement and idempotency row. Unique `(device_id, account_generation, request_id)` plus canonical request digest prevents changed-parameter replay. Hash includes code verifier, not plaintext.
- Return the exact previously committed signed artifact for an identical authorized retry; changing code/SKU/device under the same key returns conflict. Verify code is issued/unexpired/uncancelled, intended constraints and product match. Atomically consume, create or restore the explicitly authorized entitlement, record license and immutable audit/outbox/idempotency response. Parallel distinct requests can consume a code once only. Signing/commit failure rolls back consumption; a lost HTTP response does not. Never charge or grant twice.
- Once used, code stays used. Cancellation can only transition ISSUED to CANCELLED; it cannot erase consumed entitlement. Revoking the delivered license is a separate operation. Replaying a historical request after reset/block is denied; Admin unblock does not implicitly authorize prior ownership. Authoritative counters, one-time consumption and restrictions require PostgreSQL; test transports are only contract models.

Token controls align with [OWASP's single-use token guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html); activation grants are a separate product protocol, not password reset.

## Independent Admin operations

Every mutation requires MFA, recent reauthentication, scoped RBAC, CSRF protection, reason, unique request_id, actor/time and append-only before/after audit. Use expected account/restriction/decision revision to reject stale Admin pages. No public self-delete endpoint can bypass bans. No global device/account ban is introduced by this mission; SKU blocks and reset are distinct.

| Operation | Authoritative transition | What it must preserve |
|---|---|---|
| Delete/reset customer | ACTIVE customer -> RESET tombstone; revoke sessions/password/reset/pairing tokens/profile online credentials; close entitlements and revoke every active license; increment account generation and reset operational trial budget for the future customer | Stable machine/device anchor and displayed username, durable SKU bans, consumed-code history, signed old-license revocations, immutable financial/audit history; no automatic refund |
| Block product | `(stable_device_id, sku)` unrestricted -> BLOCKED with increasing restriction_revision; applies to every Windows profile and replacement customer; revoke applicable issued licenses | Other grades, payment history, original entitlements as history, trial usage; no global ban |
| Unblock product | BLOCKED -> UNBLOCKED only by authorized Admin with revision/reason | No automatic paid entitlement, new ACTIVE decision, trial reset, code reuse, refund or payment rewrite |
| Reissue/restore license | Independently verify ownership, no active product/account restriction, restore explicitly selected same-device/product entitlement and sign higher-revision replacement/recovery | Customer identity, financial records, trial counters, previous license/revocation history |

Reset locks the stable device and current account generation, then performs credential/entitlement/counter transitions, signed revocations and audit/outbox atomically. Keep historical trial rows tagged with generation; effective fresh customer budget is 0, only after this privileged reset. Ordinary enrollment, additional Windows profile and reissue do not increment generation or reset budget. Historical customers may share the same public username/device; only one ACTIVE customer is unique per device. A subsequent legitimate secure enrollment creates a new customer UUID on that same anchor and generation. Old credentials cannot claim the new account. How to approve post-reset enrollment/anti-claim-race recovery remains a security integration blocker.

Durable restrictions live independently of customer rows, keyed by retained stable device UUID + product, not a Windows profile or deleted customer FK. Maintain protected fingerprint-version aliases and independently approved device recovery mappings to that anchor so re-enrollment cannot discard a block. No raw identifiers needed. Hardware digest and self-generated key do not prove hardware authenticity: determined spoofing/VM cloning and hardware-change attribution remain risk/acceptance limitations. Customer reset retains this minimum security anchor under restricted access and documented retention; it is not a hard erase of every record.

## Signed synchronization, restore and replacement

For every affected old license retain a signed `YARIZAN-LICENSE-DECISION-V2` `REVOKED` artifact targeting its exact license/device/SKU/fingerprint with decision_version greater than its last decision. Use existing strict signing format; do not add unsigned reason fields to the verified envelope. Audit records distinguish reset/block/refund/etc separately. A timeout, HTTP 401/403 or JSON error is **not** authoritative revocation. Current desktop applies authenticated signed revocation on next launch, never kills current gameplay.

Revoked/reset credentials must lose ordinary privileges immediately. A future narrowly scoped challenge proof with a retained former profile public key may only retrieve signed tombstones for its own old licenses (or proceed through independently approved recovery). It cannot read the new customer's data, consume trials, redeem, buy or enroll. Without such a reviewed route old-credential invalidation prevents delivery of revocation; this is explicitly **Blocked by Backend**. A permanently offline license cannot be instantly erased; rollback/tampered binaries can bypass local state.

Same-license-ID restore uses existing signed ACTIVE decision with strictly greater decision_version, explicit ownership/restriction checks and desktop recovery pickup. Unblock alone never issues it. Equal/older contradictory decisions cannot override revocation. Reissuing an old license with changed payload/revision is still subject to existing retained decision state.

Different-license-ID replacement is a proposed **unimplemented** protocol: `POST /desktop/licenses/recover` returns the new SignedLicense plus a domain-separated signed replacement authorization binding old/new license IDs, same customer/device/SKU/fingerprint, hash of new signed payload and a monotonically increasing device+SKU lifecycle revision. Domain `YariZan-License-Replacement-V2\n`, format `YARIZAN-LICENSE-REPLACEMENT-V2`; payload fields include format/kid/issued_at, previous_license_id, replacement_license_id, customer_id, device_id, sku, device_fingerprint_version/digest, replacement_payload_digest, lifecycle_revision and previous_decision_version. No code-only unsigned replacement is accepted.

Before implementing recovery, extend desktop with a reviewed verifier and **single atomic state snapshot** containing license, decision and lifecycle watermark; never delete a revocation first or write license/decision separately. Reject mismatched hashes/targets, stale lifecycle revisions and previous_decision_version below the local watermark. Retain old-ID tombstones so stale old licenses cannot regain access. Crash at any step must leave old revoked state or complete new state. Multi-profile synchronization and hardware/customer reset transitions require separate authorization review. Today's desktop intentionally rejects cross-ID replacement rather than weakly implementing this draft.

## Data and retention additions

| Table/change | Required columns and constraints |
|---|---|
| `activation_codes` | UUID, product_id, verifier UNIQUE, verifier_key_id, state ISSUED/REDEEMED/CANCELLED, optional intended_customer/device, expires_at nullable, issued_by, issuance_reason, redeemed_device/customer/entitlement/license IDs, redeemed_at, cancelled_at/by/reason; no plaintext |
| `activation_redemptions` | device_id, account_generation, request_id, request_digest, code_id, signed_license, committed_at; unique(device_id,generation,request_id), one successful redemption per code |
| `device_product_restrictions` | stable device_id+product_id PK, BLOCKED/UNBLOCKED, revision positive, actor/reason/time, corresponding signed revocation references; never cascade-delete on customer reset |
| `customer_reset_events` | old customer_id, stable device_id, previous/new generation, request_id UNIQUE, actor/reason/time, retained audit and tombstone refs; no passwords/PII in metadata |
| `devices` additions | account_generation, protected recovery alias mapping; keep stable UUID after reset |
| `customers` changes | remove global historical device_id/username UNIQUE; partial UNIQUE active device_id and active username. RESET historic records retained/pseudonymized |
| `trial_counters`/`trial_starts` | include account_generation in keys; reset changes generation, no deletion of security history; same generation across profiles and reissue |
| `license_replacements` | old/new license IDs, device+SKU lifecycle_revision UNIQUE, ownership_evidence_ref, actor/reason, signed authorization/digests; transactional with entitlements/license decisions |
| `license_sync_events` | durable monotonic per-license decision version and per-device+SKU lifecycle watermark; old-key tombstone retrieval scope |

Retain orders, order items, verified payments, refunds and their immutable snapshots/reconciliation identifiers; reset/block/reissue never implies refund. Preserve historical entitlement/license status rather than cascading payment references. Pseudonymize removable contact/profile data separately, with immutable audit corrections/addenda instead of silent rewrite. Do not retain activation plaintext, passwords or session tokens in audit. Minimum reset/device-ban evidence is purpose-limited, access-controlled and retained through the supported license/revocation lifetime. Exact financial/legal durations, pseudonymization rules, deletion authorization and jurisdictional review are **pending before production**; no statutory compliance claim or fabricated period is made.

## Future backend acceptance gates

Test concurrent code redemption/lost response, expired/cancelled/mismatched code, request-ID mutation, rate limit/audit redaction, resets during issuance/redemption, unblock without ownership resurrection, reissue without quota reset, historical decision replay, crash-safe replacement and retained ban after legitimate reset/re-enrollment. Verify old-key tombstone-only permissions and denied new-account access. Physical Windows multi-profile/reboot/disconnection/TPM-loss/clean-installer acceptance remains pending. No Admin operation or server security control is claimed implemented by documentation or a fake transport.
