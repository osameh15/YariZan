<div align="center">
<img src="src/YariZan.App/Resources/icon.png" alt="YariZan" width="160" />

# YariZan — یاریزان

Persian RTL educational mini-game launcher for Windows, with a book interface, encrypted game bundles, and a PHP/MySQL licensing panel.
</div>

## Current access policy

The cover appears first on every launch. Opening the book requires internet: the app validates the saved paid serial or shows the activation/trial screen. New devices register their HWID and PC name with two trial entries; viewing status does not consume an entry. Only pressing the trial entry button consumes one.

Paid and trial sessions check access before each game launch and every 60 seconds. Connection failures return to Lock and stop games launched by the app. Reconnecting and pressing Retry automatically validates a saved paid serial; users do not enter it again after an ordinary outage. Removing a device blocks it; regenerating its serial invalidates the old serial. Trial counts are stored in MySQL and reset from the panel.

## Start here

Run commands from the repository root in Windows PowerShell. Use a .NET SDK that builds `net9.0-windows`; workflows use .NET 9. Install Inno Setup 6 or 7 for installer builds. PHP 8.2+ and MySQL/InnoDB run the licensing service.

1. Restore the existing `secrets/private.pem`, `secrets/public.pem`, and `secrets/master.key` from your secure backup. For a completely new product key set, follow [key setup](docs/build-and-pack.md#keys).
2. Add local games following [miniApps/README.md](miniApps/README.md). The public repository contains no game payloads or private configuration.
3. Set up licensing using [the hosting guide](web/licensing/README.md). Compilation can succeed without the service; protected access cannot.
4. Pack, build, and run:

```powershell
dotnet restore src/YariZan.sln
dotnet run --project src/YariZan.Packer
dotnet build src/YariZan.sln -c Release
dotnet run --project src/YariZan.App
```

Create the setup executable:

```powershell
.\build-installer.bat --noninteractive
```

| Output | Use |
|---|---|
| `publish/YariZan-win-x64/YariZan.exe` | Self-contained launcher; keep adjacent `games_encrypted/` |
| `publish/YariZan-Setup-v1.0.0.exe` | Installer containing launcher and games |
| `publish/installer-about.rtf` | Generated build input; disposable after compilation |

See [build-and-pack.md](docs/build-and-pack.md) for portable publishing, installer options, troubleshooting, and release checks. Never distribute source games, keys, private hosting ZIPs, or credentials with a release.

## Operator workflow

Log in to `https://yarizan.osameh.dev/` using private admin credentials. Search by name, description, HWID, or serial; use Add with HWID if needed. Edit name/description and generate the serial once. Copy it to the customer. Metadata edits retain it. Regenerate issues a replacement, Reset trial restores two entries, and Remove blocks the HWID. Styled confirmation dialogs protect these actions.

The current serial can reactivate after an OS reinstall only if the HWID matches. Hardware/WMI changes can alter it. Uninstall retains saved activation and never resets server trials.

## Repository map

| Path | Responsibility |
|---|---|
| `src/YariZan.App/` | WPF views, online client, branding/fonts |
| `src/YariZan.Core/` | HWID, crypto, activation/session state, games and sorting |
| `src/YariZan.Packer/` | Encrypts local games and writes manifest |
| `src/YariZan.SerialGen/` | Key setup/diagnostics; customer serials come from panel |
| `web/licensing/` | Public panel/API and private implementation/schema |
| `miniApps/` | Ignored local games directly in grade folders `1`–`6` |
| `games_encrypted/` | Ignored generated catalog; README tracked |
| `secrets/` | Keys; private/master keys ignored |
| `tools/`, `tests/` | Packaging/deployment and isolated checks |
| `publish/` | Ignored app, installer, upload bundles |

## Documentation

| Guide | Contents |
|---|---|
| [Build and pack](docs/build-and-pack.md) | Setup, keys, games, portable EXE, installer, cleanup |
| [Hosting and panel](web/licensing/README.md) | Database, private files, admin, FTP/CDN, deployment, API |
| [Architecture](docs/architecture.md) | Modules/runtime flow |
| [Security](docs/security.md) | Signed access, revocation, limitations |
| [UI flow](docs/ui-flow.md) | Screens, retry and modals |
| [CI](docs/ci.md) | Checks, secrets, public-only deployment |
| [Licensing decisions](docs/online-licensing-plan.md) | Current policy and future improvements |

## License and contact

Proprietary; see [LICENSE.txt](LICENSE.txt) for the bilingual EULA. Game/font distribution must respect their respective licenses. Local encryption and signed checks do not make a customer-controlled binary impossible to modify; see [security limits](docs/security.md#limitations).

Website: [osameh.dev](https://osameh.dev) · Support: [support@osameh.dev](mailto:support@osameh.dev) · Telegram: [@osameh_ir](https://t.me/osameh_ir)
