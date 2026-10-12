# Licensing panel: setup and operations

PHP 8.2+ / MySQL-InnoDB service at `https://yarizan.osameh.dev`. It registers devices, stores two-entry trial counters and current serials, and signs online authorization. Paid and trial access both need internet; no perpetual offline access is implemented.

## Hosting layout

Create subdomain `yarizan.osameh.dev` with HTTPS and public document root `domains/osameh.dev/subdomains/yarizan/`. The existing private parent contains other applications; create its separate `yarizan/` child.

```text
domains/osameh.dev/subdomains/
  yarizan/                    public document root (755)
    index.php
    app-loader.php
    api/
    assets/
    .htaccess
  private/                    existing parent (700)
    yarizan/                  panel-specific private directory (700)
      app/
      bin/
      database/
      config.php              DB configuration (600)
      private.pem             existing signing key (600)
      admin.php               admin password hash (600)
      admin-credentials.txt   generated login details (600)
```

PHP must run as the hosting account to read private 700 folders. Enable PDO MySQL, OpenSSL, PHP sessions and a writable session directory. PHP Intl is not required; browser Intl formats dates.

Create a dedicated database and user in the hosting panel, then grant the user access. The current database/user names are `osameh_yarizan` and `osameh_yarizan_admin`; keep their password private. Initial schema creation needs CREATE/INDEX privileges; normal operation needs SELECT/INSERT/UPDATE/DELETE. Back up the database and matching signing key securely.

## Manual private setup

Restore the existing `secrets/private.pem` locally; it must match the app's embedded public key. Provision ignored files locally using PHP CLI:

```powershell
$env:DATABASE_NAME = 'osameh_yarizan'
$env:DATABASE_USER_NAME = 'osameh_yarizan_admin'
$dbPassword = Read-Host 'Database password' -AsSecureString
$env:DATABASE_PASSWORD = [System.Net.NetworkCredential]::new('', $dbPassword).Password
$env:SIGNING_PRIVATE_KEY = Get-Content -Raw secrets/private.pem
$env:CREATE_ADMIN = 'true'
$env:CREATE_SIGNING_KEY = 'true'
try {
  php tools/Prepare-LicensingRuntime.php web/licensing/private
  if ($LASTEXITCODE -ne 0) { throw 'Private provisioning failed' }
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-PrivateLicensingBundle.ps1
  if ($LASTEXITCODE -ne 0) { throw 'Private bundle failed' }
} finally {
  'DATABASE_NAME','DATABASE_USER_NAME','DATABASE_PASSWORD','SIGNING_PRIVATE_KEY',
  'CREATE_ADMIN','CREATE_SIGNING_KEY' | ForEach-Object {
    [Environment]::SetEnvironmentVariable($_, $null, 'Process')
  }
  Remove-Variable dbPassword -ErrorAction SilentlyContinue
}
```

Use your PHP executable's full path if it is not on PATH. The flags create the admin account and copy the supplied existing key, not a new keypair. Omit both flags for subsequent configuration-only updates so the password/key remain unchanged. The preparation script rewrites config; do not run it against production paths casually.

Upload `publish/YariZan-private-setup.zip` manually through the host file manager. Extract its contents directly into `domains/osameh.dev/subdomains/private/yarizan/`. Set folder/sensitive-file permissions as above. Remove the uploaded ZIP afterward; it contains secrets and must never go in public storage, GitHub or CI artifacts.

Username is `admin`; read the randomly generated strong password from `admin-credentials.txt` privately. `admin.php` stores the password hash. Keep secure backups; anyone who reads the credentials file can log in.

Generated `config.php` merges database settings and `admin.php`, with `signing_key_path` pointing at the private key. It sets secure cookies and `auto_install_schema=true`; a writable private directory stores the schema-v2 readiness marker. With automatic schema disabled, run private `bin/migrate.php` through CLI or import `database/schema.sql` manually.

For a custom layout/DB host, use `config.example.php` as a reference and adjust DSN/private paths; do not upload the example as an active config unchanged. Standard public `app-loader.php` resolves the sibling private application. `YARIZAN_CONFIG` can override the config location for a controlled local environment.

## Public deployment

GitHub secrets: `FTP_HOST`, `FTP_PORT`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_CERT_FINGERPRINT`. Do not add DB/admin/signing secrets to public deployment. Host `2450773172.cloudylink.com`, port 21, explicit FTPS. Confirm the certificate fingerprint with the provider before setting it.

The FTP account may open directly into the public subdomain folder; it needs no private-directory access. CI verifies the certificate and pins its public key for each transfer. Main pushes matching workflow paths deploy tested public files; manual workflow runs need `deploy=true`. See [CI guide](../../docs/ci.md).

Manual public bundle:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-LicensingBundle.ps1
```

Extract `publish/YariZan-licensing-panel.zip` directly into the public root, including hidden `.htaccess`. This ZIP is public only. CI's `yarizan-licensing` artifact instead contains a `public/` wrapper.

Public deploy never reads/uploads/changes private files. Per-file staged renames do not make a multi-file release globally atomic. **There is no live HTTP health check in CI.** A successful upload does not prove backend readiness.

### CDN and readiness

Enable HTTPS at both CDN and origin. Bypass caching and browser challenges for `/api/*`, login and authenticated pages. API callers are desktop programs, not browsers. Versioned static `assets/` cache for seven days using Apache mod_headers/.htaccess; increment URL versions on asset changes.

Open `https://yarizan.osameh.dev/api/health.php`. Expected JSON includes `status: ready`, `product: YariZan`, version and the public-key SHA-256 fingerprint. This checks DB/key readability, not the complete customer workflow. Test admin login and the desktop separately. For blocked/time-out runner connections, contact the provider with timestamps and origin/CDN details.

Configure a daily cron with the provider's PHP CLI and the absolute private `yarizan/bin/maintenance.php` path. It removes expired rate-limit data and audit records older than a year; retained trial grants support idempotent retries.

### Backups, password changes, and recovery

Back up the MySQL database, private configuration/admin files, and matching signing key securely. Keep the desktop AES key/source games separately. Restoring only code does not restore customer serials or counters. A database restore can roll back usage or revocation decisions; review those records before reopening access.

To change the admin password, run `php web/licensing/bin/password_hash.php` privately and enter a strong password (14–72 bytes; this tool's input is not hidden). Replace only `admin_password_hash` in the private `admin.php` with the generated hash, preserving PHP syntax, username, and permission 600. Update the private credentials record/secure password manager too. Do not regenerate signing keys to fix a login problem.

Troubleshooting: 503 usually means missing private code/config, inaccessible files, DB/schema failure, or unreadable signing key; inspect the host PHP error log without posting secrets. Login loops can indicate HTTPS/secure-cookie/session-storage problems. HTTP 403 `access_denied` means a blocked device, stale serial, or missing trial grant. Browser challenge pages, redirects and cached API responses can prevent desktop verification even if the panel opens in a browser. Backend maintenance/outages deny app access by design.

## How the panel works

| Action | Result |
|---|---|
| Search | Name, description/notes, HWID, serial |
| Page size | 10, 25, 50, 100, 200 rows |
| Edit | Opens closable editor after the table; HWID read-only |
| Save metadata | Updates name/description and retains serial |
| Add with HWID / issue | Registers/restores HWID and creates its serial if absent |
| Issue again | Returns existing serial rather than silently replacing it |
| Copy | Copies HWID or current serial |
| Reset trial | Restores two entries and removes trial grants; paid serial unchanged |
| Regenerate | New serial, old serial rejected, trial grants revoked, trials exhausted |
| Remove | Deletes device details/grants/audit rows, retains blocked HWID |
| Restore removed device | Explicit Add/issue for that HWID; give customer new serial |

Styled confirmations handle destructive actions. Login uses hashed passwords, secure HttpOnly SameSite cookies, CSRF and rate limits. Idle sessions expire after 30 minutes. Counts use Persian digits; dates are Persian Solar Hijri/Jalali in Tehran time. Admin operations are audited except records removed as part of device deletion.

Customers first see the cover. Opening it validates saved paid access or shows Lock. New online status registers PC/HWID without spending a trial. Only trial entry spends one. Paid users enter the current serial once; it is saved locally. After an outage, Retry validates it and opens automatically. Revoked saved serials cannot fall back to registration; replacements need entry once.

Checks happen at protected entry, before each game launch, and every 60 seconds during a session. Failure stops launched games and shows Lock. Same-HWID OS reinstall can use the current serial; server counters/blocks do not reset with local deletion/reinstall.

## Updating this release

For private backend updates, create a code-only bundle:

```powershell
New-Item -ItemType Directory -Path publish -Force | Out-Null
Compress-Archive -Path web/licensing/app,web/licensing/bin,web/licensing/database -DestinationPath publish/YariZan-private-code-update.zip -Force
```

Extract into the private application directory, replacing app/bin/database code while preserving config, admin files and key. This ZIP contains no runtime secrets. Schema v2 adds blocked devices; auto-install's v2 marker triggers idempotent setup on the next request. Otherwise migrate manually. Deploy compatible public code through CI/manual upload and then check health/login/desktop. Delete old ZIPs after upload.

## API

Endpoint: HTTPS POST `/api/trial.php`, JSON content type.

| Operation | Request fields | Purpose |
|---|---|---|
| `status` | `hwid`, optional `pc_name` | Register/display remaining 0–2; unsigned, no authorization |
| `consume` | `hwid`, `nonce` | Consume trial; signed result, retained nonce makes retries idempotent |
| `authorize` | `hwid`, `mode`, `credential`, fresh `nonce` | Signed paid/trial session check |

HWID/nonces are 64-character hex. Paid credential is normalized current serial; trial credential is the retained trial-session nonce.

```json
{"operation":"status","hwid":"64_HEX_CHARACTERS","pc_name":"Customer-PC"}
```

Consumption returns device, nonce, remaining and Base64 raw P-256 signature over `YariZan-Trial-v1|HWID|NONCE|REMAINING`. Authorization signs `YariZan-Access-v1|HWID|CHECK_NONCE|MODE|CREDENTIAL_HASH`, with uppercase SHA-256 normalized-credential hash. The app verifies every field/signature; status alone cannot unlock it.

Invalid requests: 400; access denied/exhausted: 403; wrong method: 405; wrong content type: 415; rate limit: 429; service failure: 503. Deleted HWIDs, replaced serials and removed grants are denied. Request/response bodies are bounded. Transactions serialize concurrent trial requests; signing/database failure grants no access.

## Tests and local preview

Docker Compose provides disposable PHP/MySQL with a temporary key:

```powershell
docker compose -p yarizan-checks -f web/licensing/tests/compose.yml up --build -d
docker compose -p yarizan-checks -f web/licensing/tests/compose.yml exec -T panel php tests/check.php
```

Preview: `http://127.0.0.1:8871/`. Login `admin`, password `Local-test-password-2026`; development-only, never deploy. Stop with the same compose command ending in `down`.

Direct tests use `YARIZAN_TEST_DSN`, `YARIZAN_TEST_DB_USER`, `YARIZAN_TEST_DB_PASSWORD`; database name must end in `_test`. Run `php web/licensing/tests/check.php` and `php tools/tests/check_licensing_runtime.php`. For PHP/.NET vectors, export a container-generated fixture to a temporary file, set `YARIZAN_TEST_VECTOR`, and run `tests/Run-AccessChecks.ps1`. Never point these checks at real customer data or keys.

Example cross-language check after starting the disposable containers:

```powershell
docker compose -p yarizan-checks -f web/licensing/tests/compose.yml exec -T -e YARIZAN_TEST_VECTOR=/tmp/yarizan-vector.json panel php tests/check.php
$panelContainer = docker compose -p yarizan-checks -f web/licensing/tests/compose.yml ps -q panel
$vectorFile = Join-Path $env:TEMP 'yarizan-vector.json'
docker cp "${panelContainer}:/tmp/yarizan-vector.json" $vectorFile
$env:YARIZAN_TEST_VECTOR = $vectorFile
try {
  powershell -NoProfile -ExecutionPolicy Bypass -File tests/Run-AccessChecks.ps1
} finally {
  Remove-Item Env:YARIZAN_TEST_VECTOR -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $vectorFile -ErrorAction SilentlyContinue
}
```

## Boundaries

Reported HWID is not device proof/customer identity; modified clients can report another value. Embedded AES keys/decrypted executables can be extracted and modified clients can bypass checks. Local deletion does not reset the same server HWID's trial, but this is not unbreakable DRM. Old offline binaries cannot be remotely revoked. Serials made outside the panel are not accepted unless stored as current database serial. See [security](../../docs/security.md).
