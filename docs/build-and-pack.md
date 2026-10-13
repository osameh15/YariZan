# Setup, build, pack, and distribute

## Prerequisites

Use Windows, PowerShell, and a .NET SDK that targets `net9.0-windows` (CI uses .NET 9). Check `dotnet --info`. Inno Setup 6 or 7 is required for setup generation. Python 3 runs repository/deployment tools; use `py` if `python` opens the Windows Store. NuGet connectivity is needed for initial restore and runtime packs.

Run commands from the repository root:

```powershell
dotnet restore src/YariZan.sln
```

Public checkouts contain no game payloads, master key, private signing key, or hosting credentials. A build without embedded keys is not a usable release.

## Keys

Restore this project's original complete key set from a secure backup:

| File | Purpose |
|---|---|
| `secrets/private.pem` | P-256 signing key; local/private server only |
| `secrets/public.pem` | Matching app verification key |
| `secrets/master.key` | Exactly 32 bytes; packer/app game key |

The public key is tracked and is not secret. Initialization refuses if any of these files exists, so a clone's public key also prevents generating missing private keys. Obtain the matching originals; do not delete existing keys to bypass initialization.

Only for a separate, completely new key set, start with an empty `secrets/` directory:

```powershell
dotnet run --project src/YariZan.SerialGen -- init
```

Back up all three securely. Changing the signing pair invalidates serials/grants. Changing the master key requires repacking every game and rebuilding. The hosting key must match the embedded public key. Never commit private/master keys or include them in public artifacts.

## Add and pack games

Place games directly in grade folders `1` through `6`:

```text
miniApps/1/صفحه سوم کتاب ریاضی.exe
miniApps/1/صفحه سوم کتاب ریاضی.jpg
miniApps/1/صفحه سوم کتاب ریاضی.txt
```

Use matching stems, PNG/JPG thumbnails, and UTF-8 descriptions. Images/descriptions are optional in the packer but provide complete tiles. Extract archives locally; nested directories and archives are not packed. Names sort naturally: `page3`, `page4`, `page115`.

```powershell
dotnet run --project src/YariZan.Packer
```

Packing replaces generated files while preserving README. It writes `manifest.json`, AES-GCM blobs and copied thumbnails under grade folders. Generated names include SHA-256 hashes of game names. Rebuild/publish after catalog changes; payloads remain ignored by Git.

## Grade detection and package names

One distribution contains one grade. The packer and installer automatically detect the only `miniApps/1` through `miniApps/6` folder containing direct `.exe` files. Empty folders are ignored. With games only in `miniApps/2/`, the manifest selects grade 2, the book header shows second grade, and setup is named `YariZan G2`.

If several folders contain games, choose explicitly:

```powershell
dotnet run --project src/YariZan.Packer -- --grade 2
.\build-installer.bat --noninteractive --grade 2
```

Without a unique grade, packing stops before changing existing output. An explicit grade with no games also stops. `--skip-pack` validates the selected grade against the manifest. Installers and output directories use `YariZan-G<grade>` names. If the standard grade publish folder already exists, the installer builder uses a fresh folder with a build suffix and prints its location. Existing builds are preserved, including when an older EXE is still running. The installer takes its files from the newly published folder.

Builds share the existing HWID licensing service and local activation state. Grade packaging does not create separate grade entitlements or trial counters. The current detailed About content describes first-grade mathematics; supply appropriate content when adding other grades.

## Build and run

```powershell
dotnet build src/YariZan.sln -c Release
dotnet run --project src/YariZan.App
```

The cover loads first. Opening it requires `https://yarizan.osameh.dev/api/trial.php`. Customer serials and trial resets come from the panel. `SerialGen sign` produces a local signature but does not register it as the database current serial.

`dotnet run --project src/YariZan.SerialGen -- hwid` prints this PC's fingerprint. `reset` clears only local saved activation, not server blocks/trials. `reset-trial` is a legacy utility and does not reset the current app's trial access.

## Publish a portable EXE

After packing:

```powershell
dotnet publish src/YariZan.App/YariZan.App.csproj `
  -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:PublishReadyToRun=false `
  -p:DebugType=none -p:DebugSymbols=false `
  -o publish/YariZan-G1-win-x64
```

Rename the single-file EXE to `YariZan-G1.exe` (replace 1 with the detected grade). Ship the complete folder. The self-contained EXE includes .NET dependencies; external `games_encrypted/` is required beside it. For removed/renamed games, use a fresh publish directory so old files are not retained.

```powershell
Compress-Archive -Path publish/YariZan-G1-win-x64/* -DestinationPath publish/YariZan-G1-win-x64.zip -Force
```

No obfuscator is configured/validated. Do not enable trimming without separately validating WPF/XAML behavior.

## Create an installation EXE

Install Inno Setup 6 or 7:

```powershell
.\build-installer.bat --noninteractive
```

The script repacks games, uses the brand kit multi-size ICO, preserves an existing `icon.ico` when the kit is absent, or generates one from PNG if no ICO exists, generates a Persian RTL About page from hardcoded app `AboutText`, cleans the build, publishes self-contained x64, then compiles `YariZan-Setup.iss`.

| Option | Behavior |
|---|---|
| No options | Full build, checksum prompt and pauses |
| `--noninteractive` | Full build without prompts/pauses |
| `--skip-pack` | Reuse manifest only if catalog/key are unchanged |

Standard Program Files and per-user Inno 6/7 locations are detected. Custom path:

```powershell
$env:INNO_PATH = 'C:\Your Inno Directory\ISCC.exe'
.\build-installer.bat --noninteractive
```

Output: `publish/YariZan-G1-Setup-v1.1.0.exe`. It includes the app/games, bilingual EULA, and RTL About page. Setup and EULA contacts include `osameh.dev` and `support@osameh.dev`. Uninstall preserves saved activation; MySQL trials/blocks are unaffected.

For EULA/setup-text-only changes, reuse a verified current published app:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Write-InstallerAbout.ps1
& 'C:\Program Files\Inno Setup 7\ISCC.exe' /DGrade=1 'YariZan-Setup.iss'
```

Adjust the compiler path. App/key/game changes require republishing first. Version releases consistently: update ISS `MyAppVersion`, app `Version`/`FileVersion`, EULA version and displayed version text. Keep each grade's installer AppId stable for upgrade identity. Grade installers have separate installation directories and shortcuts; the old combined installer has a different identity.

## Checks before distribution

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/Run-AccessChecks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/Run-LauncherChecks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/Run-GradeChecks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/Run-BookChecks.ps1
py tools/Check-PublicRepository.py
Get-FileHash publish/YariZan-G1-Setup-v1.1.0.exe -Algorithm SHA256
```

Use [panel checks](../web/licensing/README.md#tests-and-local-preview) for backend changes. Test on a disposable Windows PC: install/uninstall, icon, cover-first start, two trials, activation, outage/retry, serial replacement/removal, game order/launch, RTL About and keyboard dismissal. Compiling setup does not test installation.

## Troubleshooting

- Missing keys: restore matching originals; do not regenerate production keys.
- NuGet failures: verify network/proxy. An offline build needs a prepared feed containing all resolved packages via process environment `$env:RestoreSources`. Use `$env:NuGetAudit = 'false'` only for an intentionally offline build where audit cannot connect. Machine-specific feed paths are not committed.
- No games: verify manifest/payloads beside EXE and direct grade-folder source files.
- Connection errors: verify HTTPS/API/CDN rules; access intentionally needs online authorization.
- Default icon: regenerate ICO and republish/recompile; Explorer may retain an icon cache.
- Large setup: it includes .NET and all games in the selected grade. Inspect game sizes before removing required files.

## Cleanup and backups

Keep latest setup, complete portable output/games, source games/code, and secure key/configuration backups. Generated .NET `bin/`/`obj/`, Python bytecode, old previews/test files, obsolete ZIPs, and `publish/installer-about.rtf` are disposable after consumers finish. Never delete `web/licensing/bin/`: it contains source scripts.

Private setup ZIPs contain credentials/keys; remove after manual upload and retain secure backups. Recreate bundles using [the hosting guide](../web/licensing/README.md). Public deployment does not update private code/configuration.

Book checks use a local JPG from `miniApps/1/` and render `publish/book-preview.png`. They exercise mixed-grade filtering, numeral input, navigation boundaries, image decoding/cache reuse and rapid clicks. Grade checks use synthetic games and a disposable key, never production state.

The current grade-1 math-book bundle uses Persian filenames such as `صفحه سوم کتاب ریاضی`. This is catalog naming only: YariZan remains a general educational launcher. Persian page titles retain numeric textbook-page ordering; matching EXE/image/description stems are required.
