# YariZan V2 activation UX, manual codes and account lifecycle report

Date: 2026-10-14. Branch: `feat/yarizan-v2-device-licensing`. Review-only [Draft PR #1](https://github.com/osameh15/YariZan/pull/1); no merge or deployment.

This is the current mission report. The [Phase 1 report](YARIZAN-PHASE-1-REPORT.md) retains earlier implementation/review evidence. Production activation and Admin lifecycle operations remain **Blocked by Backend**; the commercial-release gate stays closed.

## A. Repository and scope

- Inspected/fetched branch HEAD before edits: `c7a655998f3b3bc7246e12a68f8dfca7d51e4fcf`; remote matched local. Main base remains `aef9bbc78d0a9a4357c3625f56b77ad037f672f7`.
- Commits: `cacfb31` source/tests/screenshots; `f9d4b0d` API/database/security contracts; `f2da303` mission report; followed by this CI evidence update. Final SHA is recorded in the handoff because the report cannot contain its own commit hash.
- Prior independent signed enrollment/device UUID binding, profile key isolation, release-root gates and independent book CI remain intact. No unsafe ACLs, development trust roots or legacy PHP fallback were added.
- Untracked user-supplied brand PNG size folder/ICO remain untouched. Selected symbol-only app resource from the prior commit is reused on Lock.

## B. Implementation and UX

The Lock page is responsive parchment/gold RTL content with a dynamic grade heading, selectable LTR public username and accessible Copy button. Primary actions are ورود آزمایشی and فعال‌سازی نسخه; remaining entries appear separately in Persian digits. The manual-code form expands with a labeled LTR field, validation feedback and ثبت کد و فعال‌سازی. Support is a compact footer. Secondary purchase currently provides grade-specific support guidance: a future checkout route is not assumed deployed.

Status availability is neutral; transport/blocked/invalid-artifact failures are styled as errors. Trial exhaustion is informative. Backend codes map to Persian messages without technical exception text. Revoked license is distinguished from an online product restriction. Successful activation displays نسخه شما فعال شد. از این پس می‌توانید بدون اینترنت بازی کنید. and offers explicit ورود به بازی, avoiding a confirmation that disappears immediately during navigation.

Manual codes normalize a proposed `YZ2-` plus eight groups of four Crockford-base32 symbols. They are online credentials, not local serials. Client validation rejects malformed/legacy/lookalike input without a request. The future issuer must generate 160 random bits and store only a secure keyed verifier. No production code generator or backend issuer was implemented.

`IActivationCodeClient` and `ActivationCodeRequest` extend the enrolled V2 client with `POST /desktop/activation-codes/redeem`. The body has activation_code/device_id/sku/request_id. Device UUID must match credentials; cancellation, existing deadlines and payload bounds apply. Request diagnostics redact the secret. UI clears input on success/unload; request retry data is memory-only. No request body is logged by this code.

Controller serializes operations and retains a random request UUID for the same normalized code after a lost response. Tests use a transaction-locked fake: one consumption, exact original response on retry, changed-request conflict, distinct concurrent requests cannot spend twice. The authoritative mechanism belongs in PostgreSQL. Complete process restart discards retry state; use authenticated pickup for a previously committed redemption, not a persisted code/grant.

Automatic pickup and manual redemption share signature/enrollment/product/device verification and protected storage, including all retained decision checks. An invalid HTTP response never grants access. A cached REVOKED decision cannot be cleared by a code; new license IDs cannot bypass the prior decision. Existing same-ID explicit higher signed ACTIVE recovery continues to work. Different-ID replacement remains fail-closed pending its verifier and atomic lifecycle snapshot.

Current-process trials retain access throughout pending/failed optional redemption and after network loss. Purchased local access still needs no online credential or sync. Signed decisions affect next launch; transient HTTP failures cannot revoke a valid license. No heartbeat, time lease or per-game authorization was added. Lock-only connectivity retry stops when unloaded and pauses while the manual form is open.

## C. Contracts and independent Admin lifecycle

The [activation/lifecycle design](YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md) defines code issuance/redemption/cancellation, generation-aware reset, durable SKU restrictions, unblock, reissue, immutable finance/audit retention and signed replacement. Technical spec, API contracts, OpenAPI, data model, threat model and ADR-0004 reference/extend this design.

- **Reset:** privileged transaction invalidates operational sessions/passwords/credentials/entitlements/licenses and changes trial generation, allowing subsequent legitimate new-customer enrollment. Public username/device anchor remain; durable restrictions, old revocation evidence and financial/audit history remain. No automatic refund and no instant offline erase.
- **SKU block:** device/product restriction survives profile/customer reset. Deny new starts/purchases/redemption, sign old-license revocations. Other grades stay independent; no new global ban.
- **Unblock:** explicit authorized mutation with actor/reason/time/revision. Does not recreate ownership, reset trials or rewrite payments.
- **Reissue:** independent ownership verification, no restrictions, same customer/device/product; preserve trials and finance. Same-ID higher decision recovery exists; cross-ID signed replacement is proposed and blocked in desktop until atomic snapshot/watermark support.
- **Reset propagation:** a former key needs reviewed tombstone-only challenge permissions after ordinary credentials are revoked. It cannot access the new account. This integration is blocked; HTTP denial alone does not revoke offline state.

No Admin screens, authorization implementation, database migrations, rate limiter, production redemption transaction, financial retention job or live API were implemented by these documents. Exact legally approved retention durations remain pending before production.

## D. Changed files

| File | Purpose |
|---|---|
| `src/YariZan.Core/V2/ActivationCode.cs` | Code profile/validation, redacted request and client interface |
| `src/YariZan.Core/V2/DesktopV2Client.cs` | Authenticated redemption route and request binding |
| `src/YariZan.Core/V2/DesktopAccessController.cs` | Serialized/idempotent manual flow, shared verified persistence, grade property, online product-block state |
| `src/YariZan.App/Views/LockPage.xaml` | Responsive Persian RTL activation layout and manual form |
| `src/YariZan.App/Views/LockPage.xaml.cs` | Dynamic labels, structured feedback, validation, success/entry and support actions |
| `tests/V2Checks/ActivationChecks.cs` | New crypto/transport/idempotency/denial/UX/layout checks |
| `tests/V2Checks/Fixtures.cs` | Test-only one-time transaction, blocks/errors/lost-response/pending transport |
| `tests/V2Checks/Program.cs` | Runs new checks, HTTP DTO handling, selectable username and sized screenshot rendering |
| `docs/Images/phase1-lock-activation-v2.png` | Updated collapsed Lock screenshot with mocked identity |
| `docs/Images/phase1-lock-manual-code-v2.png` | Expanded form and invalid test input screenshot |
| `docs/Images/phase1-lock-manual-small-v2.png` | 480x360 scrollable manual-form capture |
| `docs/YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md` | Complete future security/API/DB/state/retention design |
| `docs/YARIZAN-TECHNICAL-SPEC-V2.md` | Product extension and scope/status |
| `docs/YARIZAN-API-CONTRACTS-V2.md` | New route/authorization/result table |
| `docs/YARIZAN-OPENAPI-V2.yaml` | Typed redemption/Admin/reset/block/unblock/reissue/recovery design; version 0.3.0 |
| `docs/YARIZAN-DATA-MODEL-V2.md` | Verifiers/redemptions/restrictions/reset/replacement and generation-aware uniqueness |
| `docs/YARIZAN-THREAT-MODEL-V2.md` | Secret leakage, races, ban escape, Admin abuse and stale-recovery threats |
| `docs/adr/0004-phase-1-desktop-artifact-profile.md` | Manual credential boundary and deferred cross-ID recovery |
| `docs/YARIZAN-PHASE-1-REPORT.md` | Pointer to current mission report |
| `docs/YARIZAN-ACTIVATION-UX-REPORT.md` | This handoff and requirement matrix |

`MainWindow.xaml.cs`, theme, packaging, encrypted launcher, public-root configuration and live PHP code were inspected/preserved; no unrelated source refactor. New code format and lifecycle schema are explicit future contract additions; existing signed perpetual artifact is unchanged. Historical customer uniqueness/counter keys are superseded for privileged reset generations, not ordinary enrollment.

## E. Exact validation

Local Windows `10.0.26300.0` x64; Windows PowerShell, .NET SDK `10.0.401`, runtime `9.0.20`, Node `24.20.0`. Proxy variables were cleared for the individual build/test process only.

| Command executed after fixes | Result |
|---|---|
| `dotnet build src/YariZan.sln -c Release -p:IncludeGameBundle=false -p:IncludeGameKey=false --nologo` | Five projects, 0 warnings/errors |
| `.\tests\Run-V2Checks.ps1` | **217 passed, 0 failed**, including 65 new activation/UX checks |
| `.\tests\Run-AccessChecks.ps1` | **27 passed, 0 failed** (isolated legacy utilities, not active authorization) |
| `.\tests\Run-LauncherChecks.ps1` | **8 passed, 0 failed** |
| `.\tests\Run-GradeChecks.ps1` | **5 groups passed, 0 failed**; expected invalid-selection nonzero exits |
| `.\tests\Run-BookChecks.ps1` | **36 passed, 0 failed** |
| `npx --yes @redocly/cli@2.63.0 lint docs/YARIZAN-OPENAPI-V2.yaml` | Passed, no errors/warnings |
| `py tools/Check-PublicRepository.py` | Passed with new source/screenshots staged |
| `git diff --check` / staged variant | Passed |

Total: **293 assertions/groups passed, 0 failed**. V2 disposable .NET/Node signature checks passed; WPF encrypted synthetic game launches/navigation/shutdown and retained enrollment/release/revocation checks also passed. No real games, credentials or production keys were used.

Local token evidence: `TokenElevation.TokenIsElevated=0; AdministratorsGroupEnabled=False`. TPM-preferred selected **TPM**; separate forced-software persistence/export-refusal tests passed. Physical TPM loss is not simulated key-loss detection. Hosted GitHub runner token/provider must be read from its own log; earlier hosted elevated/software execution is not non-admin/physical-TPM evidence.

Intermediate issues: an initial small-window assertion used LTR coordinates for an RTL transform and failed; corrected to transformed bounds and rerun successfully. A redirected Windows PowerShell batch stopped on the grade suite's intentional native stderr/nonzero negative case; the exact unredirected Grade command subsequently passed all five groups. These intermediate harness failures are not counted as successful runs.

GitHub CI **passed** at `f2da3030ede8b0d1bf882e47c1978de05822d8fc`: [run 38624429636](https://github.com/osameh15/YariZan/actions/runs/38624429636), job `116059861864`. The workflow independently executed all five commands above: **217 V2 + 27 access + 8 launcher + 5 packaging groups + 36 book = 293 passed, 0 failed**; release build had zero warnings/errors, public scanner/OpenAPI lint/binary smoke check passed. Hosted OS `10.0.26100.0`, runtime `9.0.21`, .NET 9 workflow. Actual hosted evidence: `TokenElevation.TokenIsElevated=1; AdministratorsGroupEnabled=True`, TPM-preferred selected **SOFTWARE**. This is not non-admin or physical-TPM evidence. The subsequent documentation-only CI evidence commit's exact final SHA/run are supplied in the final handoff/PR. New screenshots were visually inspected locally. Simulated HTTP disconnect, instantaneous modeled elapsed time and same-user profile fixtures do not equal physical acceptance.

## F. Requirement matrix

| Requirement | Status / evidence |
|---|---|
| Latest branch inspected; previous review fixes preserved | Implemented; fetched matching c7a6559, retained tests pass |
| Signed offline license separate from manual code | Implemented; common verifier/store and trusted enrollment |
| Dynamic selected-grade Persian title/intro/user identifier | Implemented; G1-G6 labels and RTL/LTR checks |
| Accessible copy and mixed-content fields | Implemented foundation; automation labels/selectable identity, screen-reader/manual keyboard acceptance pending |
| Primary labels, separate trial count, secondary manual/support | Implemented; UI assertions and screenshots |
| Purchase this grade | Partially Implemented; grade-specific support guidance, future checkout Backend-dependent |
| Expandable input/confirmation/client validation | Implemented; invalid format has zero requests |
| Compact support and neutral normal status | Implemented; visual inspection/status assertions |
| Network, invalid-code, blocked and success feedback | Implemented; mocked UI denial/disconnect/success tests |
| Smaller windows without horizontal clipping | Implemented/tested at 640x480 and 480x360 with vertical scroll; DPI/screen-reader/manual device acceptance pending |
| Authenticated redemption/device/SKU/request ID | Implemented client contract; production credentials/enrollment Blocked by Backend |
| High-entropy issuance, verifier-only storage, expiry/cancel | Implemented design; execution Blocked by Backend |
| Atomic one-time redemption, rate limit, audit, restrictions | Implemented design/test transport; authoritative execution Blocked by Backend |
| Duplicate/lost-response and concurrent request behavior | Implemented client and deterministic fake tests; real PostgreSQL transactions Blocked by Backend |
| Existing signed license response verified; invalid/cross-grade rejected | Implemented; tests include foreign enrolled UUID and invalid signature |
| Customer reset/session/password/entitlement/license/trial invalidation | Contract documented; operation Blocked by Backend |
| Stable username, no automatic refund, retained financial/audit evidence | Contract documented; operation/retention implementation Blocked by Backend |
| Signed reset/revocation delivered at future authenticated sync | Existing decision verifier implemented; former-key tombstone protocol Blocked by Backend; offline immediacy impossible |
| Durable product restriction across reset/re-enrollment | Contract documented; operation/mappings Blocked by Backend; spoofing limitations documented |
| Separate unblock without ownership/history resurrection | Contract documented; operation Blocked by Backend |
| Ownership-verified reissue preserving trials/finance/account | Contract documented; Admin operation Blocked by Backend |
| Safe signed recovery/replacement; stale artifacts rejected | Same-ID recovery and retained-decision rejection Implemented; cross-ID replacement Partially Implemented design, desktop verifier/snapshot and backend Blocked |
| Updated spec/API/OpenAPI/DB/security/ADR and screenshots | Implemented |
| Trial online-to-start only; no heartbeat/time/per-game check | Implemented, regression tests pass |
| Perpetual purchased offline and nonblocking sync | Implemented, regression tests pass |
| Local/CI commands/results and requirement report | Implemented; both 293/0, exact verified CI run above and final handoff |
| Production merge/deploy forbidden | Preserved; none performed |

## G. Remaining risks and next steps

Production API/enrollment, code issuance/redemption transactions, Admin RBAC/MFA/CSRF, PostgreSQL migrations, rate limiting/audit redaction, retained ban/recovery mappings and retention processing are not implemented. Review cross-ID replacement format/domain/hash rules and atomic local snapshot before writing its verifier. Retain current fail-closed commercial-release gate and no-HWID registration policy.

UX tradeoffs: support-mediated purchase until portal integration; manual form requires online enrollment; success needs one explicit local entry click; process-only retries cannot transparently recover request IDs after crash/restart, so pickup is the recovery route. Managed code strings cannot promise memory erasure. Default automation label tests are not screen-reader certification.

Pending physical acceptance: 60+ minute actual all-network-disconnected play, reboot, real second Windows account, real TPM loss, clean commercial installers, high-DPI/manual keyboard/screen-reader checks, live secure enrollment/redemption and PostgreSQL concurrency/reset races. Do not claim these passed. Perpetual offline deletion/revocation is inherently delayed; hostile administrator/binary modification, hardware spoofing, VM cloning and local state rollback remain disclosed risks.

## H. Safety confirmation

No main merge, staging/production deployment, live PHP/MySQL changes, DNS change, payment/refund/SMS infrastructure change, production signing-key generation or private-key embedding. All server operations are proposed contracts, not deployment or Admin execution. Stop for independent review on Draft PR #1.
