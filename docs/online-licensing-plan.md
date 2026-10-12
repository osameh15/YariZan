# Licensing service plan

Target: `https://yarizan.osameh.dev`, on the existing shared host.

**Updated implementation:** the user selected a paste-HWID serial panel with server-managed trials and offline serial activation. See `web/licensing/README.md` for the implemented protocol and deployment instructions. Device-key registration, customer-account verification, and game-key changes below are future strengthening options, not implemented features.

Confirmed product policy: two online trial entries; paid activation requires internet once, then works fully offline with no periodic check or expiry. Server-side revocation can block future activations, but cannot revoke an already issued perpetual offline license. This document is a plan; the backend and deployment have not been implemented.

## Hosting layout

Use a supported PHP 8 release (prefer 8.4 or 8.5 if available), PDO MySQL, OpenSSL, and InnoDB tables. Confirm extensions and actual database version before deployment. No persistent worker process is needed.

Give the subdomain its own document root and HTTPS certificate. Only public entry points and static panel assets belong in that root. Keep application code, database configuration, signing keys, logs, and backups in a sibling private directory that is outside every served document root. Exact paths must come from the hosting panel; do not assume a `/home` layout.

Use a dedicated MySQL database and user. Deploy application files with a dedicated scoped SFTP account, or FTPS with server certificate validation on every connection. Never use unencrypted FTP. Private configuration is provisioned separately and excluded from deployment artifacts. Scope deploy access to this application, not the main website.

Bypass CDN caching for `/api/*`, `/admin/*`, and authenticated responses. Send `Cache-Control: no-store` for these responses. Cache only versioned static assets. Do not rely on CDN challenges that require a browser for desktop API calls.

The API and panel are small relative to the available disk space. Keep game bundles and desktop installers out of this service initially; budget backups and log rotation within the account's disk/inode quota.

## Access protocol

1. The desktop creates a device keypair and registers its public key plus hardware fingerprint. Prefer non-exportable Windows key storage where supported. The HWID is an identifier, not a secret or proof of identity.
2. Each trial entry requests a one-use server challenge and proves possession of the registered device key. The server transaction consumes one of two entries and returns a signed session grant bound to the device and the requesting app session. Include an idempotency key so retrying a timed-out request does not consume another entry.
3. A new app process must request another trial grant. Its private session state is not a reusable perpetual trial license. The official app allows the authorized process to keep running after the connection drops.
4. A paid customer enters a random activation code. The server checks the code, device limit, and device proof, then returns a signed perpetual license bound to the registered device. Activation retries return the same entitlement rather than using additional device slots.
5. On later offline launches, the desktop verifies the signature and device binding before allowing access. It does not contact the server, and the local trial counter cannot grant access.

Use a versioned signed envelope with a key ID, product ID, entitlement ID, device public-key fingerprint, license kind, and issuance timestamp. Trial grants additionally bind to a fresh session identifier. Sign exact encoded payload bytes; do not independently reserialize JSON in PHP and C#. Use a separate service signing key so existing offline serials and release keys are not silently rotated. Verify cross-language signature format interoperability in tests.

Stop accepting legacy serial-only activation in the new online-license mode. Decide how legitimate existing customers will receive replacement entitlements before release. Never regenerate existing game encryption keys as part of setting up the service.

## Trial identity and limits

Store usage in MySQL, not the desktop's files or registry. Tie registration to an identified customer/account or seller-issued evaluation code, plus the registered device. A freely supplied HWID alone lets a modified client claim a fresh identity. Rate limits and duplicate-device checks reduce abuse but cannot prove that every registration is a different physical PC.

Two concurrent trial requests must never grant a third entry: use InnoDB transactions, unique constraints, and locking/conditional updates. Store request IDs and signed grant metadata transactionally to support safe retries and recovery after signing/network failure. A database outage grants no new trial access. An already activated paid copy continues offline.

## Admin panel

- Login with a securely hashed password, rate limiting, secure HttpOnly SameSite cookies, and CSRF protection; add TOTP for administrator access.
- Create customer entitlements and random activation codes, view device activations and trial counts, and reset or replace a device with an audit record.
- Store activation-code hashes, not plaintext codes. Do not log codes, private keys, passwords, or bearer credentials.
- Disable codes to stop future activation. Clearly label that already issued offline licenses remain usable.
- Provide encrypted/off-host database and signing-key backups and bounded log retention.

## Content protection limits

A server counter prevents deleting local state from resetting that registered identity's trial. It does not stop a patched program from ignoring a grant. Remove the embedded universal game key in a separate, tested content-protection change so a UI patch alone no longer supplies decryption material. Use authenticated device-bound delivery if keys are distributed by the service; wrapping a key using a public HWID alone is not protection.

Because these games are standalone local executables, an authorized trial or paid user can still capture a decrypted game or usable key. Non-exportable device keys, obfuscation, and signing raise the effort; none establishes absolute DRM on a customer-controlled PC. Fully offline perpetual use also rules out reliable revocation. Do not promise otherwise.

## Implementation and deployment sequence

1. Implement the PHP API, SQL migrations, admin panel, and isolated tests locally. Test concurrency, retries, exhausted trials, wrong-device requests, invalid signatures, activation reuse, admin authentication, and unavailable database behavior.
2. Implement the C# device registration, trial session grants, perpetual-license verification, and user-friendly connectivity errors. Test PHP-to-C# signatures and offline restarts. Existing real activation/trial state stays untouched during tests.
3. Prepare a deployable artifact and dedicated GitHub Actions workflow using the existing `Osameh.dev` workflow as a reference. Prefer SFTP if the host supports it; otherwise require properly verified FTPS on every connection. Do not copy its disabled certificate-validation setting without equivalent connection-level protection. Pin third-party workflow actions to reviewed commit SHAs.
4. Create the subdomain, dedicated database/user, private directory, and scoped deployment account. Provision secrets privately. Run schema migrations as an explicit deployment step, never through an unauthenticated web installer.
5. Deploy the tested artifact, verify HTTPS/API/admin behavior and cache bypass, and test two trials followed by paid activation on a disposable machine. Verify a paid copy starts offline after reboot.
6. Publish the updated desktop release only after backend readiness and customer migration are verified.

Deployment credentials belong in GitHub environment secrets. Server database credentials and signing keys stay on the host and in secure backups; CI deployments must neither overwrite nor delete them.

## Hosting details still needed

- Exact subdomain document root and private application directory.
- Exact PHP version and availability of PDO MySQL/OpenSSL; MySQL or MariaDB version and InnoDB support.
- SFTP availability for a scoped account, or FTPS hostname/port and certificate trust configuration.
- Database name/user and credentials, provisioned privately rather than pasted into chat or committed.
- Customer identity policy for trials: customer accounts or seller-issued evaluation codes.
- Policy for existing activated customers and allowed device replacements.
