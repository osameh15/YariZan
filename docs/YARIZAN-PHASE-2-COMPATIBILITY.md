# Phase 2 compatibility review before implementation

Base: `c9ebb75c3d8fad98c2a685965cf6d9fc5c3a5d20`. PR #1 is merged. Main CI [38634463214](https://github.com/osameh15/YariZan/actions/runs/38634463214) succeeded. A clean separate worktree preserves the original worktree's untracked brand assets. The graph service returned Transport closed; direct source verification is used, not claimed graph coverage.

The merged SignedArtifacts, CanonicalJson, DeviceIdentity, DeviceKeyStore, DeviceEnrollment, DesktopV2Client, DesktopAccessController, ActivationCode, LicenseStore, CommercialReleasePolicy and V2 fixtures are the compatibility baseline. ADR-0004 overrides earlier illustrative documents.

## Existing desktop transport

All routes below are relative to `/api/v2`. Every request needs `Authorization: Bearer <enrolled credential>`. Browser cookies are not desktop credentials. Responses are bounded to 32 KiB; redirects fail. Errors are `{error:{code}}` (additional safe metadata is allowed). Authentication is an injectable provider; the stock desktop provider and registration methods deliberately fail closed.

| Route | Method | Body | Success |
|---|---|---|---|
| desktop/trials/:sku/status | GET | None | `{remaining:0..2}` |
| desktop/trials/:sku/start | POST | device_id, client_nonce (64 uppercase hex), client_process_session_id (lowercase UUID) | grant envelope, remaining (0..1), server_time (UTC) |
| desktop/licenses/pickup | POST | sku | SignedLicense directly |
| desktop/licenses/sync | POST | license_id, sku | SignedDecision directly |
| desktop/activation-codes/redeem | POST | activation_code, device_id, sku, request_id | SignedLicense directly |

Only `TRIAL_EXHAUSTED` with HTTP 403 maps to TrialExhaustedException. `PRODUCT_BLOCKED` maps to the Lock restriction state. Other structured codes remain V2ApiException; unavailable/invalid sync never becomes revocation. Redemption codes are ACTIVATION_CODE_INVALID/USED/EXPIRED/CANCELLED, PRODUCT_BLOCKED, ACCOUNT_RESTRICTED, IDEMPOTENCY_MISMATCH, ENROLLMENT_REQUIRED, RATE_LIMITED. No heartbeat or per-game authorization is added.

## Signed profile

Envelope has exactly algorithm=`ES256-P1363`, payload, signature. Signature is unpadded base64url of 64 raw bytes. ECDSA prime256v1/SHA256 signs domain UTF-8 plus canonical payload. The bounded RFC8785 integer subset sorts UTF-16 keys, rejects duplicate fields, unsafe integers, exponent/fraction lexical numbers, lone surrogates, depth >8 and >32768 UTF-8 bytes. IDs are lowercase UUIDs, digests uppercase SHA256, timestamps UTC Z. Every payload includes format, kid, issued_at; unknown claims fail.

| Kind | Domain (literal newline suffix) | Other required claims |
|---|---|---|
| Enrollment | YariZan-Device-Enrollment-V2 | device_id, device_fingerprint_version=2, device_fingerprint_digest, device_key_digest (SHA256 SPKI), profile_enrollment_id |
| License | YariZan-License-V2 | license_id, customer_id, device_id, sku, grade, device_fingerprint_version=2, device_fingerprint_digest, expires_at=null, license_revision>0 |
| Trial | YariZan-Trial-Start-V2 | device_id, sku, grade, client_nonce, process_session_id |
| Decision | YariZan-License-Decision-V2 | license_id, device_id, sku, device_fingerprint_version=2, device_fingerprint_digest, decision_version>0, status ACTIVE or REVOKED |

Formats are respectively YARIZAN-DEVICE-ENROLLMENT-V2, YARIZAN-LICENSE-V2, YARIZAN-TRIAL-START-V2, YARIZAN-LICENSE-DECISION-V2. Signed license device UUID must match independent enrolled identity; enrollment binds fingerprint and current profile key. Paid/trial timestamps are not expiration leases.

Device proof uses `YariZan-Device-Challenge-V2\n` plus canonical {challenge_id,nonce,fingerprint_version,fingerprint_digest,device_public_key}; public key is base64url SPKI, signature P1363. The proposed challenge foundation is reusable, but no real registration transport exists in the stock desktop.

The username is YZ- plus the first 24 fingerprint hex digits grouped into six groups of four. No hardware signals are uploaded. Independent profile keys must share machine UUID, generation, entitlement and trial counter.

## Implementation decisions and gates

Use NestJS modular monolith and explicit versioned SQL migrations with node-postgres. This compatible data-access solution exposes row/advisory locks, partial indexes, triggers and constraints directly; no ORM shadow schema is maintained. Check migration hashes and compare fresh schema dumps to detect drift.

New enrollment endpoints extend the previously blocked contract, not the five existing desktop operations. Development first claim requires browser possession of pairing secret and a separate desktop-key challenge confirmation. This does not prove physical-machine ownership. Production startup/enrollment remains blocked until independent first-claim assurance, external signing custody and real desktop credential provisioning are reviewed. No runtime production-ready switch or HWID-only shortcut.

Additional profiles require an existing customer session plus a fresh candidate-key proof and explicit authorization. Password recovery and same-ID license recovery require scoped MFA Admin and independent evidence. Arbitrary cross-ID replacement remains blocked; the official desktop has no atomic replacement verifier. Customer reset cannot instantly invalidate an offline cached license, and legitimate desktop enrollment replacement after reset remains a client integration gate.

Checkpoint plan: A database/runtime/CI; B paired identity and sessions; C trials/signatures/licenses; D codes and Admin lifecycle; E real PostgreSQL/API/.NET interoperability, Windows regressions, hardening and report. No production deployment or main modification.
