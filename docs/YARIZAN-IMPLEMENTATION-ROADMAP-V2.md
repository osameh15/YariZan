# YariZan V2 — Delivery Roadmap and Release Gates

> **Status:** Planned. Approved product requirements, unimplemented target engineering work. See [Technical specification](YARIZAN-TECHNICAL-SPEC-V2.md), [Data model](YARIZAN-DATA-MODEL-V2.md), and [API contracts](YARIZAN-API-CONTRACTS-V2.md).

## 1. Baseline and no-go rules

Baseline as inspected 2026-10-14: `main` commit `12e6553fc6748c2a5bb551dc887957f11e3098c3` has Windows WPF/.NET 9, PHP/MySQL online-only licensing, current per-HWID paid serial, two shared-HWID trial entries, grade-specific packages, packaging/launcher tests and existing GitHub Release 1.1.0. That binary was not commercially launched. **No V2 features have been built or tested by approving this roadmap or committing these documents.**

Only documentation may be changed in the documentation approval step. No application code, workflow, schema, credentials, key generation, live host, DNS or deployment without the next implementation/release approval. Keep legacy service functioning until a separate cutover decision.

## 2. Sequential milestones and exit criteria

### Phase 0 — Architecture, decisions and safety baseline

- Freeze approved V2 requirements; version API/DB/security assumptions and threat model.
- Set Windows fingerprint/username determinism and TPM/software-key fallback ADR.
- Set canonical license bytes, public-key trust, signed revocation decision format and recovery ADR.
- Set order and discount concurrency design and change-control rules.
- Baseline game build, current installer, tests, private asset boundary; test backup/restore on isolated fixtures.
- **Exit:** signed-off OpenAPI baseline, SQL/Prisma migration plan, threat model, acceptance tests, no production changes.

### Phase 1 — Desktop device identity and offline access

- Shared `DeviceIdentity` component used identically in G1..G6; separate device private key from public username.
- Local signed perpetual license validation by product and device; offline after first activation, no expiration.
- Trial Lock status online and `Start trial` one-shot signed grant per device/grade; **no ongoing online requirement after entry**. Trial ends on process exit.
- Non-blocking startup paid sync; authenticated persisted revocation only; preserve WPF book and game-launch UX.
- Unit/integration tests with synthetic signed fixtures, offline cut, reboot, multi-grade keys.
- **Exit:** full-hour offline trial within live process (network cut), relaunch consumes next online entry; perpetual licensed launch works offline after reboot; G1 never opens G2.

### Phase 2 — Backend core and PostgreSQL

- Scaffold NestJS modular monolith, PostgreSQL and pinned compatible migration tool.
- Implement product catalog (six grades), Admin catalog price/status controls, account claim, device challenges/pairing, password sessions and RBAC.
- Implement server-authoritative trial counts, idempotent starts, signed license issue/revocation/sync, audit and outbox.
- All new data in disposable dev/staging only.
- **Exit:** migration reversibility tested on disposable DB; API contract + C# verification vectors pass; parallel trial starting behaves exactly once.

### Phase 3 — Nuxt 4 store, customer and Admin portals

- Persian RTL accessible Nuxt 4 public store, product/grade pages and launch/download UX.
- Customer connect/claim/password/login/orders/devices/licenses; Admin `/zanyari` with role-gated products, manual license issue, device block, trial reset, and history.
- G2..G6 appear as Coming Soon with disabled purchase/activation enforced in API.
- **Exit:** responsive desktop/mobile UI and auth/authorization E2E, no HWID-only claim.

### Phase 4 — Discounts, checkout and ZarinPal

- Admin coupon authoring: percentage/fixed, max usage, per-account use, start/end, grade scope, cap and enablement.
- Order snapshot, quota reservation, immutable payments, adapter and ZarinPal test merchant integration (confirm money unit), server-side verification and reconciliation.
- Paid fulfillment automatically binds SKU/device, signs license, delivers via authenticated desktop pickup. Exactly-once business outcome with idempotent retries.
- **Exit:** concurrent coupon limit, duplicate callbacks, unknown payment, client disconnect, successful checkout-to-offline playback validated in staging.

### Phase 5 — Support, refund and future SMS adapter

- Refund request review/approval, gateway transaction outcome and auditable delayed revocation semantics.
- Support-assisted password reset Phase 1 with independent ownership check and one-use temporary credential, forced password change, session invalidation.
- Prepare MeliPayamak adapter and verified-phone reset-link workflow as **later optional release**. Do not require SMS for initial commercial launch.
- Reports, retention and access logs; admin MFA required for payment-related live operations.
- **Exit:** zero silent losses of paid events; refunds separate from revocations; privilege boundary/ownership evidence tested.

### Phase 6 — Hardening, operations and commercial launch

- Validate clean Windows install, actual G1 protected game files, 6-grade identity matching, offline session behavior, installer signing/hash and proper game manifest.
- Capacity test on shared 2 vCPU/4GB Frankfurt VPS (other studio apps must be considered); off-site backup and restore test; TLS/CDN bypass for dynamic APIs, monitoring and alerting.
- Run staging live-like flow; verify customer terms/refunds/invoice and actual ZarinPal merchant readiness.
- Deploy only following explicit release approval; enable G1 only, preserve toggles for G2–G6.
- **Exit:** documented go/no-go, rollback/roll-forward, operational runbook, release artifact checksums, smoke tests and confirmed sales reconciliation.

## 3. Required acceptance tests

| ID | Scenario | Pass |
|---|---|---|
| T-01 | Open G1..G6 on one supported device | Same displayed username |
| T-02 | G1 paid license loaded in G2 | Rejected |
| T-03 | G1 no license, inspect trial | No trial consumed |
| T-04 | Start G1 trial online, disconnect, play over 60 min/switch games | Continues; no heartbeat/network check |
| T-05 | Close G1 process, relaunch offline without paid license | Lock; cannot start trial until online |
| T-06 | Two distinct starts + duplicate retries per (device,G1) | Exactly two entries consumed, third denied |
| T-07 | Install & activate paid G1, restart offline, play | Allowed forever while binding/signature valid and no cached revocation |
| T-08 | Paid G1 startup with API timeout | Play proceeds; errors only informative |
| T-09 | Provider verifies same payment twice | One fulfilled entitlement for order item |
| T-10 | Parallel last-coupon checkout | Never exceeds quota |
| T-11 | Paid order + fulfillment worker crash | Idempotent recovery; no double payment/license |
| T-12 | Unknown payment | No premature issue; reconciliation queue |
| T-13 | Password claim by knowing HWID only | Denied |
| T-14 | Admin manual issue/refund | MFA/RBAC, owner+product binding and immutable audit |
| T-15 | Device blocked/refunded | Finance history preserved; signed revocation at next paid sync |
| T-16 | Coming-soon G2 purchase attempt | Server rejects |
| T-17 | Restore staging backup with signing materials | Artifacts verify; no lost historical records |
| T-18 | Verify real Windows WPF installer | No missing games/keys; grade correct |

## 4. Workflow and branching

- Implement in small reviewed increments, ideally feature branches and PRs with independent tests before merge. No direct production deployment in feature work.
- Use Conventional Commits and docs first; update this roadmap plus OpenAPI, schema, threat model and installation runbook when behavior changes.
- CI: separate desktop Windows jobs, NestJS/Postgres integration, Nuxt accessibility/E2E, provider mock/sandbox, secret scanning, release artifact integrity; production promotion manual and environment-protected.
- Publish initial G1 only after final gate; G2–G6 remain discoverable in catalog without purchases until separately approved.
- Current GitHub Actions `licensing.yml` deploys on changes under `web/licensing/**`. New V2 pipeline MUST have safe environment protection and explicit release gates; do not accidentally trigger old FTPS deployment when adding new work.

## 5. External dependencies and blockers

- Production signing key custody/backup rotation, Windows code-signing certificate, ZarinPal active merchant configuration and exact settlement/currency contract.
- Support verification checklist and consumer sale/refund terms, optional verified customer phone enrollment for later SMS reset.
- Object storage/CDN for ~1GB G1 installer, checksum and rights to distribute packaged games.
- Shared VPS resource budget and backed-up PostgreSQL plan; resilience/availability for Iranian end users.
- Security ADR for anti-claim spoofing, hardware change policy and non-exportable key fallback.

## 6. Change policy

Approved business behavior (per-grade perpetual offline, one device, two online-to-start trials per grade, no trial heartbeat, one stable account/device, initial price 1,299,000 Toman, discounts, ZarinPal, admin-reviewed refunds and SMS-later) must not silently change. Any conflict between existing online-only code/docs and this planned design is resolved by explicitly labeling the **current code as legacy** and treating the V2 specification as the approved future contract.
