# ADR-0002 — Offline Perpetual License, Signed Synchronization and Trial Process

- **State:** Proposed technical implementation decision; approved offline/trial behavior is non-negotiable
- **Date:** 2026-10-14
- **References:** [Technical spec](../YARIZAN-TECHNICAL-SPEC-V2.md), [API](../YARIZAN-API-CONTRACTS-V2.md), [Threat model](../YARIZAN-THREAT-MODEL-V2.md)

## Context

Legacy WPF `OnlineTrialClient` and `MainWindow` require online paid/trial authorization on entry, every launch, and each 60-second heartbeat. This **must change**. Paid license is grade/device-bound, **perpetual and offline from first activation onward**. Trial consumes exactly two device+grade starts, **requires internet only to start each individual process session**, and never interrupts active play because of a connectivity change.

## Signed license envelope proposal

- Use ECDSA P-256 with SHA-256; strict algorithm identifier `ES256-P1363` (not interchangeable with DER); signature is **64-byte IEEE P1363 r||s**, base64url without padding. Validate exact signature length.
- Artifact fields: `format=YARIZAN-LICENSE-V2`, `kid` (pinned recognized public key), `license_id`, `customer_id`, `sku`, `grade`, `device_fingerprint_version`, `device_fingerprint_digest`, `issued_at` UTC RFC3339, `expires_at=null`, `license_revision`. The grade and SKU must agree. UUID and fingerprint are not user-editable trust sources.
- Serialize signed payload using **RFC 8785 JSON Canonicalization Scheme** (JCS) over the bounded I-JSON subset (no floating money or arbitrary numeric precision); sign bytes of `ASCII("YariZan-License-V2\n") || UTF8(JCS(payload))`. Envelope `{"payload": ..., "signature": "<base64url>"}`; exclude `signature` from payload. Reject duplicate JSON keys, unknown format/algorithm/kid, illegal fields and ambiguous timestamps. Signing must be deterministic in **message bytes** (ECDSA signatures themselves need not be deterministic). Freeze JS/.NET reference vectors before release.
- Keep signing **private key server-only**. Desktop ships a pinned public-key set and may accept a pre-reviewed additional `kid` with a signed rotation manifest/installer update. Rotation must not strand valid perpetual offline licenses; retaining old verification keys is mandatory for existing licenses.
- Store paid envelope on disk with tamper-evident integrity from signature; use Windows-protected local storage as defense-in-depth, not as sole proof. Avoid any expiration/clock-based paid gating. An installed unrevoked license remains valid without servers indefinitely.
- Sync: attempt asynchronously at app startup **if online** and optionally throttle subsequent best-effort attempts. Do not await sync to open paid book or force-close running games on errors. Server returns signed `license_id` / `device` / `sku` / monotonic `decision_version` / `status` / `issued_at` response. Apply explicit `REVOKED` only after signature/target/version checks and atomic persistent write; enforce on **next program launch**. `TIMEOUT`, 5xx, internet loss or missing response never means revoked.
- Rollback limitation: best-effort protected local decision storage, version monotonicity and tamper checks resist casual replay but cannot guarantee remote revocation of an indefinitely disconnected or fully compromised machine.

## Trial start grant proposal

- Server requires a signed device-key request, `product SKU` and fresh 256-bit client nonce. Transactionally lock `trial_counters(device,product)`, look up retained nonce, refuse used>=2 for new nonce; otherwise store the signed start response and increment once.
- Grant claims: `format=YARIZAN-TRIAL-START-V2`, `kid`, `device_id`, `sku`, `grade`, `client_nonce`, `process_session_id`, `issued_at` (no session expiry). Sign separately with `ASCII("YariZan-Trial-Start-V2\n") || UTF8(JCS(payload))` in the same ES256-P1363 format.
- Process-session ID is generated randomly when this application process starts; grant held **in memory only**. Retry a lost start response with the **same nonce and process_session_id**, reusing exact server response. In the official app the trial process gate is not restored from persistent storage after complete process exit.
- **No online heartbeat** during an active trial, no required network before launching each game, and no time-based expiration while the app is open. Disconnect at minute 1, play/switch games at minute 60+ without force-closing. A full app process exit ends the trial; next launch requires another explicit online start.
- Trial numbers are **per product + device** and run only when license for that product is absent/invalid. Just querying remaining counts never consumes. A running process cannot be forcibly trusted or remotely revoked without violating the contract; document the residual abuse risk.

## State table

| Paid local state | Trial process state | Startup action |
|---|---|---|
| Valid paid license, no cached signed revoke | irrelevant | Open product immediately, optional async sync |
| Valid paid license with cached authenticated REVOKED | irrelevant | Lock; offer online recovery/support |
| Invalid/wrong-SKU/wrong-device paid license | Not started | Lock; online status, purchase/activation or trial |
| No paid license | Server-signed trial already started for this process | Play offline until full exit, no further network |
| No paid license | No grant | Lock, require internet to explicitly start trial |

## Hard failures and regression tests

1. Fake valid G1 license must not unlock G2, changed fingerprint, unknown `kid`, altered data or malformed signatures.
2. Paid activation then airplane mode, reboot, launch; never wait for request or 60-second re-auth. Invalid HTTP responses have zero impact on existing paid process.
3. Trial online successful start then forced Wi-Fi/network off while book open; play and switch games for 60+ minutes. Exactly one trial count consumed. No timers/requests for trial validation.
4. Full exit then restart offline without paid license -> Lock. Online second start -> count becomes 2. Third -> 403/semantic denial. Same nonce retry -> same grant.
5. Signed explicit revocation persisted and blocks next paid launch; wrong-key, mismatched SKU or lower `decision_version` ignored as invalid.
6. Signing JS/NET test fixtures agree byte-for-byte canonical message and verification. Use disposable keys, no production PEM.
