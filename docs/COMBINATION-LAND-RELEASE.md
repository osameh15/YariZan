# سرزمین ترکیب‌ها

Owner request, 2026-11-09: separate licensed product, 399,000 toman list price and
299,000 toman offer until disabled. SKU `YARIZAN-S-COMBINATION-LAND`, slug
`combination-land`, version `1.0.0`. The original game is I386; the self-contained
launcher is built separately for win-x86 and win-x64. The combined installer chooses
the correct launcher. Game payloads use the existing SKU-derived encryption key;
licenses, activation, two trial starts, account entitlements and device restrictions
remain bound to the full SKU.

Build: `powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-Standalone.ps1 -Product combination-land`.
Outputs are in `publish/YariZan-CombinationLand-win-x86`,
`publish/YariZan-CombinationLand-win-x64`, and
`publish/YariZan-CombinationLand-Setup-v1.0.0.exe` with its SHA-256 sidecar.
The evidence JSON records the exact installer size and hash.

The shared product catalog supplies the storefront, Admin selectors, coupons,
product promotions, checkout and account labels. New coupons remain unchecked;
an Admin explicitly selects eligible products. Existing promotion/coupon rules
still prevent coupons from stacking with the product offer.

The no-scheduled-end offer uses the documented timestamp `9999-12-31T00:00:00Z`.
Migration 020 permits that value while retaining the one-year limit for dated
offers. Admin can select no end date and deactivate the offer normally. Public
prices show no invented expiry or countdown.

After migration and coordinated web/API deployment, initialize with an authorized
owner's UUID and the migration database environment:

```sh
node tools/launch-combination-land.mjs --admin=OWNER_UUID
```

The script uses the existing promotion service and audit history. Re-running it
preserves later Admin decisions and never restores a previously disabled offer.
This revision's catalog update touches only the new standalone product.

The installer record stays unpublished until the download mirror is verified.
Publish it under `windows/products/combination-land/1.0.0`, verify the immutable
URL/hash, then set its release record `published: true`. Infrastructure mirror
allowlists must include `combination-land`. No live upload or deployment is
recorded by this document. Physical Windows x86/x64 activation/game acceptance
and a real game screenshot are still needed; the web uses a title tile meanwhile.

Migration 020 follows the already-deployed blog migrations 017-019. Migration 021 adds the two new article drafts. The combined release has 21 migrations and preserves all eight article drafts.

## Validation and release state

The combined blog/product worktree is `.local/blog-experience` from the main workspace.
Backend compilation and 31 core tests, 35 focused web tests, TypeScript checking,
42 standalone desktop checks and 21 release workflow checks pass. The root Windows
build produced both self-contained architectures and the combined installer; the
version, production API marker and checksum checks passed. Database and browser
integration tests could not start because PostgreSQL at port 55432 and Docker
Desktop were unavailable. The broader desktop suite stops at an existing commercial
MSBuild prerequisite test; focused standalone checks pass.

The sibling infrastructure repository now allows the download namespace and checks
its publication in mirror CI. Its deployment scripts select the new pricing revision
for schema 21 and preserve `YARIZAN_OFFER_ADMIN_ID` from the existing application
`.env`. Set that field to the approving owner's UUID before rollout. The deployment
runs the audited offer initialization before enabling the new product. The actual
manifest image digests and public download availability have not been fabricated.
