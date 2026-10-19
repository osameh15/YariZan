# Isolated MeliPayamak Admin SMS MFA test

A controlled, short-lived test of the real provider with the real Admin MFA flow (pattern `562281`). It runs entirely on your workstation inside a disposable Docker stack. It is **not** a deployment and never touches production data, signing keys, the public site or the production Backend.

## What is isolated

| Concern | How |
|---|---|
| Database | PostgreSQL 17 in memory, created and destroyed with the stack |
| Data and keys | Synthetic Admins; five independent throw-away keys generated inside the harness |
| Ports | None published. The harness serves its own API only on `127.0.0.1` inside its container |
| Outbound | The harness and database sit on an `internal` Docker network with no route out. A relay container forwards raw TCP to **one** host, `console.melipayamak.com:443`. TLS is not terminated, so certificate and hostname checks stay in the harness. Verified: the provider answers through the relay and `example.com` does not resolve |
| Token and numbers | Typed into the harness terminal (hidden), kept in memory only. Never in a file, argument, environment variable, log or the evidence record |
| Evidence | A redacted JSON file in `tools/sms-test/evidence/` (git-ignored): no token, no number, no code, no URL |

## Budget

Exactly **two chargeable SMS**, one per recipient. No further send is made without a new approval:

- **Recipient A:** Admin MFA code. The harness first submits a wrong code (rejected), then asks you for the real code (one session opens), replays it (rejected), then requests a second code immediately (throttled, no second SMS).
- **Recipient B:** Admin MFA code that you must **not** enter until it has expired (live countdown of 180 seconds). The late code must be rejected.

Provider acceptance and handset receipt are recorded as separate answers: the harness reports whether the provider accepted each request, and you answer whether the handset received it.

## Before you start

1. Open the MeliPayamak panel yourself and compare pattern `562281`: Body ID and the text
   `یاریزان: کد تایید ورود به پنل مدیریت شما: {0} اعتبار: ۳ دقیقه. این کد محرمانه است و نباید در اختیار دیگران قرار بگیرد.`
   The harness asks you to confirm this and records only your yes or no.
2. If the console token was ever shown in a screenshot or chat, rotate it first.
3. Docker Desktop must be running. Have both handsets ready.

## Run (your own terminal, not through chat)

```bash
cd tools/sms-test
docker compose run --rm harness      # builds the backend image once, then prompts
docker compose down -v               # destroys the disposable database and networks
```

Type the token and the two numbers when prompted (nothing is echoed). Enter received codes the same way. Do not paste codes, numbers or the token anywhere else.

## Report back

Send only the redacted evidence file (and say whether each handset received its SMS). From it we record the real provider response shape (`status` vocabulary and `recId` format), tighten the acceptance check, and, in a separate reviewed change, move the seven patterns from owner-attested to panel-verified.

## CI

`--fake-ci` runs the same flow against the in-memory fake provider (no network, no prompts) in the backend test suite (`backend/test/sms-harness.test.ts`), which also asserts that live mode refuses to send without an interactive terminal, that the harness only touches its own disposable database, and that nothing secret is recorded.
