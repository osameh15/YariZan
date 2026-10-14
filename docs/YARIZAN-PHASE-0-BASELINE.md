# YariZan V2 — Phase 0 Architecture Baseline and Engineering Handoff

> **Status:** Phase-0 **documentation/design baseline prepared** on 2026-10-14. **NOT implementation-complete and NOT runtime-validated**. No execution of signing fixtures, Windows hardware tests, CI integration, backup restores, provider sandbox transactions, or production deployments has been performed in this phase.
> **Approved product requirements:** [V2 technical specification](YARIZAN-TECHNICAL-SPEC-V2.md). **Source code remains legacy v1.1.0** until subsequent feature work is reviewed and merged.

## 1. Read these sources in order

1. [Approved product and system requirements](YARIZAN-TECHNICAL-SPEC-V2.md).
2. [Data model, transactional invariants](YARIZAN-DATA-MODEL-V2.md).
3. [API contracts and example artifacts](YARIZAN-API-CONTRACTS-V2.md).
4. [Machine-readable API baseline](YARIZAN-OPENAPI-V2.yaml) — design reference, not generated from code; lint and reconcile against implementation.
5. [Device identity and account claim ADR](adr/0001-device-identity-and-account-claim.md).
6. [Offline license and trial ADR](adr/0002-offline-licenses-and-trials.md).
7. [Payments, coupons and refunds ADR](adr/0003-payments-discounts-and-refunds.md).
8. [Security threat model](YARIZAN-THREAT-MODEL-V2.md).
9. [Delivery plan](YARIZAN-IMPLEMENTATION-ROADMAP-V2.md) and [Phase 1 agent brief](YARIZAN-PHASE-1-AGENT-BRIEF.md).
10. Legacy docs (`architecture.md`, `security.md`, `online-licensing-plan.md`) describe **present v1 code** only. Keep historical statements, do not silently recast them as V2.

## 2. Baseline inventory verified by GitHub source inspection

| Area | Actual legacy | Target V2 |
|---|---|---|
| Launcher | `src/YariZan.App` WPF/.NET9; grade-specific packaging | Retain UI/packer; offline paid and online-to-start-only trial |
| Identity | `HwidProvider` WMI hash `YariZan-HWID-v1` | Unified cross-grade `DeviceIdentityV2` and device key |
| Client networking | `OnlineTrialClient` calls hard-coded `https://yarizan.osameh.dev/api/trial.php` | Contracted `/api/v2` client; non-blocking paid sync; no trial heartbeat |
| Access gate | `MainWindow` checks online before launch and every 60 seconds | Local signed paid claim; trial process memory grant |
| Serial | `SerialCodec` signs `YariZan-Serial-v1|HWID` | Product/device-specific V2 license envelope + key ID |
| Server | PHP 8.2/MySQL under `web/licensing` | NestJS modular monolith + PostgreSQL |
| User web | Single PHP admin UI | Nuxt4 RTL store, customer portal, RBAC admin |
| Payment/coupons | None | ZarinPal adapter, server-side reconciliation, reserved limited coupons |
| Test evidence | Legacy source tests and CI workflow exist | New cross-language vectors, trial offline integration, payment races and e2e required |

The user confirms **no commercial release** of the legacy installer. The public GitHub v1.1.0 Release existing is not evidence of commercial rollout. Do not delete the old running service until a future authorized release plan.

## 3. Approved non-negotiable product acceptance

- Six independent grade packages, all visible; only G1 sold/activated at first launch.
- Base price **1,299,000 Toman** each, Admin configurable; use integer **12,990,000 IRR** as starting data and lock precise gateway units on integration.
- One machine-wide displayed username consistent across the six installers, password selected through proof-of-device browser pairing; customer support-assisted first-stage reset (no OTP dependency), optional future MeliPayamak reset URL.
- Two server-counted trial entries **per (device, grade)**. Internet required to query/start on Lock; successful explicit start consumes exactly one. A running trial may play/switch games **indefinitely with no internet and no online recheck**; closes at process exit; next session requires a new online start. No trial heartbeat or per-game online authorization.
- First paid activation requires internet. **Perpetual paid license** for one grade + one bound device, verified locally and launchable offline forever while valid. On startup, online sync is asynchronous/best effort; transient failure never blocks. Signed confirmed revocation affects subsequent launches only.
- Coupon percentage/fixed, quota, per-customer, eligible SKUs and time window, with transactional reservations. ZarinPal provider verify required; no issuance from browser return alone. Refund manually approved; actual money returned and license revocation are distinct recorded events.
- Audited Admin `/zanyari` and consumer experience are Persian RTL and responsive. Production secrets never belong in source or compiled web artifacts.

## 4. Engineering decisions documented (not claimed hardware-verified)

| Topic | Baseline decision | Acceptance evidence still needed |
|---|---|---|
| Fingerprint | Versioned deterministic canonicalized HW characteristics, same algorithm all grades; device's display username derived through versioned encoding | Windows reboot, OS install, per-user, hardware changes, VM/WMI fallback; no collisions |
| Device possession | Enrollment challenge signed by a persisted Windows CNG key (TPM preferred, software provider fallback), plus one-use browser pairing | Physical-presence spoof threat, fresh claim/race, Windows key ACL and credential recovery tested |
| Signature | ECDSA P-256/SHA-256; public key pinned in desktop; domain-separated RFC 8785 canonical JSON payloads, base64url 64-byte IEEE-P1363 raw signature; version/kid | Deterministic canonical bytes across JS/.NET for example fields; verify tamper/wrong grade/wrong device |
| Offline state | Locally persisted signed paid envelope and signed versioned sync decision, monotonic revocation state best-effort | Restart offline, tampering, state rollback, key rotation and corrupt local store |
| Trial | In-memory process-only signed start grant, server row lock + nonce uniqueness | Two distinct concurrent starts, duplicate nonce, disconnect for 60+ minutes, process-close |
| Pricing | PostgreSQL integer IRR, immutable checkout snapshot, merchant-verified payment | Gateway currency/merchant privileges, callback & provider-state fixtures |
| Coupons | Transactional cap with pending reservations and redemption, never release UNKNOWN prematurely | Exact boundary/race/late-paid tests |
| Refund | Support review, provider state and revoke recorded separately | Provider-specific merchant approval and legal return policy |
| Identity recovery | Support verification independent of HWID; one-time reset credential, forced change | Negative impersonation tests, session revocation; eventual verified SMS destination |

These are **target design ADRs**, not a claim that OS-level hardware attestation or perfect client-side anti-tamper exists.

## 5. Hard gates before *coding* and before *production*

**Safe-to-start Phase 1:** the approved behavior is known, the ADRs exist, legacy files are identifiable, and an implementation agent can work exclusively in a feature branch with test fixtures and no service modifications. Agent must write a short implementation delta plan based on the actual repo before editing.

**Phase 1 must STOP for review if:** machine-wide key storage would require admin rights in ordinary installs; same-username guarantee cannot hold on supported Windows scenarios; any test requires real customer keys; chosen crypto serialization differs between languages; or trial networking still occurs after entry. Agent documents exact blocker and safe fallback instead of weakening product rules.

**Not complete until verified:** OpenAPI lint and client/server contract tests, actual Windows user/account and clean-install tests, deterministic dev-key cross-language signing vectors, backup restore test, provider sandbox verification, capacity planning, admin MFA, external gateway legal/merchant capabilities.

**Production NO-GO until:** G1 clean Windows installer and real encrypted game assets pass; offline paid + trial acceptance proven; reliable reconciliation; signing keys backed up; restore drill; privacy/refund terms reviewed; offsite backups; metrics; operator approves cutover. No DNS, old PHP changes, existing public licensing FTPS workflow edits or production deployment by Phase 1.

## 6. Implementation branch and report contract

- Create `feat/yarizan-v2-device-licensing` (or comparable feature branch) from latest `main`, first checking branch head and conflicts.
- Commit small changes in that branch only and run tests available on agent's OS; a Linux agent must report Windows-specific tests as **not executed**, not pass.
- Do not merge to `main`, tag a release, change DNS, GitHub Actions release paths, production secrets or deploy. If automated PR permission exists, open a PR for review; otherwise report compare URL.
- End with: SHA/branch, changed files, accepted requirements matrix, exact test commands and results, missed checks and reasons, limitations/risks, screenshots if relevant, and next-work recommendations.
- Security- or behavior-sensitive changes require C# tests for wrong grade/device, signature tampering, connectivity cut, trial per-process lifecycle and no heartbeat. Existing game WPF UI/game packer flows must regress cleanly.

## 7. Sources for implementation verification

- Microsoft CNG key storage: https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers
- Windows TPM usage: https://learn.microsoft.com/en-us/windows/security/hardware-security/tpm/how-windows-uses-the-tpm
- RFC 8785 JSON canonicalization: https://www.rfc-editor.org/rfc/rfc8785
- Official ZarinPal Node SDK: https://github.com/ZarinPal/ZarinPal-node-SDK
- MeliPayamak node client: https://github.com/Melipayamak/melipayamak-node

External SDK capabilities **do not prove merchant privileges**; confirm payment currency/amount/refund with the user's provider account before production.
