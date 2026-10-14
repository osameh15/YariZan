# ADR-0004 — Phase 1 desktop artifact profile and release gates

- State: Implemented on feature branch; requires independent review before release
- References: ADR-0001, ADR-0002, Phase 1 engineering report

## Identity and keys

Fingerprint v2 is SHA-256 of UTF-8 `YariZan-Fingerprint-V2\n` followed by normalized, distinct ordinal-sorted values for `uuid`, `board`, `bios`, `cpu`, in that field order. Each entry is `name:length:value\n`; length counts UTF-16 code units. Normalize using NFKC, trimmed/collapsed whitespace and invariant uppercase; reject empty, zero/all-F and standard OEM placeholders. Exclude disk serials to avoid storage replacements changing identity. If all WMI signals are absent, use normalized HKLM 64-bit MachineGuid after `machine-guid:`. If that is unavailable too, identity is unavailable and device-bound access fails closed. Raw identifiers are neither sent nor logged.

Username is `YZ-` plus the first 96 digest bits in six four-hex groups. No SKU/path/executable/user/key enters it. Enrollment must collision-check this public identifier; it is never an ownership credential. Transient WMI changes can change the digest. MachineGuid fallback changes on reinstall. Reboot and different-account validation remain release gates.

Persisted P-256 CNG key `OARNOVA.YariZan.DeviceAuth.V2` is scoped to the Windows user, non-exportable, signing-only. Prefer Microsoft Platform Crypto Provider; software KSP fallback at first creation. Reopen an existing provider key before creating a replacement; failures to open it surface. No MachineKey flags or machine ACL grants. Additional Windows accounts require explicit backend enrollment. Physical-machine attestation and anti-first-claim-race controls are **not implemented**.

Challenge foundation signs `YariZan-Device-Challenge-V2\n` plus JCS `{challenge_id, nonce, fingerprint_version, fingerprint_digest, device_public_key}` with base64url SPKI public key and P1363 signature. This is a proposed transcript only. OpenAPI bearer proof and anonymous registration are not securely specified; production challenge/registration methods intentionally reject with EnrollmentRequired. No key/HWID-only account claim is available.

## Artifacts

Envelope is exactly `{algorithm:"ES256-P1363",payload:{...},signature:"unpadded base64url"}`. Signature is exactly 64 bytes, P-256/SHA-256; keys are reviewed pinned SPKI PEMs by `kid`. No artifact-supplied trust roots. JCS uses ordinal UTF-16 field sorting, exact Unicode/control escaping and safe integers only (absolute value <= 2^53-1). Floats, fractional/exponent lexical numbers, duplicates, lone surrogates, comments, trailing tokens, depth >8 and UTF-8 >32KiB fail. This is ADR-0002's bounded I-JSON subset, not a general floating-point JCS library. Canonical bytes are tested against Node JSON.stringify/UTF-16 ordering.

All fields are mandatory; unknown fields are rejected. IDs are lowercase UUIDs. issued_at uses UTC RFC3339 ending in Z, seconds and optional 1–7 fractional digits. It is validated for representation, never used to expire paid/trial access.

| Artifact | Domain prefix | Exact payload fields |
|---|---|---|
| Paid | `YariZan-License-V2\n` | format=YARIZAN-LICENSE-V2, kid, issued_at, license_id, customer_id, device_id, sku, grade, device_fingerprint_version=2, device_fingerprint_digest=uppercase64hex, expires_at=null, license_revision=positive safe integer |
| Trial | `YariZan-Trial-Start-V2\n` | format=YARIZAN-TRIAL-START-V2, kid, issued_at, device_id, sku, grade, client_nonce=uppercase64hex, process_session_id=UUID |
| Sync | `YariZan-License-Decision-V2\n` | format=YARIZAN-LICENSE-DECISION-V2, kid, issued_at, license_id, device_id, sku, device_fingerprint_version=2, device_fingerprint_digest, decision_version=positive safe integer, status=ACTIVE or REVOKED |

Paid device_id and sync domain/schema refine ADR-0002's previously unfrozen details. Device ID adds internal backend binding alongside fingerprint/SKU. Envelope algorithm follows existing OpenAPI. Grade/SKU must agree. Trial must match enrolled device, SKU, 256-bit nonce and process UUID. No trial artifact is persisted. Lost responses reuse the exact request within the controller; quitting ends that retry lifecycle.

## Storage, decisions and recovery

`%LOCALAPPDATA%/OARNOVA/YariZan/V2/YARIZAN-G<n>.license.dat` and `.decision.dat` are DPAPI CurrentUser blobs with inherited user-profile ACL. Same-SKU writers use a cross-process exclusive lock file. Write-through flush plus same-directory File.Replace/Move publishes the complete blob. Orphaned temporary files never authorize. Stored signatures are always reverified. Grades have independent paths. Missing license locks normally; corrupt license/decision locks safely. No server private keys or trial grants are stored.

Paid launch reads local state only. One best-effort Task.Run startup sync may persist a signed correctly targeted decision with strictly increasing decision_version under the lock. Network errors, malformed signatures and old/equal revisions never become revocation. Current paid access is frozen until exit after learning REVOKED; next launch locks. Explicit recovery while locked requires a newer signed ACTIVE decision for the **same** license. Timeout/stale ACTIVE cannot clear revocation. Cross-license-ID reissue requires a future authenticated recovery/migration contract and is blocked instead of deleting old state.

DPAPI and revisions are defense in depth, not tamper-proof DRM. Full local-state deletion/rollback, VM snapshots, modified binaries and game-key extraction remain possible. Indefinitely offline machines cannot be reliably remotely revoked. Other Windows users do not inherit licenses or CNG keys automatically.

## Networking and release gates

Only `https://yarizan.oarnova.games/api/v2/` is used; no PHP fallback. Injectable enrolled credentials are an integration boundary, not implemented authentication. Default credentials are unavailable. App disables redirects/cookies; requests have cancellation, 15-second whole-operation deadlines, 32KiB bounds and structured error codes. Only visible Lock retries unavailable status (15-second timer), canceled on unload; active trials have no timer/request.

Release roots require reviewed compile-time `secrets/v2-license-public-keys.json` (kid -> SPKI PEM). No test keys ship. Without keys and secure backend enrollment, real activation/trial is **Blocked by Backend / release provisioning**. Legacy serial/activation state never migrates into all-grade licenses. Legacy utilities remain diagnostic only. Packaging/game encryption format is unchanged.

Before release: define secure enrollment and anti-race controls; implement server counters and signed issue/sync; review trust roots/custody/rotation; define reissue migration; run real 60+ minute disconnected gameplay, reboot/reinstall/multiple-user/TPM-loss and six clean-installer tests. No service changes or deployment are authorized by this ADR.

Sources: [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), [Microsoft CNG parameters](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.cngkeycreationparameters?view=net-9.0), [Microsoft KSP documentation](https://learn.microsoft.com/en-us/windows/win32/seccertenroll/cng-key-storage-providers).
