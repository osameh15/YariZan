# YariZan licensing panel

PHP 8.2+ / MySQL (InnoDB) admin panel for `https://yarizan.osameh.dev`.

The administrator pastes a device HWID, optionally supplies a customer name and notes, and generates a serial. All registered trial devices and issued serials are searchable. Reissuing for the same HWID returns its stored serial. Reset trial restores exactly two online trial entries for that HWID without changing the paid serial. Panel actions are recorded in the database audit log.

Serials use the existing `YariZan-Serial-v1|HWID` ECDSA-P256 format. Paid activation remains fully offline. A customer who reinstalls Windows can re-enter the old serial if the hardware fingerprint is unchanged. The activation file need not survive the reinstall. The panel records issued serials, not live activation status or currently running offline users.

## Hosting setup for osameh.dev

The public document root is `domains/osameh.dev/subdomains/yarizan/`. The existing private parent is `domains/osameh.dev/subdomains/private/` (700). Create the panel-specific `private/yarizan/` child manually; other private items remain separate.

```text
subdomains/
  yarizan/                    public index.php, api/, assets/, .htaccess
  private/                    existing parent, permission 700
    yarizan/                  panel-specific child, permission 700
      app/, bin/, database/   PHP implementation and schema
      config.php              database settings, permission 600
      private.pem             existing ECDSA signing key, permission 600
      admin.php               username/password hash, permission 600
      admin-credentials.txt   generated admin login, permission 600
```

Create a dedicated MySQL database and user and grant that user access. Database credentials belong only in the private `config.php`; CI does not use database or signing-key secrets. Initial tables are created idempotently on first startup. PHP needs PDO MySQL, OpenSSL, sessions, and a writable session directory. Dates use the browser's Persian calendar, Persian digits, and Tehran time; PHP Intl is not required.

### Manual private setup

The prepared local private files are ignored by Git. To create them on another machine, set `DATABASE_NAME`, `DATABASE_USER_NAME`, and `DATABASE_PASSWORD` in your local process environment. Set `SIGNING_PRIVATE_KEY` to the contents of the existing `secrets/private.pem`, and set `CREATE_ADMIN=true` and `CREATE_SIGNING_KEY=true`. Run:

```powershell
php tools/Prepare-LicensingRuntime.php web/licensing/private
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-PrivateLicensingBundle.ps1
```

Keep secret values out of shell history and clear these environment variables afterward. Use the existing signing key to preserve compatibility with old serials. Creation flags generate the initial admin files and copy the supplied signing key; omit them on subsequent configuration updates to preserve both.

Upload `publish/YariZan-private-setup.zip` manually through the hosting file manager, extract its contents directly into `domains/osameh.dev/subdomains/private/yarizan/`, then remove the uploaded ZIP. The folder must contain **app/**, **bin/**, **database/**, **config.php**, **admin.php**, **admin-credentials.txt**, and **private.pem**. Set the private folder to 700 and the four private files to 600. Upload updated app/bin/database code manually after backend changes; preserve your config, admin account, and signing key.

Username: `admin`. Read the generated strong password in `admin-credentials.txt` locally or through the host's private file manager. The password hash is stored in `admin.php`. Never upload these private files or the private ZIP into the public document root, GitHub, or CI artifacts.

Only these repository secrets are needed for public deployment: `FTP_HOST`, `FTP_PORT`, `FTP_USERNAME`, `FTP_PASSWORD`, and `FTP_CERT_FINGERPRINT`. The workflow verifies the certificate before login and pins that public key on each FTPS connection. The FTP account can open directly into the public subdomain directory; it does not need private-directory access. The FTPS host is `2450773172.cloudylink.com`, port 21.
Enable HTTPS to the subdomain and origin. Bypass CDN caching/browser challenges for `/api/*`, and bypass caching for the login/admin page. Configure daily cron to execute `private/yarizan/bin/maintenance.php`. PHP must run as your hosting account to read 700 directories.

The desktop uses `https://yarizan.osameh.dev/api/trial.php`. Until the service is ready, trials are unavailable; valid serial activation stays offline. Use the panel to reset server trials, not the retained local `SerialGen reset-trial` utility.

## API

`POST /api/trial.php`, `Content-Type: application/json`:

```json
{"operation":"status","hwid":"64_HEX_CHARACTERS"}
```

Returns `remaining` (0–2). This unsigned status is only used for UI text; it cannot authorize access.

```json
{"operation":"consume","hwid":"64_HEX_CHARACTERS","nonce":"64_HEX_RANDOM_SESSION_NONCE"}
```

Returns `hwid`, `nonce`, `remaining` (0–1), and a Base64 P-256 raw signature over:

```text
YariZan-Trial-v1|HWID|NONCE|REMAINING
```

The app verifies the signature and exact current device/session nonce before granting access. Retrying the same nonce returns the same grant without spending another entry. InnoDB transactions serialize concurrent requests for one device. Signing or database failure never grants access. A new process uses a fresh nonce. Panel reset deletes stored grants for that HWID and restores its counter; an already running trial session is not remotely terminated.

## Tests and local preview

```powershell
docker compose -p yarizan-checks -f web/licensing/tests/compose.yml up --build -d
docker compose -p yarizan-checks -f web/licensing/tests/compose.yml exec -T panel php tests/check.php
```

The preview is bound to `http://127.0.0.1:8871/`, with a disposable MySQL database and temporary signing key. Login: `admin`, password: `Local-test-password-2026`. These are **development-only** credentials; never use or deploy them on your host.

For PHP/.NET interoperability checks, generate a vector inside the container, copy it to a temporary local file, set `YARIZAN_TEST_VECTOR` to its path, then run `tests/Run-AccessChecks.ps1`. PHP tests can also run directly with `YARIZAN_TEST_DSN`, `YARIZAN_TEST_DB_USER`, and `YARIZAN_TEST_DB_PASSWORD`; the database name must end in `_test`.

Stop the preview with `docker compose -p yarizan-checks -f web/licensing/tests/compose.yml down`. No real activation, registry, game key, or signing key is touched by these tests.

Static files under `public/assets/` use `Cache-Control: public, max-age=604800` (seven days). Asset URLs include version numbers; increment the relevant URL version when changing a logo, font, stylesheet, or script. Login/admin pages and API responses retain `no-store`. The static cache policy requires Apache `mod_headers` and permission to apply `.htaccess` rules. CDN rules must respect these headers and bypass caching for dynamic pages and API routes.

## Deployment workflow

`.github/workflows/licensing.yml` tests PHP against disposable MySQL, validates runtime provisioning, and packages code without secrets. Successful pushes to `main` deploy changed panel/deployment code; manual runs can use `deploy=true`. Pull requests only test. Deployment uses the `licensing-production` GitHub environment.

`tools/Deploy-Licensing.py` uploads only public index/API/assets/Apache rules using per-file atomic renames. It never uploads, creates, or changes private files. HTTPS readiness and signing-key compatibility are checked when private setup is present; a missing private bootstrap produces a manual-setup warning. Multi-file updates are not globally atomic.

For a public manual-upload ZIP, run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-LicensingBundle.ps1`. Extract its contents directly into `domains/osameh.dev/subdomains/yarizan/`. Private setup uses the separate command and ZIP described above.
## Known boundaries

The public trial API identifies devices by their reported HWID. Deleting local files or reinstalling Windows does not reset that HWID's server counter. A modified client can report a different HWID, consume another user's known HWID trials, or bypass local enforcement; verified customer accounts/evaluation codes and device-proof registration would be needed to strengthen that identity model. This implementation matches the requested paste-HWID workflow and is not proof of unbreakable DRM.

The existing game key remains embedded in the desktop app; standalone game extraction is a separate content-protection problem. Signed perpetual serials cannot be revoked while paid copies remain fully offline. Anyone with access to the host's signing key can issue serials, so protect the hosting account and admin login. Legacy serials issued outside this panel still work but are not automatically discovered by its database.
