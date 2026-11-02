# Independent games and the 2026-11-02 catalog update

Owner request: add «عددساز کوچولو» as a separate product at **199,000 Toman**,
with the G1 activation experience, two trial starts, and x86/x64 launchers. The
approved Grade 1 price becomes **1,499,000 Toman**. This document describes the
prepared change; it does not record a production deployment or installer acceptance.

## Product identity

| Product | SKU | Protocol grade | Price (integer IRR) |
| --- | --- | --- | --- |
| Grade 1 | `YARIZAN-G1` | 1 | 14,990,000 |
| عددساز کوچولو | `YARIZAN-S-NUMBER-BUILDER` | 0 | 1,990,000 |

Grades 2–6 match the 14,990,000 IRR the owner already set live in Admin and keep their availability. The approved revision is
`pricing-2026-11-02-r1`; the web and backend copies must match.

Migration **015** adds a separate `YARIZAN-S-…` namespace. Grade 0 means an independent
game, never Grade 1. A partial unique index preserves one product per real grade;
multiple independent products can coexist. Trial counters, restrictions, orders,
activation codes, entitlements, local license files and purchase-wait markers remain
bound to the full SKU. Signed V2 artifacts carry grade 0 and the exact independent SKU.
The old grade launchers cannot accept an independent game's license.
The standalone executable also fixes its SKU at compile time, so editable bundle metadata
cannot switch its license identity. Standalone payload encryption uses a domain-separated,
SKU-specific HMAC-derived game key; copying that ciphertext into a grade package does not
make it decryptable with the grade's existing game key.
Existing G1 executables receive only grade SKUs from the device entitlement summary.
Updated clients opt in with `X-YariZan-Product-Catalog: standalone-v1` to include independent
games. This preserves old clients' automatic activation when the same customer buys both
types of product; the header never grants access or replaces signed license verification.

## Windows behavior and building

`miniApps/عددساز کوچولو/` must contain exactly one game executable. Packing an
independent game writes a separate bundle and leaves the G1 catalog intact. The
current source game is an x86 executable and can run on both supported architectures.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/Build-Standalone.ps1
```

The build checks the existing reviewed production public roots and activation
configuration. It encrypts the game, publishes self-contained x64 and x86 launchers,
checks their production API and version, and creates a combined installer:

- `publish/YariZan-NumberBuilder-win-x64/YariZan-NumberBuilder.exe`
- `publish/YariZan-NumberBuilder-win-x86/YariZan-NumberBuilder.exe`
- `publish/YariZan-NumberBuilder-Setup-v1.0.0.exe` and `.sha256`

The installer selects the matching launcher on Windows 10/11. Keep the adjacent
`games_encrypted` folder when running either portable build. Rebuilding stages and
verifies new output first and preserves earlier outputs in a temporary recovery folder.

Startup shows the OAR NOVA Games splash in a centered **400 × 400** logical-pixel window
for at least about two seconds while the saved license's signature, product/device binding
and cached revocation decision are verified locally. A verified local paid
license shows the «آماده‌سازی برنامه…» modal and runs the single game. Independent games have
no cover, information or book pages; grades keep Lock, cover, information, books.
Otherwise the compact G1-style activation page shows the YariZan logo and the independent
game's name, account connection, manual activation code, support, purchase and
«آزمایش نسخه». After activation or a trial start the same modal appears on the activation
page and the game runs, with no second splash. Two trial starts are allowed per device/product/account allocation;
each start needs the existing secure enrollment and server approval. Trial retries in
the same process do not consume another start. When the game exits, its launcher exits,
so a later launch cannot reuse a previous trial process. Paid offline access remains
signature-verified and independent of network availability.

## Website

`/special-products` and `/special-products/number-builder` reuse the grade card and
detail design. Header, mobile navigation, homepage, account, orders, Admin product
actions, promotions, coupons and checkout recognize the new product. `/products`
continues to list the six grade packages. `/download?product=YARIZAN-S-NUMBER-BUILDER`
selects the independent game's Windows download instructions.

`apps/web/shared/standalone-releases.ts` controls public download eligibility. The local
installer alone never enables a public link. After owner acceptance and verified mirror
publication, add/enable its exact version, filename, byte count and SHA-256 there.

## Price and host rollout

The new price is applied as an appended price-history row. Existing orders and payment
amounts remain immutable. A named, audited rollout applies the approved G1 price and
enables the independent game. It refuses to change a list price under an active or
scheduled promotion. A transaction-level advisory lock and completion audit marker
make it a once-per-revision operation: subsequent deployments preserve later Admin
price and availability decisions.

```sh
node dist/src/database/production-bootstrap.js \
  --initialize-prices=pricing-2026-11-02-r1 \
  --publish-approved-catalog=pricing-2026-11-02-r1
# After the new API and web containers run, before acceptance:
node dist/src/database/production-bootstrap.js \
  --apply-product-update=pricing-2026-11-02-r1
```

The independent game stays hidden until the second command, because web builds older
than this release reject a grade 0 row and would fail the whole catalog. The `up -d`
step therefore comes first, and the old site never sees the new row.

The matching changes in `oarnova-infrastructure` support both the existing schema-14
release and a new schema-15 release. A schema-15 manifest selects the new approved
pricing revision, runs the explicit product update after the new containers start and validates the
G1 and independent prices. Existing image digests and the deployed release manifest
have deliberately not been replaced with unbuilt or unreviewed artifacts.

Release sequence after owner approval:

1. Test the new installer, activation and game on real 32-bit and 64-bit Windows.
2. Scan and approve the exact installer; upload it to VPS staging and verify its SHA-256.
3. Deploy the reviewed downloads configuration and run the mirror tool's `init`, then
   publish the independent installer using its separate namespace:

   ```sh
   sudo /opt/oarnova/apps/yarizan/host/yarizan-release-publish.sh publish \
     --product number-builder --version 1.0.0 \
     --file /path/to/YariZan-NumberBuilder-Setup-v1.0.0.exe --sha256 APPROVED_SHA256
   ```

4. Verify the immutable link, size, range support and checksum; enable the matching
   website release record. This operation never changes a grade's `latest` pointer.
5. Build and approve new full-stack images; update the infrastructure manifest with
   their actual digests and migration count 15. Back up the database and deploy the
   coordinated application/infrastructure change through the existing owner workflow.
6. Verify product prices, a new purchase and license pickup, trial limits, and downloads.

Production upload/deployment and installer acceptance remain owner actions. Database
migrations are forward-only; a schema-14 application is not an automatic rollback
target after migration 015.

## Adding another independent game

Assign its own `YARIZAN-S-…` SKU, approved price, title, slug and source folder. Add its
catalog entry and reviewed build/store/download mappings, then use the same license
and trial infrastructure. Do not assign it a grade SKU or reuse another product's license.
