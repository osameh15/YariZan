# G5: trusted client identity and anti-abuse (design for owner decision)

`CUSTOMER_AUTH`, `ADMIN_AUTH` and `DESKTOP_PROVISIONING` depend on `G5_TRUSTED_RATE_LIMITS`. This document records why the gate is closed and the two acceptable ways to open it. It also lists the tests that must pass before the gate opens.

## 1. Why the current limits are unsafe in production

Behind CDN → Traefik → Nuxt proxy → API, `req.socket.remoteAddress` is a container address, never the client. Every limit keyed on it is therefore one shared bucket for all clients:

| Limit (source) | Key today | Effect in production |
|---|---|---|
| request floor (`main.ts`) | `ip:` + socket, 600/min | One noisy client consumes the floor for everyone |
| customer login (`controllers.ts`) | `customer-login-ip:` + socket, 30/5 min | 30 wrong passwords from anyone block **all** customer logins for 5 min |
| admin login (`controllers.ts`) | `admin-primary-ip:` + socket, 10/5 min | 10 wrong passwords from anyone block **all Admin logins**, including both owners |
| account claim (`controllers.ts`) | `claim-ip:` + socket, 120/5 min | shared claim budget |
| pairing preview (`controllers.ts`) | `pairing-preview:` + socket, 60/5 min | shared preview budget |
| OTP (`otp.ts`) | `sms-global` 200/h; `otp-phone:` 6/h; in-memory 20 admissions | decoy requests for unregistered numbers count too, so anyone can exhaust the global SMS budget and block OTP for everyone for an hour |
| per target (`customer-login:`, `admin-primary:` + username) | username | correct per account, but anyone who knows a username can lock that account out |

The Traefik flood guard (40 r/s, burst 80, per CDN egress node) protects the VPS, not individual accounts.

## 2. Option A: verified client address from the CDN (preferred when possible)

Precondition: Pars Pack documents how `X-Forwarded-For` / `X-Real-IP` are built, and confirms a client-supplied value cannot survive (infrastructure README §5, request #3).

1. Lock the origin to the official CDN ranges (`oarnova-origin-lockdown`, already prepared). Without this, the header proves nothing.
2. Traefik `forwardedHeaders.trustedIPs` = the verified CDN list. Traefik then produces one trusted client address.
3. The Nuxt proxy forwards exactly one `X-YariZan-Client` header, set from that verified value. Any inbound copy is overwritten.
4. The API trusts that header **only** when the TCP peer is the web container (or Traefik for desktop routes); otherwise it uses the socket.
5. The existing per-IP keys become real per-client limits. Per-target and global limits stay.

Evidence required:
- a forged `X-Forwarded-For` sent from outside through the CDN never reaches the API as the client address (`acceptance-external.sh`);
- direct-to-origin requests are refused by the lockdown.

## 3. Option B: no client address (if the CDN facts stay unavailable)

No per-IP control exists. Abuse is bounded by identity, cost and work instead.

1. **Remove every socket-keyed limit.** They are hidden global limits that let one client lock out everyone. Replace each with a **global budget sized to capacity** (shared on purpose and named as such), plus the controls below.
2. **Failure-only, per-target limits with no hard lockout.** Count only failed attempts per username or mobile, using exponential back-off (1, 2, 4 … 60 s) instead of a fixed window. A correct password and second factor always succeed after the back-off, so an attacker can slow an account but never lock it out for long.
3. **Admin separation.** Admin login has its own budgets, never shared with customers. Owner usernames are private and not shown anywhere public. A short back-off per Admin username plus the SMS second factor keeps online guessing infeasible.
4. **Cost-bearing SMS behind proof of work.** Before an OTP is sent:
   - the API issues a stateless HMAC challenge (purpose, target hash, expiry);
   - the browser or app solves a SHA-256 proof of work (for example 20 bits, about 1 s on a phone);
   - each solution is single-use.

   This makes bulk SMS and decoy floods expensive without third-party CAPTCHA or tracking. Separately:
   - decoys (unregistered numbers) get their own budget and never consume the delivery budget of real users;
   - per-mobile limits stay;
   - the global SMS budget is a hard cost ceiling, alerting at 50%.
5. **Device-bound flows.** Requests that carry a device credential (desktop) are limited per device and per customer, as today. Those keys come from server-issued credentials, not from the network.
6. **Edge.** Keep the Traefik flood guard and in-flight cap. Add a low-rate route-specific guard on the login and OTP paths.

Tests required before G5 opens:
- **Spoofing:** forged `X-Forwarded-For`, `X-Real-IP`, `Forwarded` and `X-YariZan-Client` headers from a non-trusted peer change nothing.
- **Isolation:** 1,000 failed logins against account A never slow account B; Admin budgets are unaffected by customer floods and the reverse.
- **No lockout:** after a flood against account A, the legitimate owner of A still signs in within the bounded back-off.
- **SMS cost:** a decoy flood cannot consume the real-delivery budget; without valid proof-of-work solutions, OTP is never sent; a solution cannot be replayed.
- **Collision:** keys are HMAC-namespaced per purpose, so the same value used for a username, a mobile and a device id never shares a bucket.
- **DoS:** sustained floods stay within the Traefik guard and API global budgets, and `/ready` and the public catalog stay available.

## 4. Decision needed (owner)

- **A** needs Pars Pack's written answer and the origin lockdown switched on (owner, sudo). It is the most precise option.
- **B** needs only reviewed code. It changes the login and OTP experience (an invisible proof of work of about 1 s on OTP requests, and short back-off after failures).

Either option ends with a reviewed PR that opens `G5_TRUSTED_RATE_LIMITS` and cites the test evidence above. Until then, customer and Admin authentication stay disabled in production. The core capability (catalog, health) is unaffected.
