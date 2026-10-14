# YariZan V2 — Phase 1 engineering report

Current follow-on mission: [Activation UX/manual codes/account lifecycle report](YARIZAN-ACTIVATION-UX-REPORT.md), with its own exact test results, screenshots and Backend-dependent requirement matrix. Earlier sections below retain historical Phase 1/review evidence.

Date: 2026-10-14. Desktop foundations implemented on an isolated feature branch for independent review. **Phase 1's complete release/acceptance gate is not met:** real backend enrollment/issuance and production public trust roots are blocked, and real disconnected endurance/reboot/multiple-account/installer validation remains unexecuted.

## Independent code-review follow-up (reviewed HEAD 5c7dc59)

This section supersedes the original mission's results below for the review follow-up. Branch remains `feat/yarizan-v2-device-licensing`; [PR #1](https://github.com/osameh15/YariZan/pull/1) remains draft. Reviewed baseline: `5c7dc5969ae59f7d3cb547f871e00ebead08bbbd`. Final follow-up HEAD and current CI URL are recorded in the handoff/PR. No main merge or deployment.

### Finding-by-finding resolution

| Finding | Disposition | Resolution and integration boundary |
|---|---|---|
| 1. Signed license device UUID not independently bound offline | **Fixed** desktop; issuance **Blocked by Backend** | VerifyLicense now requires an independently authenticated DeviceEnrollment. Startup/pickup/persistence compare its UUID and fingerprint. Signed enrollment is separately verified against hardware and the profile's persisted public-key digest, DPAPI-stored atomically. Missing/corrupt/foreign record fails closed. No UUID is derived from a license, HWID or online credential. Negative tests use a correctly signed different UUID with the same fingerprint. Secure initial certificate issuance/anti-race/recovery remains blocked. |
| 2. Commercial device entitlement across legitimate Windows profiles | **Partially Fixed**; enrollment **Blocked by Backend** | Per-user keys and DPAPI remain isolated; no unsafe ACL/private export. Foundation permits separately approved profile certificates/keys to share one machine UUID and the same license. Proposed online approval requires the existing customer's authorization plus existing-profile proof or verified support recovery. Backend must preserve one customer/entitlement and one device+grade counter without another purchase or trial reset. Two-key/two-store simulation passed; a real second Windows account has not been tested. |
| 3. Commercial packaging prerequisites | **Fixed** | Installer preflight, CommercialRelease builds and ordinary app publishes run ReleaseCheck. Present roots are validated before all app builds to prohibit private/non-P256/trailing PEMs. Commercial roots require reviewed pinned SPKI fingerprints, reject test labels/substituted or renamed disposable keys, and require strict activation configuration. Repository approvals are intentionally empty. A source-level gate still blocks commercial release until actual secure enrollment/credentials exist; no ready flag bypass. Explicit fixture-only publishes remain possible and cannot be combined with CommercialRelease. |
| 4. CI book suite and evidence distinctions | **Fixed** desktop/CI configuration | Independent Run-BookChecks step added. Actual TokenElevation and enabled Administrators group are reported, with selected TPM/software provider. Earlier successful hosted elevated run is not non-admin evidence. Current local token evidence is below; current hosted evidence is reported separately in handoff. |
| 5. Preserve trial and perpetual paid contracts | **Fixed** / regression verified | Active trial remains process-only with zero heartbeat/time lease/per-game authorization. Paid startup uses local signed enrollment+license only, including when online credentials/DeviceId are unavailable. Optional sync failures do not revoke or stop games. |
| 6. Rerun regression/security and physical acceptance | **Fixed** automated; physical checks **Deferred** | All local suites rerun; physical 60+ minute disconnect, reboot, actual second account, actual TPM loss and clean commercial installers remain pending. No modeled minute/profile/transport simulation is represented as physical acceptance. |

### Security implications and supported profile behavior

Previously a server-signed license carrying a foreign internal device UUID but the same reported fingerprint could be accepted offline. A hardware digest is spoofable and cannot establish which server device record is locally enrolled. The fix uses a separate server-authorized profile enrollment under `YariZan-Device-Enrollment-V2\n`, bound to device UUID, fingerprint v2, profile enrollment UUID and SHA256 of the local CNG public SPKI. Its signature is reverified locally with pinned keys. License loading compares against that independent record, not against its own claims or a possibly expired/unavailable online credential. A profile without the record stays locked. Changing established enrollment identity requires a future authenticated recovery contract.

Paid access has no enrollment/credential expiration or required online lookup. After authorized provisioning, it survives ordinary offline restarts in the same profile. Moving another profile's certificate/license is insufficient: DPAPI user scope and distinct public-key binding reject it. A new Windows profile must first enroll online with explicit customer/existing-device or support approval; it must receive the **existing** machine UUID and entitlement. Server counters must be keyed by machine device UUID+SKU across all profiles. New-profile hardware hash and new self-generated key alone do not authorize that association. Issuance/approval transactions, key recovery, anti-first-claim race and hardware attestation remain backend/security work. No machine-wide private-key ACL was introduced.

Two simulated profiles with independent keys/stores, independently signed certificates, the same device UUID and the same purchased license both work offline. This establishes a desktop mechanism, not proof of second-account/backend deployment. Pending acceptance includes two actual non-elevated Windows accounts, authorized online enrollment/pickup without repurchase/reset, unauthorized profile denial, both offline restarts, key/profile deletion, reboot, TPM loss and independent revocation/recovery propagation. Permanently offline profiles can retain old signed state until their next successful sync.

### Changed files for this review follow-up

| File | Reason |
|---|---|
| `src/YariZan.Core/V2/DeviceEnrollment.cs` (new) | Independent enrollment model/provider/store, public-key-bound verification, protected atomic writer lock |
| `src/YariZan.Core/V2/SignedArtifacts.cs` | Enrollment signing domain/schema, trusted UUID comparison; reject private verification keys |
| `src/YariZan.Core/V2/DesktopAccessController.cs` | Require local enrollment for paid/start/pickup, retain network-independent paid startup |
| `src/YariZan.Core/V2/LicenseStore.cs` | Reuse bounded atomic DPAPI envelope helpers for enrollment |
| `src/YariZan.Core/V2/DesktopV2Client.cs` | Registration response foundation carries signed enrollment object; transport still blocked |
| `src/YariZan.App/Services/DesktopAccessFactory.cs` | Compose independent signed provider and current profile key; validate embedded public roots |
| `src/YariZan.Core/V2/CommercialReleasePolicy.cs` (new) | Strict public roots, reviewed fingerprints, activation prerequisites and fail-closed production integration gate |
| `src/YariZan.ReleaseCheck/Program.cs` (new) | Non-sensitive build-time prerequisite validation CLI |
| `src/YariZan.ReleaseCheck/YariZan.ReleaseCheck.csproj` (new) | Validator references actual Core policy without App/private game resources |
| `src/YariZan.sln` | Includes release validator in normal builds |
| `src/YariZan.App/YariZan.App.csproj` | Before-build public input checks and commercial build/publish gates |
| `release/v2-approved-public-roots.json` (new) | Empty reviewed fingerprint allowlist; fixture inputs cannot silently become production roots |
| `build-installer.bat` | Validate before grade selection/packing; publish explicitly commercial; no legacy serial public-key prerequisite |
| `tests/V2Checks/Fixtures.cs` | Independently supplied test enrollments and disposable signed certificates |
| `tests/V2Checks/Program.cs` | UUID/certificate/profile/release CLI/MSBuild/publish/installer negatives and actual token evidence |
| `tests/Run-V2Checks.ps1` | Build real validator before integration checks |
| `tests/BookChecks.cs` | Create render artifact directory on clean runners instead of assuming publish already exists |
| `tests/Run-BookChecks.ps1` | Optional isolated PreviewDirectory enables clean-output regression; default output preserved |
| `.github/workflows/ci.yml` | Independent synthetic book suite |
| `docs/adr/0004-phase-1-desktop-artifact-profile.md` | Binding/profile/release/evidence decisions and remaining blockers |
| `docs/YARIZAN-API-CONTRACTS-V2.md` | Independent enrollment and same-machine profile association contract |
| `docs/YARIZAN-OPENAPI-V2.yaml` | Proposed signed enrollment schema and registration response |
| `docs/build-and-pack.md` | Commercial vs fixture builds and clear release blockers |
| `docs/ci.md` | Independent book CI and accurate evidence scope |
| `docs/YARIZAN-PHASE-1-REPORT.md` | This finding-by-finding follow-up |

### Exact local test execution and token context

Windows `10.0.26300.0` x64; .NET SDK `10.0.401`, runtime `9.0.20`; Node `24.20.0`; Windows PowerShell. Process-only proxy variables were cleared for restore/build commands; machine network/proxy configuration was not changed.

```
EVIDENCE TokenElevation.TokenIsElevated=0; AdministratorsGroupEnabled=False
EVIDENCE TPM-preferred provider selected: TPM
RESULT 152 passed; 0 failed. Windows Microsoft Windows NT 10.0.26300.0; .NET 9.0.20
```

The same non-elevated local process successfully created/signed/reopened TPM-preferred and forced software keys (including child-process persistence/private-export refusal), and rejected established key loss. It is valid non-elevated operation evidence on this machine, not a statement about the hosted CI token or another Windows account.

| Executed command | Result |
|---|---|
| `dotnet build src/YariZan.sln -c Release -p:IncludeGameBundle=false -p:IncludeGameKey=false --nologo` | Five projects built; 0 warnings/errors |
| `.\tests\Run-V2Checks.ps1` | **152 passed, 0 failed**; includes release policy/CLI/MSBuild/publish/installer tests, signed profile enrollment and active-trial optional-upgrade preservation |
| `.\tests\Run-AccessChecks.ps1` | **27 passed, 0 failed** |
| `.\tests\Run-LauncherChecks.ps1` | **8 passed, 0 failed** |
| `.\tests\Run-GradeChecks.ps1` | **5 acceptance groups passed, 0 failed**; invalid-selection exits intentional |
| `.\tests\Run-BookChecks.ps1` | **36 passed, 0 failed** |
| `npx --yes @redocly/cli@2.63.0 lint docs/YARIZAN-OPENAPI-V2.yaml` | Pass; 0 errors/warnings |
| `py tools/Check-PublicRepository.py` | Pass |
| `git diff --check` | Pass |

Total local assertions/groups: **228 passed, 0 failed**. Expected commercial gate failures are passing negative checks, not successful commercial builds. V2 additionally executes the real CLI with missing/unapproved/private inputs, actual CommercialRelease MSBuild and ordinary publish refusal, explicit fixture publish success, conflicting fixture/commercial refusal, and installer preflight refusal before packing. The reviewed root list is empty and secure production activation integration is absent, so no commercial installer is produced or claimed verified. Disposable private material used by a negative validator test is never embedded, printed, committed or used as a release root.

The first follow-up CI run passed build and existing access/launcher/packing suites, then reached the book rendering check and failed because a fresh checkout had no publish artifact directory. SavePreview now creates its parent directory; an isolated previously nonexistent output-directory run validates this fix. Later V2 contract audit also fixed optional paid pickup temporarily suspending an already-started trial; pending/failing upgrade tests now preserve process access. Current CI result is supplied separately in the handoff.

### Local versus CI versus physical evidence

All five listed suites were executed locally. Follow-up Windows CI is configured to execute all five independently, including the formerly local-only book suite; its actual final run status/token/provider are provided separately in the handoff. The earlier reviewed successful hosted run used an elevated administrator token and software/TPM-fallback evidence must be read from its actual provider log; it must not be cited as non-admin execution. Local TPM-preferred selection here was **TPM**; forced software checks were separate. CI may select software on a TPM-less VM and still validate safe fallback, not physical TPM possession.

Disconnection was simulated by a failing injectable test transport. Actual WPF navigation and two encrypted synthetic game launches continued with zero subsequent trial network calls; this was not a physical internet cut. Modeled elapsed checkpoints run instantly and do not equal 60-minute endurance. Two profile keys/stores are a simulation within the same Windows user, not a real second account. Physical 60+ minute disconnected endurance, reboot, second Windows account, real TPM removal/loss, clean installers and live backend enrollment/pickup remain **pending**.

Residual risks: spoofed hardware/VM copies, local administrator or modified-binary compromise, rollback of protected signed state, inability to revoke permanently offline profiles, and unresolved server authorization/claim/recovery transactions. Reviewers must verify production root provenance; a public key's bytes cannot prove whether it was generated as a fixture. Deliberately changing source-approved fingerprints or bypassing build scripts is outside tamper-proof claims. No production signing keys, shared ACLs, live service/payment/database/DNS changes, merges or deployments were made.

The original mission sections below remain historical evidence for their original revisions; use this follow-up and final handoff for current results.

## A. Repository state

- Branch: `feat/yarizan-v2-device-licensing`.
- Base/latest main at mission start: `aef9bbc78d0a9a4357c3625f56b77ad037f672f7`.
- The final SHA is provided with the final handoff; a report cannot contain its own Git commit hash. [Draft PR #1](https://github.com/osameh15/YariZan/pull/1) is review-only. Implementation/test revision before documentation: `eb6b980` plus the settled-screenshot and TPM-less runner follow-ups.
- Commits: `2fbbb51` source review/plan; `1e288ae` core foundations; `4d1cf9f` WPF integration; `3b25596` authenticated recovery/key injection; `eb6b980` deterministic/Windows/HTTP/WPF tests; followed by settled-screenshot and artifact-profile/report commits. Use `git log --reverse aef9bbc..HEAD` for the authoritative complete list.
- No main merge, release tag or deployment. PR is review-only. Existing licensing deployment workflow and its watched paths are untouched.

## B. Architecture

`YariZan.Core.V2` contains shared device identity, CNG challenge signing, strict artifact verification, DPAPI atomic storage, access policy and bounded HTTP client. `DesktopAccessFactory` composes release dependencies; tests inject disposable keys/server responses. `MainWindow` owns one access controller and launcher for the application process. Legacy Core helpers remain for SerialGen and isolated historical regression tests but are not WPF authorization dependencies.

Interfaces: `IDeviceIdentity`, `IDeviceFingerprintProvider`, `IDeviceKeyStore`, `ILicenseVerifier`, `ILicenseStore`, `IAccessPolicy`, `ITrialStartClient`, `ILicenseSyncService`, `IDesktopV2Client`, `IDeviceCredentialProvider`, `IDeviceRegistrationClient`.

```mermaid
flowchart LR
    Local[Signed paid license and decision] --> Verify[Local signature and grade/device verification]
    Verify -->|active| Paid[Purchased process access]
    Verify -->|missing/invalid/revoked| Lock[Lock]
    Lock --> Status[Online status: zero consumption]
    Status --> Click[Explicit Start Trial]
    Click --> Grant[Online signed grant, one server entry]
    Grant --> Trial[Memory-only process access]
    Paid --> Games[Information / Book / encrypted games]
    Trial --> Games
    Paid -. asynchronous .-> Sync[Signed monotonic decision persisted for NEXT launch]
```

| State | Entry/game access | Network behavior |
|---|---|---|
| NoLicense | Locked | Status/start/pickup only |
| Purchased | Immediate local access | Optional nonblocking startup sync |
| Revoked | Paid locked | Explicit authenticated recovery; trials subject to backend policy |
| TrialAvailable | Locked until click | Status never consumes |
| TrialStarted | Local process access | No request, heartbeat or expiry |
| TrialExhausted | Locked | Purchase/recovery needed |
| ConnectionUnavailable | Locked | Visible Lock retries status |
| ActivationPending | Locked during explicit pickup | Cancellable online operation |
| InvalidLicense | Locked | No corrupt-file fallback |
| EnrollmentRequired | Locked | No HWID-only fallback |
| Closed | Denied | Lifetime cancellation, games stopped and cleaned |

Fingerprint v2 hashes normalized fixed-order WMI UUID/board/BIOS/CPU signals. It is grade/path/process/user independent. MachineGuid is the all-WMI-unavailable fallback; complete failure reports unavailable identity. Username uses 96 public digest bits in grouped hex; no raw hardware IDs are displayed. Backend-issued device UUID and enrolled credential remain separate from the username. Actual six grade configurations and six separate processes on this Windows machine produced the same username (not logged).

CNG uses persisted per-user P-256 signing keys, non-exportable, TPM preferred with software KSP fallback. Non-admin TPM and software operations were both executed; reopening across processes succeeded. Keys/entitlements are not automatically shared across Windows accounts. No unsafe machine permissions were granted. Self-created keys prove key possession, not physical hardware authenticity.

Artifact details are frozen in [ADR-0004](adr/0004-phase-1-desktop-artifact-profile.md): RFC8785 bounded safe-integer I-JSON subset, strict fields, pinned kid, P-256/SHA-256, 64-byte IEEE P1363 and separate paid/trial/decision domains. Paid licenses require device UUID, fingerprint v2/digest, grade+SKU, perpetual null expiry and positive license_revision. Verification never gates paid/trial access on the clock. All private server signing keys stay outside the app; tests generate ephemeral keys in memory.

Local `%LOCALAPPDATA%/OARNOVA/YariZan/V2/` stores one DPAPI CurrentUser paid license and decision per SKU. Profile ACLs and DPAPI supplement signatures. Exclusive same-SKU file locks serialize writes; write-through/flush and atomic replace avoid truncated overwrites. Missing/corrupt/truncated/malformed state fails safely; orphaned temporary writes do not replace previously valid entitlements. Signed decisions are reverified on restart and protected by increasing decision revisions while official code runs.

Trial creates one random process UUID and 256-bit nonce per controller. A lost response retries the same request. Only a verified correctly bound start grant changes State to TrialStarted. No reusable grant is stored, no timer or per-game network check exists, and window/process shutdown ends access. A new OS process was unable to recover the active grant. Fake server transactions prove the **client contract**, not production server quota enforcement.

HTTP uses only the future V2 host; no PHP fallback. App disables redirects and cookies. Requests support cancellation, 15-second operation deadlines, bounded UTF-8 request/response bodies and structured failures. Only unloaded/cancelled Lock performs status retries. Paid sync runs on Task.Run, validates signature/target/revision and atomically persists decisions without changing ongoing access. Explicit user recovery requires a newer signed ACTIVE decision for the same license. Cross-license-ID reissue is blocked until its migration contract is defined.

## C. File-by-file implementation

| File | Change and purpose |
|---|---|
| `src/YariZan.Core/V2/DeviceIdentity.cs` | Versioned public identity, deterministic normalization, WMI/registry abstraction |
| `src/YariZan.Core/V2/DeviceKeyStore.cs` | TPM-preferred user-scoped CNG persistence/public export/challenge signing |
| `src/YariZan.Core/V2/CanonicalJson.cs` | Strict bounded JSON, RFC8785 subset and canonical base64url |
| `src/YariZan.Core/V2/SignedArtifacts.cs` | Product/claim models; strict paid/trial/decision verification |
| `src/YariZan.Core/V2/LicenseStore.cs` | Six-grade DPAPI storage, atomic publication and writer locks |
| `src/YariZan.Core/V2/DesktopAccessController.cs` | Central access states, process-only trial, nonblocking sync and explicit recovery |
| `src/YariZan.Core/V2/DesktopV2Client.cs` | V2 routes, bounded cancellable transport, enrolled credential and blocked registration boundaries |
| `src/YariZan.Core/YariZan.Core.csproj` | ProtectedData 9.0.0 dependency |
| `src/YariZan.App/Services/DesktopAccessFactory.cs` | Release composition, embedded public roots and unprovisioned credentials |
| `src/YariZan.App/Services/OnlineTrialClient.cs` | Deleted: removes active legacy PHP authorization client |
| `src/YariZan.App/Views/MainWindow.xaml.cs` | Local navigation/game gates, no heartbeat, startup sync, shutdown lifetime; injectable game-key loader for synthetic integration |
| `src/YariZan.App/Views/LockPage.xaml.cs` | Common username, explicit trial/pickup, cancellable Lock-only status retry |
| `src/YariZan.App/Views/LockPage.xaml` | Persian V2 policy/support copy and pickup action; removes v1 serial input |
| `src/YariZan.App/Views/InfoPage.xaml.cs` | Clarifies future trial starts and current offline process access |
| `src/YariZan.App/YariZan.App.csproj` | Conditional reviewed public-key map embedding; fixture option excludes game AES key |
| `tests/V2Checks/V2Checks.csproj` | Windows/WPF executable test harness referencing actual app/Core |
| `tests/V2Checks/Fixtures.cs` | Disposable signer, mock WMI, transactional fake server with lost-response simulation |
| `tests/V2Checks/Program.cs` | Crypto/state/storage/HTTP/CNG/process/WPF integration checks and screenshot |
| `tests/V2Checks/interop.mjs` | Node canonical-byte comparison, .NET verification and reverse signing with an ephemeral key |
| `tests/Run-V2Checks.ps1` | Synthetic game build and repeatable isolated V2 suite |
| `tests/Run-BookChecks.ps1` | Generates synthetic portrait; avoids private game artwork/key dependency |
| `.github/workflows/ci.yml` | V2 Windows checks, Node interoperability and pinned OpenAPI lint; no deploy step added |
| `docs/YARIZAN-PHASE-1-PLAN.md` | Source-based plan written before code changes |
| `docs/adr/0004-phase-1-desktop-artifact-profile.md` | Exact implemented identity/crypto/storage/protocol refinements and gates |
| `docs/YARIZAN-API-CONTRACTS-V2.md` | Reconciles paid fields/UUIDs/revisions and enrollment blocker |
| `docs/YARIZAN-OPENAPI-V2.yaml` | Typed strict paid/trial/sync envelopes; resolves baseline lint defects |
| `docs/YARIZAN-IMPLEMENTATION-ROADMAP-V2.md` | Reports implemented foundations and unmet exit gates |
| `README.md` | Feature-branch desktop status and release blockers; historical access labeled |
| `docs/architecture.md` | Legacy architecture explicitly archived; links current report |
| `docs/security.md` | Legacy security explicitly archived; links current report |
| `docs/ui-flow.md` | Legacy flow explicitly archived; links current report |
| `docs/build-and-pack.md` | V2 distribution gates and safe fixture-only build options |
| `docs/ci.md` | New suites and synthetic inputs documented |
| `docs/Images/phase1-lock-v2.png` | Settled WPF Lock snapshot using test-only identity/server state |
| `docs/YARIZAN-PHASE-1-REPORT.md` | This review/evidence report |

Intentional incompatibilities: old HWID-only serials/activation.dat cannot unlock V2, no grade-wide migration, old PHP endpoint is not a V2 API, and serial entry becomes authenticated license pickup. Packer/game blob/manifest formats and unrelated launcher/book features are unchanged. ADR refinements: add paid device_id; freeze signed decision format/domain; specify integer-only JCS subset, UUID/timestamp profile, fingerprint normalization and user scope. Business rules are preserved.

## D. Testing and evidence

Environment: Windows NT `10.0.26300.0` x64, non-elevated Windows token; .NET SDK `10.0.401` compiling `net9.0-windows`, runtime `.NET 9.0.20`; Node `v24.20.0`; Windows PowerShell. Redocly CLI `2.63.0`.

| Executed command | Exact final result |
|---|---|
| `dotnet build src/YariZan.sln -c Release -p:IncludeGameBundle=false -p:IncludeGameKey=false --no-restore --nologo` | Success, 0 warnings, 0 errors; four projects |
| `.\tests\Run-V2Checks.ps1` | **117 passed, 0 failed** |
| `.\tests\Run-AccessChecks.ps1` | **27 passed, 0 failed**; historical utilities only |
| `.\tests\Run-LauncherChecks.ps1` | **8 passed, 0 failed**; invisible synthetic encrypted game |
| `.\tests\Run-GradeChecks.ps1` | **5 reported acceptance groups passed, 0 failed**; invalid CLI exits intentionally exercised |
| `.\tests\Run-BookChecks.ps1` | **36 passed, 0 failed**; synthetic portrait |
| `py tools/Check-PublicRepository.py` | Passed: no tracked private runtime files/signing keys |
| `npx --yes @redocly/cli lint docs/YARIZAN-OPENAPI-V2.yaml` | Passed, 0 errors/warnings with CLI 2.63.0 |
| `git diff --check` | Passed |

Total final assertion/acceptance groups across suites: **193 passed, 0 failed**. OpenAPI/scanner/build are additional checks, not added to that assertion total. New suite reruns occurred only after substantive test/recovery/screenshot/provider changes. Initial restore failed due to inherited malformed proxy settings; clearing HTTP_PROXY/HTTPS_PROXY/ALL_PROXY for the restore process allowed it to succeed. No machine proxy configuration was changed.

First PR CI run (Windows Server 2025 hosted VM) passed restore/build/scanner/legacy suites but stopped after 95 V2 passes in CNG setup; cleanup masked the original provider error. The implementation unnecessarily probed TPM even in a software-only creation path. Follow-up removes that dependency, handles TPM-less fresh creation, persists per-user provider choice so established-key loss fails closed, and avoids cleanup masking. Local rerun passes 117 checks; the final handoff records the subsequent remote CI result separately. This adds a recorded-provider/key-loss rejection test.

Earlier development runs failed on harness compile errors, an uncaught invalid sync artifact, and a reflection-driven WPF game click lacking a dispatcher synchronization context. Those were corrected and the final run passed. The test snapshot explicitly settles page animation because off-screen HWNDs do not necessarily advance composition. No failure is hidden as a skipped test.

Executed Windows evidence includes actual WMI across six grade configurations and six separate OS processes; non-admin software and TPM CNG sign/export-rejection/reopen; paid signed store and revocation checks in child OS processes; trial restart rejection in another OS process; WPF Cover/Lock/Information/Book navigation and two encrypted synthetic game launches with disconnected test transport, loading-overlay restoration and decrypted-file cleanup on shutdown. Other suites exercise page turns, RTL titles, thumbnails/cache/corruption, numerical navigation, game cancellation and generation-counter shutdown protection.

Crypto evidence: .NET P1363 signed paid artifact verified by Node; Node generated a fresh disposable key and signed the same payload, accepted by .NET. Canonical Unicode/Persian/control/emoji/U+2028/safe-integer bytes matched. Wrong grade/device, altered payload, bad/short signature, unknown key, duplicate fields, invalid claims and domain substitution reject. Sync tests cover forged/wrong-target/stale/equal revisions, next-launch revocation, corrupt state and higher authenticated recovery.

Trial evidence: status consumes zero; lost HTTP response consumes one but does not grant local access; exact nonce/process retry returns the grant without another entry; concurrent UI calls consume once; ten distinct parallel starts yield exactly two successes in the locked **fake**; G2 counters are independent. Active process access stays local at modeled elapsed checkpoints and actual WPF game switches invoke zero new requests. There is no clock/lease dependency. **This is not a real one-hour test.**

Not executed: physical all-network disconnection for 60+ minutes, real backend activation/trials, real PostgreSQL contention/retention, Windows reboot/reinstall, second Windows account, TPM removal/loss, six built installers/clean installation, authentic production game assets and real server key rotation. The workstation was not rebooted, reconfigured or disconnected; no production data/keys/games were used for tests. No installer/commercial-release claim is made. Remote GitHub CI results, if available, are separate from local results.

Screenshot: [V2 Lock with test identity](Images/phase1-lock-v2.png). Other local regression renders are under ignored `publish/`; no real game artwork was required.

## E. Requirement matrix

Implemented means executable desktop behavior verified where stated; it never implies deployed backend or completed physical endurance. This matrix covers mission sections 1–11; reporting and safety are sections A–H here.

| Requirement | Classification | Evidence/remaining scope |
|---|---|---|
| Read twelve latest-main docs and legacy architecture/security/UI/build/tests | Implemented | Source plan before edits, base recorded |
| Inspect all four projects and every named access/launcher path | Implemented | Graph search/trace/snippet plus coverage checks and source reads; metadata changes qualified |
| Separate feature branch, incremental commits, no merge/deploy | Implemented | Repository history and safety check |
| Shared versioned fingerprint independent of grade/path/executable/process | Implemented | Shared Core implementation; six separate Windows configurations/processes |
| Hardware normalization and mock WMI boundaries | Implemented | Case/whitespace/NFKC/placeholders/order/partial WMI tests |
| Human-readable common username; no unnecessary raw identifiers | Implemented | WPF username, no raw WMI logs/network data |
| Distinguish fingerprint/username/device ID/authentication credential | Implemented | Separate interfaces and signed backend UUID claims |
| Stable internal backend UUID enrollment/storage | Partially Implemented | UUID carried in signed licenses/credential boundary; actual enrollment blocked |
| CNG TPM preference, secure software fallback, non-admin operation | Implemented | Both providers tested with non-elevated token |
| Reopen persisted user-scoped non-exportable key | Implemented | Separate-process tests; no unsafe ACL/MachineKey |
| Reboot/reinstall/cross-Windows-user stability | Partially Implemented | Algorithm user independent; physical/account scenarios not executed |
| Challenge-signing foundation | Implemented | Signed proposed transcript tested; no claim of attestation |
| Secure device registration/pairing/account claim | Blocked | Reviewed enrollment/anti-first-claim race and backend required |
| Exactly one device and SKU/grade per perpetual purchased artifact | Implemented | Strict signed ID/fingerprint/SKU/grade fields and rejection tests |
| P-256/SHA256/JCS/domain/P1363/kid/version verification | Implemented | .NET/Node checks and negative crypto tests |
| Production signing private key never shipped/tested/generated | Implemented | Ephemeral fixture keys, pinned public-root boundary, scanner |
| Initial authenticated activation/pickup end to end | Blocked | Future backend, enrolled credential and reviewed production trust roots absent |
| Local paid immediate offline launch and restart | Implemented | Core/WPF and actual child-process signed-store tests |
| Network timeout/outage cannot terminate valid paid games | Implemented | Local CanEnter, hanging/failing sync tests; no stop path on networking |
| Async startup sync never blocks entry/gameplay | Implemented | Entire sync scheduled; local WPF entry and hanging sync tested |
| Signed target-bound monotonic revocation, atomic persistence | Implemented | Signature/target/revision rejection and protected-store tests |
| Revocation affects next launch, not ongoing session | Implemented | Controller and child-process/HTTP tests |
| Higher signed ACTIVE recovery for same license | Implemented | Explicit recovery tests; outage/stale ACTIVE denied |
| Cross-license-ID reissue/migration | Blocked | Authenticated migration contract needs backend/security review |
| Permanently offline remote revocation limitation | Implemented | Documented, no mandatory lease introduced |
| Trial status lookup never consumes | Implemented | Fake server and HTTP/WPF status tests |
| Explicit online Start Trial consumes one verified grant | Partially Implemented | Client and WPF/HTTP fake verified; live server not implemented |
| Two per-device/per-grade authoritative entries | Partially Implemented | Locked transactional test transport; PostgreSQL enforcement blocked |
| Random nonce and exact lost-response retry idempotency | Implemented | Fake and HTTP lost-after-commit/retry tests |
| Concurrent starts cannot exceed two | Partially Implemented | Ten-way locked fake test; production DB races not implemented |
| Active trial no online continuation, time limit or heartbeat | Implemented | Local state, no clock/expiry, no MainWindow timer; disconnected transport WPF two-game test |
| Game switches/pages spend no extra entry/revalidation | Implemented | Actual WPF navigation and two encrypted synthetic launches |
| Full exit ends trial; fresh process needs new online start | Implemented | Window shutdown and separate OS-process tests |
| No persisted reusable trial credential | Implemented | No trial store writes; independent process remains locked |
| Real 60+ minute complete-disconnect endurance | Not Started | Explicitly unexecuted physical acceptance gate |
| Central states: all mission paid/trial/connection/activation/corrupt cases | Implemented | Controller enum/policy, WPF uses same decision |
| Cover/Lock/Info/book/animation/thumbnails/loading/RTL retained | Implemented | 36 book checks plus WPF V2 tests |
| Encrypted game preparation/cancellation/shutdown preserved | Implemented | 8 launcher checks plus WPF synthetic integration |
| Six independent durable product entitlements | Implemented | Six store slots validated without overwrite |
| Missing/corrupt/truncated/malformed storage safely rejected | Implemented | Protected-store, schema and decision failures |
| Atomic writes/interrupted-write safe recovery | Implemented | Replace/no-temp and abandoned-temp tests; no real power-cut test |
| Appropriate Windows storage/permissions, no signer private key | Implemented | User-profile DPAPI and signature defense in depth |
| Revocation separate from transient network health | Implemented | Separate signed decision vs LastError/state tests |
| Rollback/process/executable tamper limitations documented | Implemented | ADR/report; no tamper-proof claim |
| V2 host/interfaces for trial/pickup/sync | Implemented | Route/DTO HTTP tests; no PHP client remains |
| Device challenge/registration endpoints | Partially Implemented | Typed interfaces/key foundation; production implementations blocked |
| Cancellation/timeouts/payload bounds/errors | Implemented | Cancellable bounded transport and tests |
| Valid paid works when V2 unavailable; unlicensed remains locked | Implemented | Offline paid / unprovisioned enrollment tests |
| Cross-language serialization/signature checks | Implemented | Node/.NET bidirectional disposable key checks |
| Existing packaging/launcher/book/access regressions | Implemented | Final suite counts above |
| Six clean grade installers and real encrypted game release | Not Started | No production asset/installer work authorized in this phase |
| Production/staging/DB/DNS/payment/SMS changes prohibited | Implemented | None made; future commercial platform not started |
| Complete Phase 1 definition of done/release gate | Partially Implemented | Desktop verified; backend/physical/installer acceptance gaps remain |

## F. Security review

Device spoofing/enrollment: fingerprint and public username are not secrets. CNG prevents ordinary private export and raises casual-copy costs; software provider/VM cloning remain vulnerable. TPM possession is not attestation. First anonymous enrollment and claim races are unresolved and deliberately unavailable in the stock build. Browser/account/support recovery must never authorize from HWID alone.

License tampering: strict schemas and pinned public roots protect official verification against forged/cross-grade/cross-device artifacts, signature encoding ambiguity and JSON ambiguity. DPAPI is not the trust source. The executable and bundled AES game key remain customer-controlled; code patching/content extraction remain possible.

Revocation: only signed matching increasing decisions persist; network failure never revokes. Corrupt learned state locks rather than pretending to clear revocation. A full local backup rollback or deletion can remove learned decisions; no permanent offline revocation guarantee exists. No ongoing paid game is forcibly closed when a revocation is learned.

Trial replay: random process/nonce and memory-only gate stop ordinary official-client relaunch reuse. Duplicate lost-response retry is idempotent. Modified binaries, snapshots and prolonged open processes can bypass business limits; no claim of tamper-proof quota is made. Counters must be server authoritative; the test fake is not distributable enforcement.

Secret review: no new production secrets, private signing keys, gateway settings, credentials or game payloads were committed. Public roots are compile-time reviewed data. Test private keys are generated in memory; CNG test keys are uniquely named and deleted after checks. Tests build encrypted fixtures using random disposable AES keys and disable real game/key inclusion. Public repository scanner passed. No real customer identifiers are in the report/screenshot.

## G. Known issues and required next steps

1. **Release blocker:** secure enrollment/device credential issuance, registration anti-race controls and account pairing require backend/security design. Production implementation intentionally returns EnrollmentRequired.
2. **Release blocker:** provision reviewed V2 public verification roots and server-only signing custody/backup/rotation; no test roots may become release roots. New builds currently cannot perform commercial activation/trial.
3. **Backend gate:** implement PostgreSQL per-device/product counters, retained nonce transactions, exact signed artifacts, pickup and synchronization; run real client/server contract and contention tests.
4. **Physical gate:** execute 60+ minute trial with all connectivity removed, real reboot/offline paid restart, multiple Windows accounts, OS reinstall, hardware changes/TPM loss and six clean installer configurations. No guarantees beyond observed machine/process evidence.
5. **Recovery gate:** same-ID signed ACTIVE recovery is implemented; cross-ID reissue and corrupt-state recovery need authenticated migration without silently erasing signed revocation.
6. **Release integrity:** clean fixture-only build does not prove production installer/content/AuthentiCode/signing/public-key configuration. Existing manifest/content trust and game-key extraction limitations remain.
7. No remaining failures in executed local suites. Full Phase 1 sign-off remains partial for the gates above. Stop for independent review; do not merge or deploy.

## H. Explicit safety confirmation

| Protected target | Modified? |
|---|---|
| Production/staging services | **No** |
| Main branch | **No** |
| DNS/shared VPS infrastructure | **No** |
| Live databases / PHP/MySQL service | **No** |
| Existing PHP licensing deployment/workflow | **No** |
| Production signing keys | **No** |
| Real payments/ZarinPal/MeliPayamak | **No** |

Only desktop/test/documentation/desktop-CI files on the feature branch were changed. No deployment workflow was dispatched. No production game payloads, credentials or signing keys were used for test scenarios. No merge/deployment approval is assumed.

### Header branding follow-up

At the user's request, GamesBookPage.xaml now embeds and displays Resources/YariZan_Symbol_Only_256x256.png, copied unchanged from the supplied 02_PNG_Transparent brand folder. YariZan.App.csproj includes this WPF resource. The main book header retains proportional scaling and displays only the symbol. Run-BookChecks.ps1 ran successfully after this change: 36 passed, 0 failed; its rendered preview was visually inspected.

