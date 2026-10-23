# G5: anti-abuse without a trusted client address (Option B)

`CUSTOMER_AUTH`, `ADMIN_AUTH` and `DESKTOP_PROVISIONING` depend on `G5_TRUSTED_RATE_LIMITS`. The CDN provider has not documented how forwarded client headers are built. This implementation therefore trusts **no** network address.

Abuse is bounded instead by:
- named global budgets;
- failure-only per-target counters;
- device trust from verified sign-ins;
- isolated SMS lanes;
- a single-use proof of work in front of cost-bearing SMS.

Option A (a CDN-verified client address) stays a possible later defense in depth.

**This change does not open G5.** The gate opens only through a separate reviewed PR, after the acceptance in section 6 has passed and the owner has approved the implementation.

## 1. Why the previous limits were unsafe

Behind CDN → Traefik → Nuxt → API, `req.socket.remoteAddress` is a container. Every limit keyed on it was one hidden global bucket:
- 10 wrong Admin passwords from anyone blocked both owners;
- 30 wrong customer passwords blocked every customer;
- decoy OTP requests could exhaust the single 200/hour SMS budget for everyone.

All such keys are removed. No forwarded header (`X-Forwarded-For`, `X-Real-IP`, `Forwarded`, `X-YariZan-Client`) is read anywhere.

## 2. Controls (implemented)

| Control | Where | Behaviour |
|---|---|---|
| Named global budgets | `security/abuse.ts` `budgets` | Shared on purpose and isolated per purpose: customer login, Admin login, OTP verification, Admin OTP verification, claim, pairing preview/pickup, payment return. A customer flood never consumes an Admin budget |
| Failure-only per-target counters | `Abuse.assertNotThrottled` / `recordFailure` | Only wrong passwords count. The check runs **before** the password hash, so floods stay cheap. Unknown browsers: customer 10 / Admin 5 failures per 15 min per username |
| Device trust | `Abuse.trustToken` / `trusted`, cookies `yz_trust`, `yz_trust_admin` | Issued only after a verified sign-in (customer password or OTP; Admin password **and** SMS). HMAC-signed, HttpOnly, SameSite=Strict, 180 days. Bound to principal and credential stamp (a password change revokes it). A known browser has its **own** counter and is never slowed by a flood against the username. It never skips the Admin SMS step |
| SMS lanes | `accounts/otp.ts` `smsBudgets` | Customer and Admin have separate admission lanes (in-process 20 / 5) and budgets (admission 600 / 60 per hour, delivery 150 / 30 per hour). Admin SMS is only sent after a correct Admin password |
| Decoys | `Otp.issue` | Unregistered targets are admitted, queued and answered exactly like registered ones and **never** consume a delivery budget |
| Silent cost ceiling | `Otp.issue` | An exhausted delivery budget sends nothing but returns the same receipt. It is audited (`otp.delivery_budget_exhausted`) and alerted (`sms_budget_half`, `sms_budget_exhausted` log events), so registration is never revealed |
| Proof of work | `Abuse.challenge` / `verifyPow`, `POST /api/v2/auth/challenge` | Stateless HMAC challenge (one HMAC, no database) bound to purpose (LOGIN, RESET, CLAIM), target (keyed mobile lookup) and a 120 s expiry. The difficulty is identical for every target. Consumed **atomically once**; a replay is refused. Issuance is capped per process. Production difficulty is 18 bits; **friction only, never the sole control** |
| Bounded state | `Security.rate`, `Abuse.purge` | Buckets are stored by window end. Expired counters are purged every 10 minutes (the runtime role may `DELETE` from `rate_buckets` only; `TRUNCATE` stays denied) |
| Browser | `shared/pow.ts`, `app/workers/pow.worker.ts` | The OTP proof is solved in a Web Worker (main-thread fallback). The proxy forwards a trust cookie only to the four sign-in steps, in its exact format |

## 3. Availability guarantee (measurable)

- **G-A (known browser):** a browser holding a valid trust token for an account signs in with the correct credentials while any number of other clients flood that account with wrong passwords. The only bounds are its own failures (10 per 15 min) and the named global login budget (600 per 5 min for customers, 120 per 5 min for Admin).
  - Tested **during a sustained flood** (six alternating rounds).
  - Admin keeps the SMS second factor in every case.
- **G-B (Admin lane):** customer OTP floods, including an exhausted customer admission budget, never prevent an owner from completing password + SMS.
  - Tested by exhausting the customer admission budget, then completing an Admin sign-in.
- **Not guaranteed:**
  - **Unknown browser under a sustained targeted flood:** it is slowed for the window. Recovery is a known browser, the OTP path, or owner recovery (below).
  - **Exhausted global budgets:** a client cannot be singled out without a network identity, so a flood large enough to exhaust a global budget degrades everyone sharing it. That is why each purpose has its own budget, and why the Traefik flood guard and in-flight cap sit in front.

**Owner recovery without revealing account existence:** an owner who loses every known browser while under attack uses the existing server-side enrollment tooling (`tools/admin-enroll.mjs`, operator with sudo) to re-establish access. Nothing public changes its response.

## 4. Proof of work: limits

- 18 bits is about 262,000 SHA-256 evaluations on average. That is trivial for GPUs at scale.
- It exists to make casual bulk SMS and decoy floods cost something per request.
- It does not replace the per-mobile, admission, delivery and cost-ceiling limits above.
- Device dependence: the low-end phone and assistive-technology benchmark in section 6 must confirm the solve time before G5 opens. If it is too slow, the difficulty is lowered, and the other controls still bound cost.

## 5. Residual risks

- **Targeted OTP flood against one mobile:** six per hour per mobile, shared by real and decoy requests so registration is not revealed. It can delay that user's OTP sign-in for up to an hour. Password sign-in from a known browser is unaffected.
- **Global budget exhaustion:** see G-A. Mitigated by per-purpose isolation, the edge flood guard and alerting at half budget.

## 6. Acceptance before G5 can open (not yet done)

1. Run the automated tests below in the **real proxy topology** (CDN → Traefik → Nuxt → API) on staging-equivalent infrastructure, not only against the API directly.
2. Run a capacity test of each named budget and of challenge issuance against the 2-vCPU / 4-GB VPS. Confirm that `/ready` and the public catalog stay available under sustained floods.
3. Benchmark the proof of work on low-end Android phones, an older iPhone and assistive-technology use, and record the solve times.
4. Verify that `sms_budget_half` and `sms_budget_exhausted` alerts reach the owner before the provider's spend cap.
5. Owner approval of this implementation. Then a narrow PR opens `G5_TRUSTED_RATE_LIMITS` and cites this evidence.

**Automated tests (`backend/test/integration.test.ts`, "G5: …"):**
- forwarded-header spoofing;
- sustained targeted flood with a known browser;
- trust token binding (account, signature, password change);
- Admin isolation with SMS kept;
- proof of work required, bound, forgery-proof and single-use;
- decoys not consuming the delivery budget, with identical receipts;
- silent audited exhaustion;
- Admin lane with exhausted customer admission;
- purge of expired counters.

**Browser:** `apps/web/tests/unit/pow.test.ts` checks that SHA-256 matches Node at every block boundary and that the solver satisfies the Backend rule.
