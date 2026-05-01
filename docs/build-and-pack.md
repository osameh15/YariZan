# Build & pack workflow

## One-time setup (per dev machine)

```powershell
# Install .NET 9 SDK (Windows 10 / 11)
winget install Microsoft.DotNet.SDK.9
```

## First-time keys

Run **once**, the day you start the project. Re-running will refuse unless you delete `secrets/` first.

```powershell
dotnet run --project src\YariZan.SerialGen -- init
```

This creates:
- `secrets/private.pem` — ECDSA-P256 private key. **Keep secret. Back up offline. Never commit.**
- `secrets/public.pem` — embedded into the launcher.
- `secrets/master.key` — 32 random bytes used to encrypt every game.

After this, regenerating the keys is a hard reset: every previously issued serial stops working, and every previously packed `games_encrypted/` bundle becomes garbage.

## Pack games

```powershell
dotnet run --project src\YariZan.Packer
```

Reads `miniApps/<grade>/<Name>.exe` (+ matching `.png`/`.jpg`), produces:

```
games_encrypted/
├── manifest.json
└── <grade>/
    ├── g<grade>_<hash>.dat   # encrypted
    └── g<grade>_<hash>.png   # icon, copied verbatim
```

The packer wipes `games_encrypted/` first to avoid stale entries from removed games.

## Build the launcher

```powershell
dotnet build src\YariZan.App\YariZan.App.csproj -c Release
```

The csproj automatically:
- Embeds `secrets/public.pem` and `secrets/master.key` as resources.
- Copies `games_encrypted/**` into `bin/.../games_encrypted/`.
- Includes Shabnam `.ttf`/`.otf` font resources.

## Generate a customer's serial

The customer launches `YariZan.exe`, sees their HWID on the lock screen, and sends it to you. Then:

```powershell
dotnet run --project src\YariZan.SerialGen -- sign <THEIR-HWID-HEX>
```

The HWID is 64 hex chars; dashes/spaces in what they paste are tolerated. The output `Serial` line is what they type into the lock screen.

To check your own machine's HWID without involving the launcher:

```powershell
dotnet run --project src\YariZan.SerialGen -- hwid
```

## Publish a single-file release

```powershell
dotnet publish src\YariZan.App\YariZan.App.csproj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeAllContentForSelfExtract=true `
    -o publish\YariZan-win-x64
```

The `publish\YariZan-win-x64\` folder will contain `YariZan.exe` plus the `games_encrypted/` directory. Zip and ship.

For a smaller binary you can also pass `-p:PublishTrimmed=true`, but trimming + WPF needs careful XAML root inspection — verify the lock screen still renders before shipping.

## Optional: obfuscate before shipping

Get [ConfuserEx](https://github.com/mkaring/ConfuserEx). Aim for these protections on the *published* `YariZan.exe`:

- `rename` (low) — renames internal symbols
- `ctrl flow` (normal) — flattens control flow
- `constants` (normal) — encrypts string and byte-array constants (this is what hides the embedded master key)
- `anti debug` (safe), `anti dump` (safe)

Skip aggressive packers that break WPF resource loading (`anti tamper` at the `aggressive` level breaks `Application.LoadComponent` with embedded XAML).

## Add a new game

1. Drop `<Name>.exe` and `<Name>.png` into `miniApps/<grade>/`.
2. Re-run the Packer.
3. Re-build & re-publish.
4. No serial changes needed — same key, same activation, more games.

## Add a new grade folder

Folders `1..6` are expected. The Packer just skips empty grades. To add games for a previously empty grade, drop them in and re-pack.
