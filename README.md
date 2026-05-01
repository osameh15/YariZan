<div align="center">

<img src="src/YariZan.App/Resources/icon.png" alt="YariZan" width="180" />

# YariZan — یاریزان

**A modern Persian launcher for educational mini‑games (grades 1–6),**
**styled as an ornate leather book with hardware‑locked activation.**

[![.NET](https://img.shields.io/badge/.NET-9.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![WPF](https://img.shields.io/badge/UI-WPF-0078D4)](https://learn.microsoft.com/dotnet/desktop/wpf/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)
[![Language](https://img.shields.io/badge/Language-C%23-239120?logo=csharp&logoColor=white)](https://learn.microsoft.com/dotnet/csharp/)
[![License](https://img.shields.io/badge/License-Proprietary-lightgrey)](#license)
[![RTL](https://img.shields.io/badge/UI-RTL%20(Persian)-2BAE66)](#)

</div>

---

## Why

Bundle a catalog of Adobe‑published `.exe` mini‑games (grades 1–6) into one polished, **hardware‑locked** launcher. A buyer's serial only unlocks **their** PC; the games themselves are AES‑encrypted on disk so they can't be casually extracted and shared.

## Highlights

- 📖 **Book‑style UI** — closed leather cover → information page → open spread of game tiles, with page‑flip animation and proper Persian RTL reading order (first page on the right).
- 🔐 **HWID‑bound activation** — ECDSA‑P256 signed serials. Sharing a serial does not work; carrying the activation file across PCs does not work.
- 🛡️ **Encrypted games at rest** — AES‑256‑GCM blobs on disk. Games decrypt on‑demand to a temp directory with a restricted ACL and are deleted on exit.
- 🇮🇷 **Persian, right‑to‑left** — Shabnam font, Persian digits, native RTL layout. Latin wordmarks (the "YariZan" cover title) remain LTR where intended.
- 🧰 **Self‑contained tooling** — one console tool to generate keys & sign serials, another to encrypt your games into a shippable bundle. Both are just `dotnet run`.
- 📚 **Six grades, infinite games** — drop a `.exe`, `.png`, and a Persian description `.txt` into `miniApps/<grade>/`, re‑pack, ship.

## Screen flow

```
   ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
   │   CoverPage      │ →  │   LockPage      │ →  │   InfoPage       │ →  │   GamesBookPage  │
   │ closed leather   │    │ HWID + serial   │    │ author + about   │    │ grade picker +   │
   │ book, "tap to    │    │ entry. Skipped  │    │ + "ورود" button  │    │ 6+6 spread + i   │
   │ open"            │    │ on later runs.  │    │                  │    │ popup + flips    │
   └──────────────────┘    └─────────────────┘    └──────────────────┘    └──────────────────┘
```

Every page after the cover has a red **خروج** (Exit) button. The window has a custom minimize control in its top‑right corner and starts maximized.

---

## Quick start

```powershell
# Prerequisites
winget install Microsoft.DotNet.SDK.9    # one-time

# 1. Generate keypair + master AES key (run ONCE per project lifetime)
dotnet run --project src\YariZan.SerialGen -- init

# 2. Encrypt the games in miniApps/ into games_encrypted/
dotnet run --project src\YariZan.Packer

# 3. Run it
dotnet run --project src\YariZan.App
```

The first time you run it, the lock screen will show your machine's HWID. Generate a serial bound to it:

```powershell
dotnet run --project src\YariZan.SerialGen -- sign <YOUR-HWID-HEX>
```

Paste the printed serial into the lock screen → the book opens. Subsequent launches skip the lock entirely.

> **Need to re-test the lock screen?** Wipe your saved activation with `dotnet run --project src\YariZan.SerialGen -- reset`, then relaunch.

---

## Project layout

```
YariZan/
├── src/
│   ├── YariZan.sln
│   ├── YariZan.App/         WPF launcher (Persian RTL book UI, page-flip, info modal)
│   ├── YariZan.Core/        Crypto + HWID + serial codec + activation store
│   ├── YariZan.SerialGen/   Console tool: generate keys, sign per-machine serials
│   └── YariZan.Packer/      Build-time tool: encrypt miniApps/ into games_encrypted/
├── miniApps/                Source mini-games (you author this)
│   ├── 1/  …  6/            One folder per school grade
│   │   ├── <Game>.exe       Adobe CS6 published mini-game
│   │   ├── <Game>.png       Landscape thumbnail (width > height)
│   │   └── <Game>.txt       Persian description (UTF-8, free-form)
├── games_encrypted/         Build artifact (gitignored, ships with the launcher)
├── secrets/                 Keys (private.pem and master.key are gitignored)
├── docs/                    Architecture, security, build, UI-flow, CI
└── .github/workflows/       Optional GitHub Actions CI
```

## Updating branding

The app's icon and any other branding live under [`src/YariZan.App/Resources/`](src/YariZan.App/Resources/) (`icon.png`, `logo.png`, fonts). Drop a new image with the same filename and rebuild — WPF embeds them as resources at build time.

## Adding a new mini‑game

1. Pick a grade folder under `miniApps/<n>/`.
2. Drop in three files with the **same Persian base name**:
   - `<Name>.exe` — the published mini‑game
   - `<Name>.png` (or `.jpg`) — landscape thumbnail
   - `<Name>.txt` — UTF‑8 Persian description shown in the info popup
3. Re‑run the Packer:
   ```powershell
   dotnet run --project src\YariZan.Packer
   ```
4. Re‑build the launcher. New games appear automatically (the manifest is regenerated each pack).

No serial changes needed when you add games — same key, same activation, more content.

## Selling a copy (operator workflow)

```
Customer                                          You
─────────                                         ───
1. Receives YariZan-win-x64.zip
   from you (one-time download)
                                                  
2. Runs YariZan.exe
   Sees lock screen + their HWID              
                                                  
3. Sends HWID to you  ──────────────────────►  4. Runs:
                                                  dotnet run --project src\YariZan.SerialGen -- sign <HWID>
                                                  
                                                  Sends back the Serial: line
5. Pastes serial → book opens   ◄─────────────  
   Activation persists per‑PC                     
                                                  
6. Launch from now on goes straight to the
   cover, no lock screen, no internet check
```

---

## Documentation

| File | What it covers |
|------|----------------|
| [docs/architecture.md](docs/architecture.md) | Solution map, module responsibilities, runtime flow |
| [docs/security.md](docs/security.md) | HWID, ECDSA serials, AES‑GCM, activation store, threat model & honest DRM limits |
| [docs/build-and-pack.md](docs/build-and-pack.md) | Keygen, packing, single‑file publish, ConfuserEx tips |
| [docs/ui-flow.md](docs/ui-flow.md) | Screens, RTL/fonts, animations, tile grid, info modal |
| [docs/ci.md](docs/ci.md) | CI rationale and the optional GitHub Actions workflow |

## Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | .NET 9 (Windows) | Latest LTS‑track, mature WPF, `AesGcm`, `ECDsa` built‑in |
| UI | WPF | First‑class RTL & Persian shaping; smooth book animations via 3D/Render transforms |
| Asymmetric crypto | ECDSA‑P256 (SHA‑256) | 64‑byte signatures → ~103 char Base32 serials (vs ~410 for RSA‑2048) |
| Symmetric crypto | AES‑256‑GCM | Authenticated encryption, single primitive, no MAC composition needed |
| KDF (activation file) | PBKDF2‑SHA256, 100k | Slow KDF over high‑entropy HWID; binds activation to one PC |
| HWID source | WMI BaseBoard / Processor / BIOS / Disk0 | Stable across reboots, no MAC dependency |
| Font | Shabnam | Free, well‑shaped Persian; bundled `.ttf` for full WPF support |

## Security at a glance

- Serial = **ECDSA‑P256** signature of `"YariZan-Serial-v1\|" + HWID`. Only the **public** key ships in the launcher — even cracking the binary cannot forge serials.
- HWID = **SHA‑256** of `(Motherboard SN ‖ Processor ID ‖ BIOS SN ‖ Disk0 SN)`.
- Games encrypted with **AES‑256‑GCM**; master key embedded in the launcher (obfuscation recommended for release builds — see `docs/build-and-pack.md`).
- Activation file `%LocalAppData%\YariZan\activation.dat` is itself AES‑GCM encrypted with a key **derived from the running PC's HWID** — copying the file does not transfer activation.

> **Honest framing:** local Windows DRM has a hard ceiling — a determined attacker with admin rights can copy a decrypted game out of the temp directory while it's running. YariZan defeats casual extraction (file managers, archive tools), not nation‑state reverse engineers. See [docs/security.md](docs/security.md) for the full threat model.

---

## CI?

A minimal **GitHub Actions** workflow is in `.github/workflows/ci.yml` and verifies the solution builds on every push to `main` / pull request. It generates ephemeral keys (so it never sees your real `private.pem`) and runs the Packer on the sample game.

**Do you need it?** Honest answer for this project today: **not strictly.** A solo dev shipping a Windows‑only app gets very little safety net from a build‑only CI. It becomes valuable when:

1. You add unit tests (then CI catches regressions before you click "merge").
2. Contributors join (PRs build automatically).
3. You want **release automation** — tag a version, GitHub builds the single‑file `.exe`, zips it with `games_encrypted/`, and attaches it to a Release.

The workflow shipped here covers (1) and (2) and is a 5‑line add to enable (3) when you want it. See [docs/ci.md](docs/ci.md).

---

## Roadmap

- [ ] Per‑machine wrapped master key (hide the key behind activation entirely)
- [ ] Release automation (tag → published zip on GitHub Releases)
- [ ] Smoothed 3D page‑flip (PlaneProjection) replacing the current scale‑and‑swap
- [ ] In‑app screen for adding games at runtime (drag & drop into a grade)
- [ ] Optional offline analytics: per‑game launch counts (local SQLite, never leaves the PC)

## License

Proprietary. © YariZan. All rights reserved. Contact the author for distribution terms.

## Author

**osameh15** — <osirandoust@gmail.com> · [github.com/osameh15](https://github.com/osameh15)
