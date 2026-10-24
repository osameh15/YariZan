<div align="center">
<img src="src/YariZan.App/Resources/logo.png" alt="YariZan - educational games for primary school" width="230" />

# YariZan — یاریزان

Persian RTL educational mini-games for primary school by **OAR NOVA GAMES STUDIO**: a Windows game-book launcher, one package per grade, sold and activated through [yarizan.oarnova.games](https://yarizan.oarnova.games).
</div>

## Status (2.0.0)

| Grade | Windows | Price |
|---|---|---|
| 1 | **2.0.0 released** | 12,990,000 IRR |
| 2–6 | Coming soon | — |

- **Download:** [yarizan.oarnova.games/download](https://yarizan.oarnova.games/download). Compare the installer's SHA-256 with the value shown there (or in the GitHub Release `2.0.0`). The installer has no Authenticode signature, so SmartScreen may show "Unknown publisher"; licenses are still protected by YariZan's own ES256 signatures.
- **Customer journey:** install, connect the device to a YariZan account, use the two trial sessions, buy on the website through ZarinPal, get the license activated automatically, then play offline.
- **Production:** live ZarinPal payments, MeliPayamak SMS (OTP and Admin MFA), and an offline license root `yarizan-license-2026-01`. The legacy 1.1.0 release and its PHP licensing panel are historical and are not used by V2.

## Desktop app

- One grade per package, named **YariZan G1**, **G2**, and so on; the Persian cover title follows the grade.
- Portrait game artwork, three columns and two rows per page, with a book page-turn animation and direct page navigation in Persian, Arabic or English digits.
- Encrypted game bundles; titles come from filenames and descriptions show instructions only.
- Device connection through a browser pairing code, two trial sessions per device and grade (internet is needed only to start each trial), and a grade-bound perpetual offline license after purchase.
- Animated YariZan-logo loading while a game is prepared, with duplicate launches blocked.

## Web and backend

| Part | Stack | Guide |
|---|---|---|
| Storefront, customer account, Admin console (`/zanyari`) | Nuxt 4, Persian RTL | [apps/web/README.md](apps/web/README.md) |
| API, orders, payments, licenses, SMS | NestJS, PostgreSQL | [backend/README.md](backend/README.md) |
| Hosting, deploy, egress relays, downloads mirror | Docker Compose on the OAR NOVA VPS | `OAR-NOVA-Games/oarnova-infrastructure` |

Production features are enabled by capability (`PRODUCTION_CORE`, `CUSTOMER_AUTH`, `ADMIN_AUTH`, `DESKTOP_PROVISIONING`, `TRIALS_AND_LICENSES`, `LIVE_COMMERCE`). The API refuses to start unless each enabled capability is approved in source and its prerequisites validate. See [production capabilities](docs/YARIZAN-PRODUCTION-CAPABILITIES.md).

## Screenshots

Click an image to open it at full resolution. Device identifiers are masked.

<table>
  <tr><th>Cover and studio branding</th><th>Activation and trial</th></tr>
  <tr>
    <td><a href="docs/Images/cover-page.png"><img src="docs/Images/cover-page.png" width="440" alt="Persian grade-specific cover with transparent OAR NOVA GAMES STUDIO logo" /></a></td>
    <td><a href="docs/Images/lock-page.png"><img src="docs/Images/lock-page.png" width="440" alt="Activation screen with masked device identifier and two trial entries" /></a></td>
  </tr>
  <tr><th>Information and credits</th><th>Portrait game book</th></tr>
  <tr>
    <td><a href="docs/Images/info-page.png"><img src="docs/Images/info-page.png" width="440" alt="YariZan logo, dynamic grade title and studio credits" /></a></td>
    <td><a href="docs/Images/game-book.png"><img src="docs/Images/game-book.png" width="440" alt="G1 catalog with Persian filenames, portrait tiles and page-number input" /></a></td>
  </tr>
  <tr><th>Game details</th><th>Game-start loading</th></tr>
  <tr>
    <td><a href="docs/Images/game-detail.png"><img src="docs/Images/game-detail.png" width="440" alt="Game details with one title and instructions only" /></a></td>
    <td><a href="docs/Images/game-loading.png"><img src="docs/Images/game-loading.png" width="440" alt="Centered animated-logo loading overlay while the selected game opens" /></a></td>
  </tr>
</table>

<table>
  <tr><th>Web storefront</th><th>Catalog</th></tr>
  <tr>
    <td><a href="docs/Images/web/home.png"><img src="docs/Images/web/home.png" width="440" alt="Persian RTL YariZan storefront home page" /></a></td>
    <td><a href="docs/Images/web/catalog.png"><img src="docs/Images/web/catalog.png" width="440" alt="Grade catalog with purchase options" /></a></td>
  </tr>
  <tr><th>Checkout</th><th>Customer dashboard</th></tr>
  <tr>
    <td><a href="docs/Images/web/checkout.png"><img src="docs/Images/web/checkout.png" width="440" alt="Checkout summary with server-side quote" /></a></td>
    <td><a href="docs/Images/web/customer-dashboard.png"><img src="docs/Images/web/customer-dashboard.png" width="440" alt="Customer dashboard with devices and licenses" /></a></td>
  </tr>
  <tr><th>Admin dashboard</th><th></th></tr>
  <tr>
    <td><a href="docs/Images/web/admin-dashboard.png"><img src="docs/Images/web/admin-dashboard.png" width="440" alt="Admin dashboard overview" /></a></td>
    <td></td>
  </tr>
</table>

Regenerate the app images with `powershell -NoProfile -ExecutionPolicy Bypass -File tools/Capture-AppScreenshots.ps1` after packing the local catalog. See [screenshot notes](docs/Images/README.md).

## Build the Windows app

Run commands from the repository root in Windows PowerShell with the .NET 9 SDK (`net9.0-windows`) and Inno Setup 6 or 7.

1. Restore the private inputs into `secrets/` from secure backup: `master.key` (game key), `v2-license-public-keys.json` (public license root) and `v2-activation.json` (production API). They are never committed. See [keys](docs/build-and-pack.md#keys).
2. Add the grade's games under `miniApps/<grade>/` following [miniApps/README.md](miniApps/README.md). The repository contains no game payloads.
3. Pack, build and run:

```powershell
dotnet restore src/YariZan.sln
dotnet run --project src/YariZan.Packer
dotnet build src/YariZan.sln -c Release
dotnet run --project src/YariZan.App
```

4. Build the installer. With several populated grades, pass `--grade N`:

```powershell
.\build-installer.bat --noninteractive --grade 1
```

| Output | Use |
|---|---|
| `publish/YariZan-G1-win-x64/YariZan-G1.exe` | Self-contained launcher; keep the adjacent `games_encrypted/` |
| `publish/YariZan-G1-Setup-v2.0.0.exe` | Installer with launcher and games (version from the app project) |
| `publish/YariZan-G1-Setup-v2.0.0.exe.sha256` | Installer SHA-256 checksum |

Commercial builds run `YariZan.ReleaseCheck`, which refuses test keys, private keys or a missing activation configuration. The release procedure (approval record, GitHub tag and Release, verified transfer to the VPS, publication, website registry) is in [Windows release](docs/YARIZAN-WINDOWS-RELEASE.md). Never distribute source games, keys or credentials with a release.

## Repository map

| Path | Responsibility |
|---|---|
| `src/YariZan.App/` | WPF views, device connection, trials and activation UI |
| `src/YariZan.Core/` | Device identity, license verification, crypto, games and sorting |
| `src/YariZan.Packer/` | Encrypts local games and writes the manifest |
| `src/YariZan.ReleaseCheck/` | Commercial build checks |
| `apps/web/` | Nuxt 4 storefront, customer account and Admin console |
| `backend/` | NestJS API and PostgreSQL migrations |
| `miniApps/`, `games_encrypted/` | Ignored local games and generated catalog |
| `secrets/`, `release/` | Ignored private inputs; reviewed public root approvals |
| `tools/`, `tests/` | Packaging, release tooling and checks |
| `docs/` | Specifications, ADRs, runbooks, evidence and screenshots |
| `web/licensing/`, `src/YariZan.SerialGen/` | Legacy 1.1.0 PHP panel and serial tooling (historical) |

## Documentation

| Guide | Contents |
|---|---|
| [Technical specification](docs/YARIZAN-TECHNICAL-SPEC-V2.md) | Product behavior: devices, trials, licenses, commerce |
| [Activation and lifecycle](docs/YARIZAN-ACTIVATION-AND-LIFECYCLE-V2.md) | Pairing, trials, automatic activation, revocation |
| [API contracts](docs/YARIZAN-API-CONTRACTS-V2.md) · [OpenAPI](docs/YARIZAN-OPENAPI-BACKEND-V2.json) | HTTP, offline license and trial contracts |
| [Data model](docs/YARIZAN-DATA-MODEL-V2.md) | PostgreSQL entities and invariants |
| [Commerce](docs/YARIZAN-COMMERCE-CONTRACTS.md) · [ZarinPal](docs/YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md) | Orders, coupons, payments, fulfillment |
| [Auth and SMS](docs/YARIZAN-AUTH-AND-SMS-CONTRACTS.md) | OTP login, Admin MFA, SMS templates |
| [Pricing and catalog](docs/YARIZAN-PRICING-AND-CATALOG-CONTRACT.md) · [Promotions](docs/YARIZAN-PROMOTIONAL-PRICING.md) | Prices, publication, discounts |
| [Admin enrollment](docs/YARIZAN-OWNER-ADMIN-ENROLLMENT.md) | Provisioning Admin accounts on the server |
| [License signing custody](docs/YARIZAN-LICENSE-SIGNING-CUSTODY.md) | Production key ceremony and custody |
| [Release and rollback](docs/YARIZAN-RELEASE-AND-ROLLBACK.md) · [Windows release](docs/YARIZAN-WINDOWS-RELEASE.md) | Image and installer release, rollback |
| [Threat model](docs/YARIZAN-THREAT-MODEL-V2.md) · [Security](docs/security.md) | Assets, boundaries, limitations |
| [Build and pack](docs/build-and-pack.md) · [CI](docs/ci.md) | Local build, installer, workflows |
| [ADRs](docs/adr/) | Architecture decisions |

Phase reports (`docs/YARIZAN-PHASE-*-REPORT.md`) record how V2 was built and reviewed; they are historical.

## License and contact

Proprietary; see [LICENSE.txt](LICENSE.txt) for the bilingual EULA. Game and font distribution must respect their licenses. Local encryption and signed checks do not make a customer-controlled binary impossible to modify; see [security limits](docs/security.md#limitations).

Website: [osameh.dev](https://osameh.dev) · Support: [support@osameh.dev](mailto:support@osameh.dev) · Telegram: [@osameh_ir](https://t.me/osameh_ir)
