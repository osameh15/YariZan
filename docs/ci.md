# CI and deployment

## Desktop checks

Phase 1 adds `tests/Run-V2Checks.ps1`, using actual Windows WMI/CNG, disposable P-256 keys, a transactional test server, bounded fake HTTP and synthetic WPF games. Node 24 verifies .NET signatures and signs reverse fixtures. OpenAPI lint uses Redocly CLI 2.63.0. `Run-BookChecks.ps1` now generates its own portrait; no private game artwork is needed. Neither suite contacts the future V2 host or legacy PHP.

`.github/workflows/ci.yml` runs on main pushes/PRs and manually. Windows/.NET 9 restores, rejects tracked private files, generates ephemeral runner keys, checks grade detection/packing with disposable synthetic games, builds Release, runs isolated access/grant and asynchronous launcher checks, and verifies the EXE exists. The release packer intentionally rejects an empty source catalog; CI does not attempt to create a production bundle from the public checkout.

It does not use production keys/games/customer state or produce a production installer. Build actual releases locally with [build-and-pack.md](build-and-pack.md).

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/Run-AccessChecks.ps1
py tools/Check-PublicRepository.py
```

## Panel checks and deploy

`.github/workflows/licensing.yml` runs for the panel and listed deployment/check paths, plus manual runs. Ubuntu/PHP/disposable MySQL lint PHP, verify the repository boundary, test database/service/runtime preparation, and validate Python syntax. Artifact `yarizan-licensing` contains only `public/`.

Successful matching main pushes deploy using environment `licensing-production`. Manual runs require `deploy=true` on main. PRs never deploy.

| Secret | Value |
|---|---|
| `FTP_HOST` | `2450773172.cloudylink.com` |
| `FTP_PORT` | `21` |
| `FTP_USERNAME` | Dedicated account username |
| `FTP_PASSWORD` | Dedicated account password |
| `FTP_CERT_FINGERPRINT` | Verified server certificate SHA-256 fingerprint; current script also accepts SHA-1 |

Confirm fingerprint with your provider, including after certificate rotation. Deployment verifies it before credentials and pins the verified key on transfers. FTP may open directly at the subdomain public root; no private-folder access is required.

`Deploy-Licensing.py` uses staged per-file renames; multi-file updates are not globally atomic. It never updates private PHP/schema/config/keys. Upload these separately using [hosting instructions](../web/licensing/README.md#updating-this-release).

**CI has no HTTP health check.** Green deployment means public FTPS uploads completed, not that live PHP/database readiness is verified. Manually open `https://yarizan.osameh.dev/api/health.php`, check `status: ready`, then test login and app access. Hosting/CDN restrictions on runner networks can differ from browser access; report timestamps and details to the provider.

## Manual public upload

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-LicensingBundle.ps1
```

Extract `publish/YariZan-licensing-panel.zip` directly into the public root, including `.htaccess`. This ZIP contains public files at root; CI artifacts have a `public/` wrapper. Neither includes private setup.

See [panel checks/preview](../web/licensing/README.md#tests-and-local-preview). Never deploy preview credentials. Use Conventional Commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`), configured SSH signing and the SSH Git remote.

`tests/Run-LauncherChecks.ps1` builds a disposable invisible synthetic game and verifies cancellation, revocation, shutdown, Persian filenames, GUI readiness and temporary-file cleanup. It uses no real games, license state or production keys.
