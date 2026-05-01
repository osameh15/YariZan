# YariZan — یاریزان

A Windows desktop launcher for educational mini‑games (grades 1–6), styled as an ornate Persian leather book. Each book "spread" shows nine games per page; the games themselves are protected `.exe` bundles that only decrypt and run after the user activates the app with a serial bound to their machine.

| | |
|--|--|
| **Stack** | .NET 9, WPF, C# |
| **Platform** | Windows (x64) |
| **Language** | Persian UI (RTL), Shabnam font |
| **License** | Proprietary |

---

## What's in the box

| Project | Purpose |
|---------|---------|
| `src/YariZan.App` | WPF launcher with the book UI, activation, and game runner |
| `src/YariZan.Core` | Crypto + HWID + serial codec + activation store (shared) |
| `src/YariZan.SerialGen` | Seller‑side console tool: generate keys & sign per‑machine serials |
| `src/YariZan.Packer` | Build‑time tool: encrypt `miniApps/` into `games_encrypted/` |

---

## Quick start (developer)

```powershell
# 1. Generate the keypair + master AES key (run ONCE, keep secrets/private.pem and secrets/master.key safe)
dotnet run --project src\YariZan.SerialGen -- init

# 2. Add games — drop them in miniApps/<grade>/<GameName>.exe with a matching .png
#    (folder layout below)

# 3. Encrypt the games into games_encrypted/
dotnet run --project src\YariZan.Packer

# 4. Build & run the app
dotnet run --project src\YariZan.App
```

---

## Adding a new mini‑game

```
miniApps/
├── 1/                              # grade 1
│   ├── جمع با شکل.exe
│   └── جمع با شکل.png
├── 2/
│   └── ...
├── 3/
├── 4/
├── 5/
└── 6/
```

Each game is one `.exe` plus an icon image (PNG or JPG) with the **same base name** in Persian. After adding files, re‑run the Packer.

---

## Activating a customer's machine (seller workflow)

1. Customer launches `YariZan.exe`. The lock screen shows their **HWID** (a 64‑char hex string, prettified into 8 groups).
2. Customer sends you that HWID.
3. You run:
   ```powershell
   dotnet run --project src\YariZan.SerialGen -- sign <THEIR-HWID>
   ```
4. You send back the printed `Serial`. They paste it into the lock screen and the book opens. Activation persists per‑machine and is bound to their HWID, so they will **never see the lock screen again on that machine** — subsequent launches go straight to the cover → info → games book.

---

## Documentation

| File | What it covers |
|------|----------------|
| [docs/architecture.md](docs/architecture.md) | Solution layout, module responsibilities, runtime flow |
| [docs/security.md](docs/security.md) | HWID, ECDSA serials, AES‑GCM game crypto, activation store, threat model & honest limits |
| [docs/build-and-pack.md](docs/build-and-pack.md) | Generating keys, packing games, publishing the launcher |
| [docs/ui-flow.md](docs/ui-flow.md) | Cover → Lock → Info → GamesBook screens, Persian RTL details, fonts |

---

## Security at a glance

- **HWID** = SHA‑256(BaseBoard SN ‖ ProcessorId ‖ BIOS SN ‖ Disk0 SN). Stable per machine.
- **Serial** = ECDSA‑P256 signature of `"YariZan-Serial-v1|" + HWID`, encoded as Base32 in 5‑char groups (~103 chars). Only the **public key** ships in the app — even fully cracking the binary cannot forge a valid serial without the seller's private key.
- **Mini‑games** = AES‑256‑GCM encrypted blobs (`*.dat`). Master key is embedded in the launcher; games decrypt on‑demand to a temp directory with a restricted ACL, then are deleted on exit.
- **Activation** = per‑user encrypted file at `%LocalAppData%\YariZan\activation.dat`, sealed with a key derived from the HWID. Carrying the file to a different PC will not unlock it.

See [docs/security.md](docs/security.md) for a full threat‑model and DRM honesty note.

---

## Required font (one‑time)

WPF cannot render `.woff2`. Drop the **`.ttf`** versions of Shabnam into `src/YariZan.App/Resources/Fonts/Shabnam/` (download from the [Shabnam GitHub releases](https://github.com/rastikerdar/shabnam-font/releases)). Until then the app falls back to Tahoma.
