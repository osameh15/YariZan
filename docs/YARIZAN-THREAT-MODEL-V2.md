# YariZan V2 — Threat Model and Security Acceptance

> **Status:** Design-time threat model (2026-10-14), **not a penetration-test result**. See [Phase 0 baseline](YARIZAN-PHASE-0-BASELINE.md).
> **Assets:** license signing keys, game payloads, device identity/private keys, customer password reset capability, payment and refund records, coupon quotas, Admin privileges, and audit trail.

## 1. Trust boundaries

The [activation/lifecycle security extension](YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md) adds secret code theft/enumeration, concurrent consumption, Admin abuse, ban escape via reset, stale replacement replay and revoked-credential tombstone retrieval. Required controls: 160-bit CSPRNG codes and server-side keyed verifiers, redacted request/audit/APM data, transaction/idempotency locks, MFA/scoped RBAC/recent reauthentication/CSRF, durable stable-device SKU restrictions, generation-aware reset and signed monotonic crash-safe recovery. Server controls are not implemented. Offline deletion/revocation and spoof-resistant hardware attribution cannot be guaranteed.

| New threat | Required future control / acceptance |
|---|---|
| Code theft/enumeration/APM leak | Secret-body redaction, 160-bit entropy, keyed verifier, rate limits and failed-attempt audit; no raw codes in logs |
| Parallel spend/lost response | Atomic code+entitlement+license transaction and canonical request-bound idempotency; test parallel requests and reset races |
| Reset used to evade grade ban | Retain stable device+SKU restriction independently of customer/profile/generation; denied post-reset enrollment cannot bypass it |
| Privileged reset/reissue abuse | Separate scoped roles, MFA/recent reauthentication, CSRF, verified ownership and append-only reason/actor audit |
| Stale replacement resurrection | Signed target/hash/lifecycle watermark, retained old tombstones and one atomic desktop snapshot; cross-ID currently blocked |
| Former key reads replacement account | Tombstone-only challenge scope with retained former public key; no new-account privileges; protocol review pending |

1. **Hostile desktop**: game launcher, local storage, WMI/HWID, embedded AES content key and game processes are under user's eventual control; device proof is not hardware attestation by default.
2. **Browser customer**: arbitrary JS requests, stolen browser sessions, pairing code theft, CSRF, session fixation, account enumeration.
3. **Admin operator**: elevated permissions, social engineering, reset compromise, manual grant/refund abuse.
4. **Backend/PostgreSQL**: source of truth for purchases, coupon quota, trial count, revocations, audit. DB uniqueness/transaction invariants required even if process restarts.
5. **ZarinPal/MeliPayamak/network**: provider credentials are secret; callbacks and redirects are not authenticated payments by themselves; SMS is a separate future delivery channel; backend HTTP errors cannot revoke a valid offline license.
6. **Build/release chain**: public repo, GitHub runners, installer, CDN and object storage must not contain signing private keys or plaintext game sources.

## 2. Risk register and concrete mitigations

| ID | Threat | Risk | Prevention / detection | Mandatory test |
|---|---|---|---|---|
| T01 | Report another machine's HWID / device spoof | High | CNG possession proof, verified pairing, non-claimability from username alone; disclose hardware attestation limit | Forged HWID cannot claim existing account |
| T02 | Race to claim first device username | High | Atomic unique claim, pre-claim verification, rate limits, support dispute/recovery | Concurrent enrollment tests |
| T03 | Replay pairing code or reset token | High | high entropy/TTL/single-use hash, binding, rate limits, session invalidation | Replay and expiry fail |
| T04 | Steal support-reset privilege | Critical | support identity evidence independent of HWID, scoped admin RBAC + MFA, audit, short-lived one-use reset | Support reset cannot proceed without evidence |
| T05 | Forge license or alter grade | Critical | server-only P256 key, domain-separated JCS signed envelope and SKU/fingerprint match | G1 license fails G2 or different device |
| T06 | Roll back local revocation | High | versioned signed decisions and atomic protected local high-watermark; acknowledge bypass by full local compromise | stale decision ignored in official client |
| T07 | Abuse two trial entries by retry/concurrency | High | per-(device,grade) row locks, durable nonce uniqueness, signed grant | concurrent requests exactly two unique starts |
| T08 | Replay trial grant in new process | Medium/high | in-memory session-only, session ID binding, no persistent grant; acknowledge patched binary can fake process | normal client relaunch cannot reuse old grant |
| T09 | Disable network mid-trial | **Expected behavior**, not attack | active trial never reauthorizes; online only to start | 60+ min uninterrupted play while disconnected |
| T10 | Duplicate/forged payment callback | Critical | provider verification with merchant credentials, idempotent order transitions, unique refs | callback 100x -> one entitlement |
| T11 | Payment timeout / late paid outcome | Critical | UNKNOWN state and scheduled inquiry, immutable attempts, exception handling | delayed settled payment preserved |
| T12 | Coupon cap race | High | transactional quota reservation, serializable rows and unique redemption | parallel coupon last-slot test |
| T13 | Admin fraudulent license/refund | Critical | MFA, least privilege, dual review for high risk as approved later, append-only audit | role-limited restricted action test |
| T14 | Installer/CDN tampering | High | signed distribution hash/manifest, Windows Authenticode planned, TLS and controlled origin | altered artifact rejected |
| T15 | Embedded game AES key extraction | Residual high | limit casual copying; ephemeral unpack, key custody, release controls; **no claim of unbreakable DRM** | inspect plaintext/key leakage and local cleanup |
| T16 | Cross-account / cross-order access | Critical | object-level authorization for every API, DB ownership checks | IDOR tests for orders/licenses |
| T17 | Secrets exfiltration from CI/container | Critical | secrets outside images/public repo, secret scanning, encrypted backup/rotation | artifact/archive scan for private keys |
| T18 | Data loss / restore rollback | High | offsite backups + restore drill + financial replay/reconciliation | recover staging, preserve post-backup financial events |
| T19 | Overcollect hardware/personal data | Medium | digest hardware signals, minimize logs, retention and support privacy policy | logs contain no raw identifiers |
| T20 | Device binding breaks after OS/hardware update | High | fingerprint versioning, stable normalization, audited support rebind and recovery | Windows reboot/reinstall tests |

## 3. Mandatory security boundaries

- Admin MFA is a go-live gate for financial, manual licensing and credential recovery operations. Support can never read customer password; forced-change reset token expires quickly and invalidates old sessions.
- Private license signing key and merchant/SMS secrets may not appear in Git, containers, artifacts or public host paths. Development keys are synthetic, obviously non-production, and cannot validate purchased releases.
- Paid access **must not fail closed on connectivity loss**. A signed, product-correct, device-correct unrevoked license authorizes perpetual offline play. Server revocation takes effect only once learned and persisted.
- Trial **must not introduce heartbeat** or disconnect-triggered termination once one of the two per-grade entries is spent and the open process is playing.
- Finance and audit history are append-only from normal business APIs; device block/erase cannot cascade-delete settled records. Sensitive fields are redacted in logs.
- Store minimal WMI data, user phone optional and verified separately. SMS should be disabled until integration is enabled and tested.

## 4. Residual risks / explicit tradeoffs

**No unbeatable DRM:** modified executables can bypass any local policy and may extract bundled encryption keys or decrypted game processes. Perpetual/offline access cannot simultaneously ensure instantaneous revocation on an offline machine. Fingerprint spoofing/VM cloning remain possible; CNG key use raises attacker cost, not a guarantee of physical-machine uniqueness. Never overstate these properties.

## 5. Suggested security test suites

- Windows client: invalid signature/kid/product/fingerprint; revoked decision counter rollback; default non-admin key store; cross-grade and reboot; forced offline after trial start.
- API/auth: username enumeration and timing, device-claim races, CSRF, credential stuffing, reset replay, IDOR, admin role escalation, malformed JSON and rate limits.
- Commerce: merchant verification mismatch, duplicate verification, amount/unit tamper, late success, coupon oversubscription and refund state separation.
- Operational: backup restore/roll-forward drill, secret scanning, package integrity, TLS, no cache on auth/payment, CI gates and non-production environment isolation.

## 6. External technical anchors

- https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers
- https://www.rfc-editor.org/rfc/rfc8785
- https://github.com/ZarinPal/ZarinPal-node-SDK
