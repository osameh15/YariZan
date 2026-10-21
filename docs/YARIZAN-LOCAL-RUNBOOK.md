# YariZan V2 local integration runbook (Windows workstation)

Local acceptance only. Nothing here deploys, activates real payments or touches production. Everything runs on `127.0.0.1` with disposable data.

## Prerequisites

Docker Desktop (Compose v2), Node.js 24, .NET 9 runtime or SDK (the repository builds with the .NET 10 SDK targeting net9), PowerShell. Inno Setup 6 is needed only for installer generation. The local Grade 1 games live in the ignored `miniApps/1/` and `games_encrypted/1/` folders and `secrets/` (never committed).

## Start the full stack

```bash
cd backend
# 1. once: five distinct random local keys in an ignored backend/.env
node -e "const c=require('crypto'),h=()=>c.randomBytes(32).toString('hex');console.log(['CODE_HMAC_KEY','TOKEN_HMAC_KEY','MFA_ENCRYPTION_KEY','MOBILE_ENCRYPTION_KEY','OTP_HMAC_KEY'].map(k=>k+'='+h()).join('\n'))" > .env
printf 'SMS_PROVIDER=fake\nSMS_FAKE_OUTBOX=.local/sms-dev-outbox.jsonl\nCOMMERCE_MODE=fake\n' >> .env
# 2. PostgreSQL 17 + API + full web (migrations and the development seed run before the API)
docker compose --profile web up -d --build
```

| Service | Address |
|---|---|
| Website, portal, checkout | `http://localhost:3200` |
| Admin | `http://localhost:3200/zanyari` |
| API | `http://127.0.0.1:3100` (`/ready`) |
| PostgreSQL 17 | `127.0.0.1:55432` (user `yarizan`, database `yarizan`; disposable) |

Check: `curl http://127.0.0.1:3100/ready` returns `{"status":"ready","production_gate":"closed"}`. The schema count is whatever `backend/src/database/schema-version.ts` declares (12 at the time of writing: `schema_migrations` must have that many rows). The seed creates six grades at 12,990,000 IRR (Grade 1 published and for sale locally, Grades 2-6 Coming Soon).

## Stop

```bash
cd backend
docker compose --profile web stop api web     # keep the database
docker compose --profile web down             # remove containers, keep the data volume
docker compose --profile web down -v          # also destroy the local database
```

Run the automated suites (`npm test`, `npm run test:e2e`) with the stack stopped: they use ports 3100 and 3200 and a separate database (`yarizan_phase2_test`) on the same PostgreSQL.

## Modes (set in `backend/.env`, then recreate the API)

| Setting | Meaning |
|---|---|
| `COMMERCE_MODE=fake` | in-database payment simulator with browser buttons; no network |
| `COMMERCE_MODE=zarinpal_sandbox` | the real adapter against the OFFICIAL ZarinPal sandbox (`sandbox.zarinpal.com`); refused outside development/test; no real money. Needs `ZARINPAL_MERCHANT_ID` (any random UUIDv4 for the sandbox, never a live merchant ID) and `ZARINPAL_CALLBACK_URL=http://localhost:3200/payment/return` (https, or http on localhost, path exactly `/payment/return`) |
| `LOCAL_TEST_PRICE_G1_IRR=100000` | clearly labelled Grade 1 test price of 100,000 IRR (10,000 Toman). Refused unless development/test with a local commerce mode. Quote, order snapshot, payment, verification and settlement all use it; the official 12,990,000 IRR price and the price history are untouched |
| `COMMERCE_MODE=zarinpal` | the live gateway: refused at startup (gate closed). Do not use |

The ZarinPal sandbox and ZarinPal-hosted pages are reachable only from a normal Iranian connection. While a foreign VPN or tunnel is active the handshake fails; disconnect it for sandbox tests.

## Local Admin enrollment (synthetic, first round)

Use the operator command from `docs/YARIZAN-OWNER-ADMIN-ENROLLMENT.md` with synthetic usernames and the fake SMS provider; real identities and phones are entered privately only, never committed. This local enrollment is not production Admin provisioning.

## Controlled real SMS

Only through the isolated harness, never from the full-stack containers: `tools/sms-test/README.md`.

## Windows application

```powershell
dotnet build src/YariZan.App -c Release
dotnet run --project tests/V2Checks            # or tests/Run-V2Checks.ps1 for the full suite
```

Local acceptance uses explicitly labelled disposable development trust roots; they are never put in a commercial installer.
