# Final Lock screen UX and functional actions review

Date: 2026-10-14. Branch `feat/yarizan-v2-device-licensing`; [Draft PR #1](https://github.com/osameh15/YariZan/pull/1). Reviewed/fetched starting HEAD `0d3575ef41c3072e448028e781a9a14a54aa81f0`, matching local. Main remains `aef9bbc78d0a9a4357c3625f56b77ad037f672f7`. Final commit SHA and final-HEAD CI run are provided in the handoff/PR; this file cannot contain its own commit hash.

This supersedes the presentation/action findings in the [activation report](YARIZAN-ACTIVATION-UX-REPORT.md). Earlier screenshots/test counts remain historical evidence. Server and Admin functionality in the [lifecycle contract](YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md) remains Backend-dependent.

## Findings and final behavior

| Finding / requirement | Resolution | Status |
|---|---|---|
| Purchase click only changes text | Opens a themed assistance dialog with selected grade, prepared purchase request, phone copy and visible feedback | Fixed |
| Operational configured store | Reviewed embedded product map invokes validated HTTPS destination through default Windows browser shell; no website call in stock configuration | Implemented desktop; actual store deployment pending |
| Support click only focuses footer | Opens real support dialog; copies phone or selected-grade/public-username support message, with success/error feedback | Fixed |
| Duplicate support footer | Removed; support actions now live in dialog | Fixed |
| Expanding inline code panel shifts viewport | Replaced by overlay outside background scroll tree, no BringIntoView on open; background height/offset unchanged | Fixed |
| Visible scrollbars | Vertical Hidden on both scrollers; wheel/key/panning support retained, overflow remains scrollable | Fixed |
| Focus/background interaction | Focus code input, Tab cycle inside modal, Escape/close restores trigger, background disabled and handler-gated | Fixed, interaction tested |
| Small window/high-DPI layout | Dialog height capped to viewport, compact spacing, primary actions stack on narrow widths; internal scrolling handles overflow | Tested logical sizes + 192-DPI render; physical DPI/touch acceptance pending |
| Harsh white/blue manual input | Parchment/gold template, gold selection and focus border, LTR text/caret | Fixed |
| Licensing regressions | Core crypto/enrollment/storage/session implementations unchanged; all existing security/regression suites pass | Preserved |

## Purchase destination configuration

`release/v2-store-destinations.json` is public reviewed build configuration embedded in App, **not** a response from an endpoint, license, environment variable or editable per-user settings file. Current contents explicitly mark the store `operational: false` with no product pages. Stock Purchase is labeled **راهنمای خرید** and opens assistance; it never launches an assumed-live store.

Before enabling actual checkout navigation, independently verify the deployed Nuxt pages and review a configuration commit containing:

- `format: YARIZAN-STORE-DESTINATIONS-V1`;
- `operational: true` and a nonempty `review_reference` identifying that availability/configuration review;
- `product_pages` keyed by exact `YARIZAN-G1` through `YARIZAN-G6` SKU as applicable, mapping each configured grade to `https://yarizan.oarnova.games/products/yarizan-gN`.

Unconfigured grades retain assistance. This is a proposed **Nuxt page** route, not `/api/v2` and not evidence of deployment. A different future host/route requires an explicit allowlist/contract/test review. Validation rejects non-HTTPS, foreign hosts, non-default ports, credentials, query/fragment data, wrong grade and unrecognized products. Only reviewed static destination is passed to `Process.Start` with `UseShellExecute=true`; device identifiers/codes/tokens are never placed in a URL. The OS boundary validates again. Browser launch failure opens the assistance dialog with visible feedback.

`review_reference` records human review; it is not cryptographic proof of service availability. No startup probe or automatic browser launch is introduced. Actual browser opening of the future website was **not executed**: G1-G6 interaction tests inject a recording browser to verify exact destinations without visiting an unavailable service. A real unsafe-scheme test verifies OS-boundary refusal before Process.Start.

## Modal, copy and asynchronous behavior

Manual code, purchase and support share one parchment/gold overlay within the Lock page. Background controls are disabled, and background trial/activation handlers refuse interaction while it is open. Focus starts on the code input (even while trial status is pending), or on phone copy for assistance. WPF cyclic Tab/Control-Tab scope confines navigation; Escape and the close button dismiss and restore the triggering button. Code text clears on dismissal/unload. Background offset is restored after focus restoration. Closing a pending manual redemption cancels its linked request; a delayed response cannot grant access after cancellation. Closing support does not cancel unrelated automatic pickup.

Both scroll viewers use `VerticalScrollBarVisibility=Hidden`, not Disabled. Routed wheel handling forwards scrolling over the code field to the modal, never the background. PageUp/PageDown work inside either viewer; arrows/Home/End preserve TextBox editing behavior. Native vertical-only touch panning is configured. Maximum dialog height follows viewport size; long errors scroll internally. Below 520 logical pixels primary actions stack; short viewports use compact modal padding. Empty feedback collapses so it does not reserve duplicate blank rows. Close stays outside the scrolling body.

Async status rendering is deferred while a dialog is open, preventing background layout changes during loading. Manual progress/errors appear inside the modal rather than changing background height. Success closes it and exposes explicit offline entry. The Lock-only status timer still stops on unload and does not run trial authorization or heartbeat during active gameplay.

Copy uses `ILockDesktopActions`, enabling deterministic clipboard-success/failure tests and a real Windows implementation. The prepared message includes only the selected Persian grade and **public username**, never raw hardware signals, enrollment UUIDs, credentials, keys or activation input. Presentation isolates the public LTR username within Persian RTL text; clipboard content is plain text. Actual Windows SetText/GetText round-trips passed locally for phone/message; previous clipboard data was restored without logging its contents. Clipboard failure remains visible inside the open dialog.

Reference behavior: [WPF Hidden scrollbar semantics](https://learn.microsoft.com/dotnet/api/system.windows.controls.scrollbarvisibility), [focus scopes/cyclic navigation](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/focus-overview), [vertical panning](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.scrollviewer.panningmode).

## Changed files

| File | Change |
|---|---|
| `src/YariZan.App/Views/LockPage.xaml` | Main hierarchy, hidden scrollers, warm input, shared modal, responsive primary actions, removed duplicate footer |
| `src/YariZan.App/Views/LockPage.xaml.cs` | Functional purchase/support, clipboard feedback, focus/keyboard/wheel/close, viewport preservation, deferred status and request cancellation |
| `src/YariZan.App/Services/LockDesktopActions.cs` | Testable OS actions, strict store configuration and HTTPS/product validation |
| `src/YariZan.App/YariZan.App.csproj` | Embed reviewed public store configuration |
| `release/v2-store-destinations.json` | Explicit non-operational default; no assumed-live URL |
| `tests/V2Checks/LockDialogChecks.cs` | Interaction/focus/scroll/copy/browser/size/DPI/pending-operation checks and captures |
| `tests/V2Checks/ActivationChecks.cs` | Replace inline-specific expectations with modal expectations; retain real redemption flow |
| `tests/V2Checks/Fixtures.cs` | Injectable delayed trial-status fixture for asynchronous modal regression |
| `docs/Images/phase1-lock-final-normal.png` | Normal Lock with mock identity |
| `docs/Images/phase1-lock-final-purchase.png` | Actionable purchase assistance |
| `docs/Images/phase1-lock-final-support.png` | Support dialog and copy feedback |
| `docs/Images/phase1-lock-final-manual-code.png` | Warm input with public test-only code |
| `docs/Images/phase1-lock-final-small.png` | 480x360 modal, feedback/actions reachable, no visible scrollbar |
| `docs/Images/phase1-lock-final-small-192dpi.png` | 192-DPI offscreen capture at 960x720 pixels |
| `docs/YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md` | Current modal and purchase-assistance UX description |
| `docs/YARIZAN-ACTIVATION-UX-REPORT.md` | Current report pointer; older evidence retained |
| `docs/YARIZAN-PHASE-1-REPORT.md` | Current report pointer |
| `docs/YARIZAN-FINAL-LOCK-UX-REPORT.md` | This report and verified evidence |

No Core licensing implementation, MainWindow/game launch, global theme, encryption/packaging or live PHP source changed. No production trust roots or credentials were introduced. New actions cannot unlock access; signed enrollment/license/revocation checks remain authoritative.

## Exact local validation

Windows `10.0.26300.0` x64, Windows PowerShell, .NET SDK `10.0.401`, runtime `9.0.20`, Node `24.20.0`. Process-only proxy variables were cleared for restores; machine/network settings were not changed.

| Command | Final result |
|---|---|
| `dotnet build src/YariZan.sln -c Release -p:IncludeGameBundle=false -p:IncludeGameKey=false --nologo` | Five projects; 0 warnings/errors |
| `.\tests\Run-V2Checks.ps1` | **289 passed, 0 failed** |
| `.\tests\Run-AccessChecks.ps1` | **27 passed, 0 failed** |
| `.\tests\Run-LauncherChecks.ps1` | **8 passed, 0 failed** |
| `.\tests\Run-GradeChecks.ps1` | **5 groups passed, 0 failed**; expected negative selections return nonzero |
| `.\tests\Run-BookChecks.ps1` | **36 passed, 0 failed** |
| `npx --yes @redocly/cli@2.63.0 lint docs/YARIZAN-OPENAPI-V2.yaml` | Passed, no errors/warnings |
| `py tools/Check-PublicRepository.py` | Passed with source/screenshots staged |
| `git diff --check` / staged variant | Passed |

Total **365 passed, 0 failed**. V2 now includes net 72 more checks than the reviewed 217-check suite; inline-only layout expectations were legitimately replaced. Two of the 289 are actual OS clipboard checks, executed successfully in this local run; a clipboard-unavailable runner explicitly records nonexecution rather than claiming success. Injected success/failure interaction checks run independently.

Verified: selected-grade browser action for G1-G6 under test-only configuration, no browser by default, invalid URLs, support/purchase copy payloads and feedback, actual keyboard focus, six Tab traversals and final-to-first cycling, Escape focus restoration/code clearing, background trial denial, editable code, exact background offset/extent before/after, hidden overflow wheel/PageDown, focused redemption visibility, delayed status/pickup, cancel pending redemption, 640x480/480x360/320x240 logical bounds and 192-DPI render. Screenshot PNGs were visually inspected. Touch panning configuration is tested, **not physical touch hardware**. Keyboard tests use actual WPF focus/traversal plus routed key events, not physical key presses.

All prior device/enrollment/signature/revocation/recovery/trial/perpetual-offline and encrypted synthetic game/navigation/shutdown checks pass, including disposable .NET/Node signature interoperability. No real games, production keys or credentials used. Intermediate missing-IO import and initial wheel fixture without enough overflow were corrected before final successful runs; capped height and long feedback now exercise internal scrolling meaningfully.

Actual local token: `TokenElevation.TokenIsElevated=0; AdministratorsGroupEnabled=False`. TPM-preferred selected **TPM**; forced software checks also pass. GitHub Actions must be reported from its own log; an elevated/software runner is not non-admin/TPM evidence. Final verified CI result/URL/counts/token are recorded in the handoff/PR after completion, not inferred from local results.

## Backend dependencies, limitations and safety

- Store operation and real Nuxt product destinations are pending deployment/explicit configuration; stock build does not visit them. This mission does not implement checkout or payment processing.
- Enrollment, manual code issuance/redemption transactions, PostgreSQL trial quotas, Admin reset/block/unblock/reissue, cross-ID atomic replacement and approved retention processing remain Backend-dependent. Commercial release gate and empty production root approvals remain intact.
- Physical high-DPI monitor changes, touch/touchpad, assistive reader/manual keyboard acceptance are pending; 192-DPI rendering is not a physical monitor test. Physical 60+ minute disconnected endurance, reboot, second Windows account, TPM loss and clean commercial installers remain pending.
- No production/staging services, main merge, DNS, live databases/PHP deployment, production signing keys, payment/SMS infrastructure or refunds were changed. No merge/deploy. Public support information only is copied; code/key secrets never go into browser URLs or logs.

Keep Draft PR #1 for independent review. This is a completed desktop UX fix with documented server/physical acceptance boundaries, not a production licensing platform release.
