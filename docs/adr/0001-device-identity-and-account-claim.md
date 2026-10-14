# ADR-0001 — Unified Device Identity and Customer Account Claim

- **State:** Proposed technical decision for V2 implementation; product requirement approved
- **Date:** 2026-10-14
- **References:** [Technical spec](../YARIZAN-TECHNICAL-SPEC-V2.md), [Threat model](../YARIZAN-THREAT-MODEL-V2.md)

## Context

Six independently packaged WPF games run on a single supported Windows machine. The **displayed username must be identical across all six**; the same customer purchases up to six independent entitlements. Present `HwidProvider` uses WMI and can change with OS/hardware variations; anyone can impersonate a reported digest in a modified client. A username is an identifier, not an authentication secret.

## Decision

1. Define `DeviceIdentityV2` with explicit `fingerprint_version=2` and one shared implementation referenced by all G1–G6 projects. Do **not** include grade/package name, product ID, app path or per-process random values in the fingerprint. Normalize selected WMI signals identically on every grade, reject meaningless placeholders and document deterministic fallback. Prefer a stable digest over logging raw hardware serials; no raw WMI to server unless essential and justified.
2. Preserve a device-bound **internal opaque UUID** and a human-copyable immutable **username**, e.g. `YZ-...`, unique at the database layer. Do not use customer-displayed username as device-authentication proof. Server records a versioned fingerprint digest and may use a deterministic display encoding with collision check/resolution. Distinguish username from entropy-bearing pairing code. Never describe hardware hash as a secret.
3. Generate a persisted **ECDSA P-256 device-auth key** separate from the server license signing key. Prefer Windows CNG **Microsoft Platform Crypto Provider** (TPM) and, when absent, Microsoft Software Key Storage Provider; mark fallback assurance level. Avoid exporting private material; lock key ACL appropriately. Windows user vs machine key scope is a security/usability tradeoff: machine-wide key access for ordinary users **must be tested before adoption**; default to access-safe per-user keys plus explicit server-approved additional enrollment if machine key requires dangerous ACL/admin access. In either case shared username is fingerprint-derived, not key-ID-derived.
4. Initial browser pairing: desktop requests nonce, signs challenge with enrolled key, receives short-lived one-time pairing code, user confirms in web. Claim requires the still-live desktop session/proof plus browser-side confirmation and atomically sets one password. Knowing username or HWID is never sufficient. Anonymous first-registration with attacker-generated key is a known race; apply throttling, key-change alerts, support dispute/recovery, account claim uniqueness, and optional TPM attestation if feasible. **Do not claim that a newly self-generated key proves genuine hardware**.
5. Once claimed, authentication is password + secure browser session. Password reset: support must verify independent ownership (purchase evidence/previously verified channel/device proof), issue one-time temporary credential with forced change and invalidate sessions. MeliPayamak reset URL only in a later verified-phone release. No OTP in first launch.
6. Product-specific license issuance binds internal device ID + chosen fingerprint version/digest + SKU, never just username. Hardware replacement/transfer requires reviewed auditable rebind; no silent automatic reassignment.

## Alternatives rejected

- Username/password derived directly from HWID: anyone knowing HWID could take over account.
- Separate account per grade: violates single username/customer experience.
- Always requiring TPM: excludes unsupported PCs; selected fallback disclosed.
- Permissive machine-wide private-key ACL: undermines device proof.
- OTP/mobile at first registration: conflicts with approved low-friction onboarding.

## Required implementation tests / acceptance gates

- G1–G6 same username across process runs, same Windows user, reboot; record behavior on OS reinstall, local profile change, WMI failures, BIOS/board changes and VM clones.
- Public username/HWID alone cannot claim, reset password, transfer entitlement, or register a replacement device key.
- Two concurrent first-claim attempts cannot create conflicting accounts; consumed/expired pairing tokens cannot be replayed.
- Key stays persisted/reopenable; normal non-admin launch works with TPM and software KSP; document handling when TPM disappears or machine changes.
- Block unsafe initial claim if key ownership proof or anti-race controls cannot be satisfied; raise explicit ADR follow-up rather than bypass.

## Known limitations

Software-only device fingerprints, local keys and app binaries can be spoofed or copied in hostile clients. Device binding is pragmatic licensing friction, **not** a cryptographic guarantee that exactly one physical computer can run the purchased content.
