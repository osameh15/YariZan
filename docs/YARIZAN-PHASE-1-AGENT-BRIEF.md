# YariZan V2 — Phase 1 Implementation Agent Brief

> **Status:** Ready for an external coding agent. This brief is bounded to **Phase 1 (Desktop Device Identity + Offline Paid/Trial Licensing)**. It **does not authorize** payment, production API, full Nuxt store, all-backend implementation, merge or deploy.
> **Prerequisite:** Read [Phase 0 baseline](YARIZAN-PHASE-0-BASELINE.md), [ADR-0001](adr/0001-device-identity-and-account-claim.md), [ADR-0002](adr/0002-offline-licenses-and-trials.md), [Threat model](YARIZAN-THREAT-MODEL-V2.md), and [API contracts](YARIZAN-API-CONTRACTS-V2.md).

## 1. Goal

Implement the **desktop-side foundations only**, in an isolated feature branch:
- One identical displayed device username among all six grade-specific WPF installers on the same machine, using a documented, versioned identity source and persisted key where practical.
- Product- and device-bound signed perpetual license validation locally; existing valid paid G1 must launch offline even if API/DNS fails.
- Trial Lock queries/starts online; per-device and grade server counting is an **API contract** and may be mocked during this phase. Upon confirmed start, the **current app process can run indefinitely offline** without heartbeat/per-game network checks; after process exit, no reusable trial on a new launch.
- Non-blocking paid startup sync abstraction with cancellation/timeouts and **only authenticated signed revocation** changing future launch behavior. No live provider, keys, DB or production service.

## 2. Boundaries and work sequence

1. Inspect latest main and current `MainWindow`/`OnlineTrialClient`/`ActivationStore`/`SerialCodec`/`HwidProvider`/`AccessSession`/`GameLauncher`, tests, packaging, CI; record findings before changes. Do not blindly rewrite WPF/game book.
2. Branch `feat/yarizan-v2-device-licensing`. Implement cohesive interfaces `IDeviceIdentity`, `IDeviceKeyStore`, `ILicenseVerifier`, `ILicenseStore`, `ITrialStartClient`, `IStartupLicenseSync` and a central access-state machine. Names may differ with justification.
3. Model strict signed envelope using ADR-0002 (JCS canonical byte serialization, P-256 SHA-256 P1363 raw 64 bytes, domain separation, kid, grade, device, revision). Build **test-only** signing fixtures; do not ship private key.
4. Wire local paid verification into actual launcher path; remove online hard dependency for paid games and remove online heartbeat from trial session. Keep UI/LoadingOverlay/game launching safety and close/cleanup semantics.
5. Trial Lock checks remaining online without consuming; explicit Start trial requests once with stable nonce for idempotent retry; run without network until process exit. No deferred background request required for trial.
6. Create fake/test transport and signed grant fixtures for future NestJS v2 endpoints. The new server is not ready: do not point real clients at old `/api/trial.php` pretending it is v2, and do not deploy stub server. Use build-time/local test options to keep compatibility for development without creating a production bypass.
7. Add unit/integration/regression tests and run available Windows CI checks. Never use real game payloads/keys; synthetic games only. If on non-Windows environment, report not executed Windows tests.
8. Document exact files/ADRs changed, open integration gap, and evidence. Commit on feature branch, open PR if possible, STOP before merge.

## 3. Explicit non-goals

- No change to old live PHP/MySQL service, DNS, shared VPS or existing licensing GitHub Actions deployment.
- No ZarinPal/MeliPayamak integration, Admin panel, Nuxt UI, new PostgreSQL schema or API implementation in this bounded sprint.
- No production signing-key generation, uploading secret material, downloading private game payloads or live test charges.
- No automatic downgrade to an always-online paid/license policy or an expiring offline lease.
- Do not silently weaken device claim security: if initial registration proof cannot be robustly delivered on Windows, implement the interface/test harness and document the production gate.

## 4. Reviewable done conditions

| Test | Expected |
|---|---|
| All grades on same Windows PC | Identical username |
| Valid G1 license in G1 | Opens instantly offline |
| Valid G1 license in G2 | Rejected |
| Wrong machine/tampered license/unrecognized kid | Rejected |
| Paid startup with broken DNS/503 | Continues play; error nonfatal |
| Trial status check | Zero entry consumed |
| Trial online Start succeeded | Exactly one start requested; in-memory grant accepted |
| Trial run then disconnect and switch games | No closure, no network dependency, no new trial count |
| Trial current process open 60+ min | Can continue indefinitely |
| Full process exit and relaunch offline | Cannot restore trial without new online start |
| Two distinct server-accepted trial starts | Third denied by fake-contract test |
| Duplicate nonce retry | Same signed result, no extra entry |
| Explicit signed revocation learned while online | Persisted and blocks next paid launch |
| Unauthenticated/older fake revoke decision | Ignored |

## 5. Agent result format

- Branch and HEAD SHA; PR URL if any; commit list.
- Architecture changes diagram, file-by-file summary and screenshots for relevant WPF views.
- Requirement-by-requirement table: Implemented / Partial / Blocked / Not Started.
- Exact test commands, OS, results/pass counts and any skipped checks (never invent Windows execution).
- Outstanding risks: hardware fingerprint stability/TPM ACL, state rollback, provider/backend not yet implemented.
- Confirm: no main merge, no production code/DB/DNS/secrets changes, and no old live PHP deploy.
