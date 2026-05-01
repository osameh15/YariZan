# Architecture

## Solution layout

```
YariZan/
├── src/
│   ├── YariZan.sln
│   ├── YariZan.Core/          (class library, net9.0-windows)
│   ├── YariZan.App/           (WPF, WinExe, net9.0-windows)
│   ├── YariZan.SerialGen/     (console, net9.0-windows)
│   └── YariZan.Packer/        (console, net9.0-windows)
├── miniApps/                  (source mini-games per grade)
│   ├── 1/  …  6/
├── games_encrypted/           (build artifact, .gitignored)
├── secrets/                   (keys, .gitignored except public.pem)
├── docs/                      (you are here)
└── README.md
```

## Module responsibilities

### `YariZan.Core`
| File | Role |
|------|------|
| `HwidProvider.cs` | WMI-based fingerprint (BaseBoard, Processor, BIOS, Disk0) → SHA-256 |
| `SerialCodec.cs` | ECDSA-P256 sign/verify + Base32 grouping |
| `GameCrypto.cs` | AES-256-GCM encrypt/decrypt with file format `YZG1` ‖ nonce(12) ‖ tag(16) ‖ cipher |
| `GameManifest.cs` + `GameManifestIo` | JSON model + JsonSerializerOptions used by Packer & App |
| `ActivationStore.cs` | Encrypted record at `%LocalAppData%\YariZan\activation.dat`, key = PBKDF2(HWID) |
| `GameLauncher.cs` | Decrypts to temp dir, restricts ACL, launches process, cleans up on exit |
| `AppKeys.cs` | Loads embedded `public.pem` and `master.key` from the running assembly |

### `YariZan.App` (WPF)
- `Views/MainWindow.xaml` — single window, page swap with rotate+fade transition. Starts maximized; carries a custom minimize button (top-right visually) on every page.
- `Views/CoverPage.xaml` — closed leather book; tap to enter. Always shown first, even after activation.
- `Views/LockPage.xaml` — HWID display, copy button, serial entry, "فعال‌سازی" / "بازگشت" / "خروج". Only reachable when the saved `activation.dat` is missing or invalid for this PC.
- `Views/InfoPage.xaml` — two-page spread: icon+title on the right (first reading page in RTL), about+author+vertical button stack on the left.
- `Views/GamesBookPage.xaml` — grade picker (`همه` + ۱..۶), 3×2 landscape tile grid per page, info modal popup, navigation buttons swapped for RTL reading direction.
- `Services/AppPaths.cs` — resolves `games_encrypted/` next to the running exe.
- `Services/GameLibrary.cs` — loads `manifest.json` and exposes per-grade game lists.
- `Resources/Theme.xaml` — colors, brushes, `GoldButton`, `ExitButton`, `GradeChip` styles, Shabnam font lookup.

### `YariZan.SerialGen`
Three commands: `init` (generate keys + master.key into `secrets/`), `hwid` (print this machine's), `sign <HWID>`.

### `YariZan.Packer`
Walks `miniApps/1` … `miniApps/6`, encrypts each `.exe` to `g<grade>_<hash>.dat`, copies the matching image (PNG/JPG) untouched, reads the matching `.txt` sidecar as a Persian description, and writes `manifest.json`. Output dir is wiped first.

Each game in `manifest.json` carries `Name`, `Grade`, `EncryptedFile`, `ImageFile`, and `Description`. The launcher's info popup pulls `Description` straight out of the manifest.

## Runtime flow

```
Launch YariZan.exe
   │
   ▼
ActivationStore.Load()
   │
   ├── null/invalid ─────────────┐
   │                             ▼
   │                       LockPage (input serial)
   │                             │
   │                       SerialCodec.Verify(public.pem, hwid, serial)
   │                             │
   │                       ActivationStore.Save({hwid, serial})
   │                             │
   ▼                             ▼
CoverPage  ──tap──►  InfoPage  ──"ورود"──►  GamesBookPage
                                                  │
                                            user clicks tile
                                                  │
                                                  ▼
                            GameLauncher.Launch(masterKey, gameDat, name)
                              ├── decrypt blob to byte[]
                              ├── write to %Temp%\YariZan\<guid>\<name>.exe
                              ├── ACL: this user + FullControl, deny inheritance
                              ├── Process.Start
                              └── on Exited: delete temp dir
```

## Build-time wiring

`YariZan.App.csproj` embeds the keys and copies the encrypted bundle:

```xml
<EmbeddedResource Include="..\..\secrets\public.pem" Link="Keys\public.pem" />
<EmbeddedResource Include="..\..\secrets\master.key" Link="Keys\master.key" />

<None Include="..\..\games_encrypted\**\*.*"
      Link="games_encrypted\%(RecursiveDir)%(Filename)%(Extension)">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
</None>
```

`AppKeys.OpenResource` looks up resources by suffix match, so the keys can live under any logical resource path inside the assembly.

## Why these choices

- **WPF over WinForms / Avalonia / Electron** — book-flip animations want a 2D vector framework with proper RenderTransform support; WPF Persian/RTL is mature; single-file publish is straightforward.
- **ECDSA-P256 over RSA-2048** — equivalent security with 64-byte raw signatures (~103 Base32 chars) vs 256 bytes (~410 chars). Materially better UX for serial entry.
- **AES-GCM over CBC+HMAC** — single primitive, authenticated, modern, and built-in to .NET.
- **PBKDF2 for activation key** — slow KDF over a high-entropy HWID is overkill but cheap and consistent.
