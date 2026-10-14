# ADR-0004 — Phase 1 desktop artifact profile and release gates

- State: Implemented on feature branch; requires independent review before release
- References: ADR-0001, ADR-0002, Phase 1 engineering report

## Independent review resolutions (reviewed HEAD 5c7dc59)

### Trusted local device ID

The first implementation checked device_id syntax and fingerprint but did not compare the offline license UUID with an independent trusted enrollment. A server-signed license issued for another internal device UUID with the same reported/spoofed fingerprint could therefore be accepted. Signature validity alone does not establish that the internal record is the locally enrolled device.

`ILocalDeviceEnrollmentProvider` now supplies local-only authenticated identity, independent of licenses and online credentials. The production factory uses `VerifiedLocalDeviceEnrollmentProvider`, verifying a separately signed DPAPI CurrentUser `device-enrollment.dat` against the current fingerprint and persisted CNG public-key SPKI digest. `VerifyLicense` requires this identity and compares device UUID and fingerprint. ReadLocalAccess, pickup and persisted-sync verification all use it. Missing enrollment fails with EnrollmentRequired; corrupt/mismatched enrollment fails closed. The client cannot bootstrap enrollment from a paid license, HWID, username or live client's DeviceId. There is no network request, credential expiry or enrollment time lease at paid startup.

Proposed enrollment payload (all fields required; same strict ES256-P1363/JCS envelope): `format=YARIZAN-DEVICE-ENROLLMENT-V2`, kid, issued_at, device_id, device_fingerprint_version=2, device_fingerprint_digest, device_key_digest=uppercase SHA256(SPKI), profile_enrollment_id=UUID. Domain is `YariZan-Device-Enrollment-V2\n`. StoreAuthenticatedEnrollment verifies before atomic publication under a cross-process writer lock and refuses identity replacement without a future authenticated recovery protocol. This freezes the desktop verification foundation, **not** an implemented initial/additional-profile registration API. Certificate issuance, anti-claim-race controls and enrollment recovery remain Blocked by Backend. No self-generated unsigned UUID file is trusted. No existing license-only installation is automatically migrated to trusted enrollment.

### One machine entitlement, several Windows profiles

Retain separate per-user non-exportable CNG keys and DPAPI stores. Do not share/export private keys, change machine-wide ACLs or silently claim a new device/customer for each Windows SID.

Proposed online additional-profile flow: a new profile creates its own CNG key, proves possession through a server nonce, then obtains explicit approval from the already claimed customer plus an existing enrolled profile's proof (or independently reviewed support recovery). Knowledge of username/fingerprint/new self-generated key alone is insufficient. Backend resolves the **same primary device UUID and customer**, authorizes another device-key/profile-enrollment record, and returns a signed profile-bound enrollment certificate. An authenticated entitlement pickup returns that machine's existing grade entitlement without another purchase. All profile keys use the same `(device_id, sku)` entitlement and trial counter; no per-profile quota reset. Enforce unique primary device/fingerprint and key enrollment/approval transactions, ownership/anti-race checks, limits, alerts and audit on the backend. Physical hardware attestation remains a separate possible assurance improvement, not something a software key proves.

After one successful enrollment/pickup per legitimate Windows profile, each profile can independently validate its signed enrollment and paid license offline indefinitely. A second profile initially offline cannot reuse another profile's DPAPI blob/private key and must first enroll online. Profile deletion, TPM/key loss, hardware identity changes and certificate/device-ID rebind require authenticated recovery; do not erase revocation or infer ownership from HWID. Revocation learned in one profile is not instant across other offline profiles; each must learn authenticated state on a later successful sync. Shared/compromised local administrator and VM rollback remain limitations.

Implemented: signature/key/UUID checks and per-profile storage foundation, plus simulated two-profile key/store tests with one machine UUID and the same entitlement. Blocked: actual additional-profile registration, owner approval and server identity/quota/entitlement transactions. Pending real acceptance: two actual non-admin Windows accounts, initial online approval/pickup followed by offline restart in both, common username/device UUID, no duplicate purchase/trials, denied unauthorized profile, profile deletion/recovery, reboot, TPM loss and per-profile revocation/recovery. No second Windows account has been tested yet.

### Commercial release gate

`YariZan.ReleaseCheck` runs before installer grade selection/packing, before CommercialRelease=true builds, and before ordinary app publish. Only explicitly marked FixtureOnlyBuild publishes may skip commercial prerequisites; they cannot be combined with CommercialRelease. Ordinary fixture/review builds still need no production secrets.

Public verification inputs are checked on **every app build when present**, including fixtures: nonempty strict kid-to-PEM map, exactly one SPKI PUBLIC KEY per entry, P-256 only, no private/trailing key blocks. Commercial validation additionally refuses known test/development labels and requires each kid's SHA256(SPKI) to match `release/v2-approved-public-roots.json`, a separately reviewed repository approval list (currently empty). Renaming a disposable key cannot make its unapproved fingerprint trusted. An algorithm cannot infer key provenance from an arbitrary public point: reviewers must approve the actual production fingerprints; never generate this list from fixture inputs or rubber-stamp test keys.

Required `secrets/v2-activation.json` has exactly format=YARIZAN-ACTIVATION-CONFIG-V2, api_base=https://yarizan.oarnova.games/api/v2/, enrollment_protocol=YariZan-Device-Enrollment-V2, additional_profile_enrollment=true. This is a release prerequisite declaration, not implemented authentication or a production credential. After structural checks the commercial gate still rejects this source revision because the real enrollment/credential integration is absent. No configuration/environment/MSBuild "ready" switch may silently promote it. Backend integration and reviewed production roots must be implemented/reviewed before changing that source gate. No private signing keys are accepted or embedded, and game encryption/packing is unchanged.

### Evidence scope

Windows CI now runs Run-BookChecks independently alongside the existing suites. Token evidence distinguishes actual GetTokenInformation(TokenElevation).TokenIsElevated from enabled Administrators membership. The earlier hosted run used an elevated administrator token and is **not** non-admin evidence. Local non-elevated evidence is recorded separately in the engineering report. TPM-preferred tests report the selected provider; software tests force software KSP. Two-key/profile simulations, disconnected test transport and modeled elapsed checkpoints are not physical second-account/disconnection/endurance tests.

## Identity and keys

Fingerprint v2 is SHA-256 of UTF-8 `YariZan-Fingerprint-V2\n` followed by normalized, distinct ordinal-sorted values for `uuid`, `board`, `bios`, `cpu`, in that field order. Each entry is `name:length:value\n`; length counts UTF-16 code units. Normalize using NFKC, trimmed/collapsed whitespace and invariant uppercase; reject empty, zero/all-F and standard OEM placeholders. Exclude disk serials to avoid storage replacements changing identity. If all WMI signals are absent, use normalized HKLM 64-bit MachineGuid after `machine-guid:`. If that is unavailable too, identity is unavailable and device-bound access fails closed. Raw identifiers are neither sent nor logged.

Username is `YZ-` plus the first 96 digest bits in six four-hex groups. No SKU/path/executable/user/key enters it. Enrollment must collision-check this public identifier; it is never an ownership credential. Transient WMI changes can change the digest. MachineGuid fallback changes on reinstall. Reboot and different-account validation remain release gates.

Persisted P-256 CNG key `OARNOVA.YariZan.DeviceAuth.V2` is scoped to the Windows user, non-exportable, signing-only. Prefer Microsoft Platform Crypto Provider; software KSP fallback at first creation (TPM-less providers may throw even while probing). A SID-scoped mutex serializes creation. HKCU `Software/OARNOVA/YariZan/DeviceKeysV2` records the selected provider under a hashed key-name value; reopen that provider/key or fail for explicit recovery, never silently replace an established TPM key. No MachineKey flags or machine ACL grants. Additional Windows accounts require explicit backend enrollment. Physical-machine attestation and anti-first-claim-race controls are **not implemented**.

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
