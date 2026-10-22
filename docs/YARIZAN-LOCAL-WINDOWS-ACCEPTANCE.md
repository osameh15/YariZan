# Packaged Windows launcher: local acceptance (Grade 1)

Scope: the real packaged launcher, published exactly like the installer (self-contained, single file, private Grade 1 bundle and game key), run against the local stack on this workstation. This is not a commercial build and must never be distributed.

## Build

```powershell
powershell -ExecutionPolicy Bypass -File tools\local\Build-LocalAcceptanceApp.ps1
```

The script does two things:

1. It exports the local API's **disposable development** signing root (public key only) into the git-ignored `secrets/v2-local-acceptance-roots.json`.
2. It publishes with `-p:LocalAcceptanceBuild=true` into `publish/YariZan-G1-local-acceptance/YariZan.exe`, which is also git-ignored.

Guards:

| Guard | Evidence |
|---|---|
| API and connect page are fixed at compile time to `http://127.0.0.1:3100/api/v2/` and `http://localhost:3200/connect`; no setting can redirect them | `DesktopV2Client.ApiBase`, `DeviceProvisioning.ConnectPage` under `YARIZAN_LOCAL_ACCEPTANCE` |
| The script fails unless the published binary carries the loopback API and not the production API | binary check in the script |
| `LocalAcceptanceBuild` with `CommercialRelease` is a build error | `ValidateLocalAcceptanceBuild`, `ValidateV2CommercialBuild` (verified: the build fails) |
| The installer always builds with `CommercialRelease=true`, so it can never contain this profile | `build-installer.bat` |
| Only the disposable development root is embedded; its kid contains `development`, which the commercial check forbids | `CommercialReleasePolicy` (`V2_TEST_ROOT_FORBIDDEN`) |
| Window title says `LOCAL ACCEPTANCE BUILD (not for distribution)` | `MainWindow` |
| Default and commercial builds are unchanged | `tests/Run-V2Checks.ps1`: 414 passed, 0 failed (2026-10-22) |

## Automated so far (2026-10-22)

| Check | Result |
|---|---|
| The packaged exe starts against the running local stack | yes; title shows the local acceptance marker |
| Cover, then the Lock page with the device username (`YZ-…` from the hardware fingerprint) | yes; `apps/web/.local/screenshots/acceptance-2026-10-22/desktop-wpf/` |
| Before pairing, the Lock page shows «اتصال امن این دستگاه هنوز آماده نیست …» (no local enrollment yet) | observed; see finding F1 |
| Cross-language verification of real Backend enrollment, license, trial and decision artifacts by the desktop verifier | Backend CI `tests/BackendInterop` (existing) |
| Trial count, offline continuation, revocation, recovery UI and layout at 800x600 and 150% | `tests/Run-V2Checks.ps1` (fixtures) |

### Finding F1: this hardware is already claimed in the local database

The device `YZ-6180-632E-8A44-26F5-5E61-A3DE` (this workstation's fingerprint) was claimed on 2026-10-15 by a synthetic customer from an earlier session. That customer also owns the sandbox test orders. The connect page therefore asks the **existing account owner** to approve a new Windows profile («این دستگاه حساب دارد …»), and nobody has that synthetic account's password. Choose one, in the local Admin only:

- **A (recommended):** Admin, then «مشتریان», find `YZ-6180-…`, then reset the customer. This revokes its licenses, marks its entitlements reset and starts a new device generation. The audit trail is kept. Then pair fresh with your own number (fake SMS, read the code with `docker exec yarizan-v2-local-api-1 node dist/src/accounts/read-fake-sms.js`).
- **B:** use Admin password reset for that customer, then sign in as it to approve the new profile.

## Owner checklist (physical steps)

Keep the local stack running. Record pass or fail for each step.

| # | Action | Expected |
|---|---|---|
| W1 | Run `publish\YariZan-G1-local-acceptance\YariZan.exe` | Cover appears, and the title shows the local acceptance marker |
| W2 | Click the cover | Lock page with your `YZ-…` username, «ورود آزمایشی», «فعال‌سازی نسخه» and «اتصال به حساب» |
| W3 | Resolve F1 (option A), then press «اتصال به حساب» | Pairing ID and temporary code appear; «باز کردن صفحهٔ اتصال» opens `http://localhost:3200/connect` |
| W4 | On the connect page enter the ID and code, then your mobile, then the fake SMS code | «اتصال در مرورگر تأیید شد»; the app picks up within seconds and shows «دستگاه با موفقیت متصل شد» |
| W5 | Close and restart the app | No new pairing is asked for. Device identity persists (CNG key `OARNOVA.YariZan.DeviceAuth.V2`, enrollment in `%LOCALAPPDATA%\OARNOVA\YariZan\V2`) |
| W6 | «ورود آزمایشی» (trial 1) | Info page, then the Game Book; a game launches and returns to the book |
| W7 | Close, restart, «ورود آزمایشی» (trial 2) | Allowed; this is the second admission |
| W8 | Close, restart, «ورود آزمایشی» (trial 3) | Refused with a Persian message; no game opens |
| W9 | During trial 2: stop the API (`docker compose stop api`), keep playing, return to the book, open another game | Play continues offline; the authorized session is not interrupted |
| W10 | Start the API. In local Admin, issue a Grade 1 license for this device («مجوزهای خرید»), or buy with the sandbox test price | The app's activation/recovery picks it up after «بررسی دوباره» or restart; Lock is skipped; Info, then the Game Book |
| W11 | Stop the API, restart the app | Licensed access still works offline (signed license verified locally) |
| W12 | In the Game Book, open a textbook page with several games | A chooser lists every game on that page; each launches and returns |
| W13 | With the API stopped, press «بررسی دوباره» on any online-only step | A Persian connection message; nothing crashes; it recovers once the API is back |
| W14 | Take screenshots of Cover, Lock, Info, Game Book and the multi-game chooser | Saved in `apps/web/.local/screenshots/acceptance-2026-10-22/desktop-wpf/` |

To repeat from a clean state on this workstation only: close the app, delete `%LOCALAPPDATA%\OARNOVA\YariZan\V2`, and reset the customer in local Admin. Deleting the CNG key is not needed and not recommended.
