# YariZan ZarinPal contract evidence and readiness matrix

Scope: the server-side ZarinPal adapter in `backend/src/commerce/gateway.ts` and its settlement in `backend/src/commerce/payments.ts`. The production commerce gate is unchanged: `COMMERCE_MODE=zarinpal` is still refused at startup (`ZARINPAL_LIVE_GATE_CLOSED`). The merchant account is provisioned but not activated. No real payment has been attempted and none is possible.

## 1. Documented contract (confirmed by the owner from the official docs)

Sources: the official ZarinPal Node SDK documentation (`request`, `verify`, `inquiry`, `configuration`) and the `ZarinPal/ZarinPal-node-SDK` repository.

| Fact | Adapter behaviour |
|---|---|
| Request fields: `amount`, `description`, `callback_url`, optional `currency` | Sends exactly `merchant_id`, `amount`, `currency`, `description`, `callback_url`. A test asserts this key set. |
| Default currency is `IRR`, `IRT` is supported | Always sends `currency:"IRR"` explicitly. All stored amounts are IRR integers. |
| Minimum is 10,000 IRR | `create` rejects less than 10,000 and any non-safe-integer amount. |
| Verify uses the original `authority` and the original order amount | `verify` sends the attempt's stored `authority` and `amount_irr` from the database. Callback query values are never used as an amount. |
| Code 100 = verified | Accepted as a new verification when a positive numeric `ref_id` is present. |
| Code 101 = previously verified | Accepted only with order-bound evidence (section 3). |
| Authority is issued by the request call | 36-character form (`A` plus 35) accepted; pattern is alphanumeric-only so it cannot alter the StartPay URL path. |
| Redirect | `https://payment.zarinpal.com/pg/StartPay/<authority>` built server-side from a validated authority. |
| The SDK shows merchant ID and sandbox configuration | Merchant ID is a private secret (UUID shape checked at construction). The sandbox is not used. |

## 2. Settlement invariants (enforced and tested)

- The server decides the SKU and price. A full-price grade is 12,990,000 IRR unless the order's stored discount snapshot changes the total. The client cannot send an amount.
- `settle` accepts a verified result only when the result's authority, amount, currency, merchant configuration and a non-empty reference all equal the stored attempt. Any mismatch moves the attempt to `UNKNOWN` and records a `VERIFICATION_MISMATCH` exception for reconciliation.
- A provider reference can belong to only one attempt (advisory lock plus unique business key). A reused reference records `REFERENCE_REUSED` and never grants a second entitlement.
- One accepted payment per order. A second captured attempt records `DUPLICATE_CAPTURE`.
- Browser callback parameters are untrusted: the callback only schedules a server-side verify job.
- Timeouts, malformed bodies, oversized bodies, redirects and transport errors all produce `UNKNOWN` (never paid). The adapter never retries inside one call.
- Fulfillment is a separate durable job (`FULFILL`) and is idempotent per order item. The purchase SMS is a separate durable notice and is sent at most once.

## 3. Code 101 policy

101 means the authority was already verified by an earlier call. It is not proof that this server captured the payment, so it is not treated as a new capture by default.

- Before every provider verification call the job writes a `verify_requested:<attempt>` event. When the provider returns a parsed, documented answer it writes `verify_answered:<attempt>`.
- A 101 result is accepted only when an earlier call for the same attempt was requested and never answered (a lost or timed-out response that may have captured the payment). The check reads that state before the current call writes its own marker.
- Any other 101 (first call, or an earlier call that was answered) leaves the attempt unpaid and records the `ALREADY_VERIFIED_UNPROVEN` exception. Resolving it needs the existing Admin reconciliation process with evidence from the ZarinPal panel.
- A status check is now a single server-side verify call. The adapter no longer calls inquiry (see section 5).

Tests: unit tests for 100, 101, other codes and transport failure; integration tests for an unexplained 101 (no capture, repeated 101 still no capture) and a 101 after an unanswered call (captured once, one fulfillment).

## 4. Readiness matrix

| Item | State | Evidence or blocker |
|---|---|---|
| Request, authority, redirect, verify mapping | Implemented, mocked | `commerce.test.ts`, `integration.test.ts` |
| Currency and minimum | Implemented | IRR explicit, 10,000 IRR floor |
| Code 100 / 101 semantics | Implemented | section 3 |
| Idempotent settlement and fulfillment | Implemented | duplicate-worker and replay integration tests |
| Merchant ID handling | Private only | `ZARINPAL_MERCHANT_ID` is a validated optional UUID setting; never committed, logged, echoed in errors or sent to the browser; nothing consumes it while the live gate is closed |
| Merchant activation | **Blocked (owner)** | account provisioned, not activated |
| Callback domain acceptance | **Unverified** | assumption: ZarinPal accepts only the merchant's registered domain; confirm in the panel before cutover |
| Callback query parameter names (`Authority`, `Status`) | Assumed from the SDK | used only to schedule a verify; confirm in a sandbox or activation test |
| Provider error codes other than 100 and 101 | Answered, never settling | a negative code in a 4xx body (the real sandbox sends `-50`, `-51` with HTTP 401) is recorded as an answered refusal and leaves the attempt `UNKNOWN`; a 5xx stays unanswered |
| Inquiry endpoint status vocabulary | **Mapped, evidence only** | `VERIFIED`, `PAID`, `IN_BANK`, `FAILED`, `REVERSED` (section 10); never used to verify or capture |
| Sandbox | **Real official sandbox round trip done (2026-10-21)**, plus local fake server tests | the real adapter, in `sandbox` mode, runs through `Payments` against a local HTTP server that mimics the documented request and verify contract (section 7). No request reached `sandbox.zarinpal.com` and no real money is involved; official sandbox behaviour is still unvalidated until a merchant-capable sandbox run |
| Refunds and reversals | **Unresolved** | no refund method exists in the adapter; refund needs a reviewed API contract or panel process and explicit order states |
| Settlement timing and fees | **Unresolved** | merchant-specific; needs the activated account and finance sign-off |
| Reconciliation | Implemented (section 10) | every answered non-success verify is followed by one inquiry; observations are append-only; only a repeated, spaced `FAILED` ends an attempt; Admin reconcile route and exceptions for the rest |
| Egress to `payment.zarinpal.com` | **Not built** | API container has no unrestricted egress; needs the restricted-egress infrastructure PR |
| Legal pages, merchant information | **Not started** | needed for merchant activation review |

## 5. Why inquiry never verifies

The previous adapter called inquiry and then verify inside one status check, and the job then called verify again. That made a real capture look like a 100 followed by a 101. The status check is still one verify call. Inquiry runs only after verify gave a documented non-success answer, and it is reconciliation evidence only (section 10). ZarinPal's own inquiry page says never to use it to verify a transaction.

## 6. Official documentation MCP verification (2026-10-19)

The public documentation MCP (`https://www.zarinpal.com/docs/mcp`, tools `list_docs`, `search_docs`, `get_doc`, `get_error_code`; no token, documentation only) was queried directly. Results used here:

- `get_error_code` 100 = "Success" (public) and 101 = "Verified" (PaymentVerify, "the transaction has already been verified"). This matches the adapter and the section 3 policy.
- The sandbox page: replace `payment.zarinpal.com` with `sandbox.zarinpal.com`; every authority received from the sandbox starts with `S`; any UUIDv4 is accepted as the merchant ID in the sandbox.
- Doc pages for `request`, `verify`, `inquiry`, `unVerified`, `currency` and `session-validation` exist under `/paymentGateway/`. Their full review for the inquiry vocabulary and the unverified-payments method is still open.

Connection note: Claude Code's MCP client failed with `ECONNRESET` because the workstation HTTP proxy cannot reach `zarinpal.com`; direct requests work (`--noproxy '*'`). This is a workstation setting, not a provider outage. The MCP is documentation-only and must never receive a merchant or access token.

Not consumed: `ZARINPAL_ACCESS_TOKEN`. The documented v4 REST contract used here needs only the merchant ID, so no code reads an access token. Do not keep a credential on the server that nothing uses.

## 7. Adapter and settlement against a local sandbox-shaped server

`PaymentGateway` gains `acceptCreated(created, orderId)`: a provider says exactly which authority and redirect it issues, and `Payments` refuses anything else (fail closed, ambiguous creation). `FakeZarinPal` keeps its `FAKE-` rule; `ZarinPalAdapter` accepts only an authority matching its environment (`A...` production, `S...` sandbox) and the redirect `https://<host>/pg/StartPay/<authority>`. The browser return route now accepts `A` and `S` authorities (still strictly alphanumeric, so nothing can alter a URL).

Integration tests (`backend/test/integration.test.ts`, "Sandbox adapter"; a local HTTP server stands in for the sandbox and the adapter transport rewrites the host to loopback):

| Behaviour | Evidence |
|---|---|
| Request contract | exactly the documented fields, IRR, amount equal to the server-computed order total, no client price field |
| Sandbox authority and redirect | authority matches `^S...`, redirect is the sandbox StartPay URL; `A...`, foreign hosts and the production host are refused |
| Original-amount binding | every verify call carries the order's stored total and stored authority, never a callback value |
| Callback | a browser return only schedules verification; no entitlement before verification; an unknown authority is `NOT_FOUND` |
| Codes 100 and 101 | first verify 100 settles once; duplicate callbacks and workers grant nothing more; 101 with no prior unanswered call is `ALREADY_VERIFIED_UNPROVEN` and captures nothing |
| Amount mismatch | the provider refusal leaves the attempt unknown and the order pending |
| Outage and timeout | HTTP 503 answers stay pending; the retry settles exactly once, one fulfillment, one entitlement |

Still unvalidated against the real sandbox: callback query parameter names, non-100/101 code vocabulary, inquiry and refund methods, merchant activation behaviour. `COMMERCE_MODE=zarinpal` remains refused at startup.

## 8. Payment hostname, DNS, TLS, egress, callback and activation (evidence, 2026-10-21)

Each row is evidence for one question only. A passing row never implies the next.

| Item | State | Evidence or blocker |
|---|---|---|
| Custom payment hostname registered | Owner-reported | `pay.yarizan.oarnova.games`, CNAME to `zpc.zarinpal.com`, merchant IP restriction enabled |
| Authoritative zone | **Verified** | `oarnova.games` is served by `lake.parspack.net` and `fish.parspack.net` (Pars Pack). There is no delegation of `yarizan.oarnova.games`, so the record host is `pay.yarizan` in the `oarnova.games` zone |
| DNS record | **Verified** | both authoritative servers answer `pay.yarizan.oarnova.games CNAME zpc.zarinpal.com` (TTL 300); 8.8.8.8 and 1.1.1.1 return the same alias, resolving to `45.89.138.240`. The record already existed; this change did not create or alter DNS |
| Not routed through the CDN, Traefik or the VPS | **Verified** | `yarizan.oarnova.games` resolves to `185.239.1.100` (CDN); the payment host resolves to ZarinPal's `45.89.138.240`. No infrastructure config references the payment host |
| TLS on the payment host | **Verified** | served by ZarinPal: Let's Encrypt certificate for `pay.yarizan.oarnova.games` only, valid 2026-10-19 to 2027-01-17, verification result 0, HTTP 200 |
| ZarinPal domain confirmation status | **Unverified (owner)** | shown only in the merchant dashboard; this change cannot read it. DNS and TLS being healthy is necessary, not proof that the dashboard shows "confirmed" |
| Meaning of the custom hostname for the API | **Unresolved** | the official documentation corpus (documentation MCP, 2026-10-21) contains no custom-domain page. Observed: the custom host serves ZarinPal's web app and a `405` on the API path, and the API host `payment.zarinpal.com` still answers. Whether API-generated StartPay redirects should use the custom host is not documented, so the adapter is **not** changed (`https://payment.zarinpal.com/pg/StartPay/<authority>` stays). Ask ZarinPal support to confirm in writing, with the exact redirect form to expect |
| Outbound IP allowlist | **Identified, not registered/verified** | the VPS reaches the internet from `82.115.18.101` (checked from the host with two echo services; `eth0` carries the same address and Docker bridge networks are masqueraded to it). The CDN address `185.239.1.100` is not a Backend outbound address and must not be allowlisted. The VPS can reach `payment.zarinpal.com`. The payment egress path for the Backend does not exist yet (separate from the SMS relay); its real address must be re-checked from that path once built. Official error `-10` means the merchant ID or the request IP is not valid; ZarinPal documents that the IP it sees can differ from the website's. Whether `82.115.18.101` is registered in the merchant panel is unverified |
| Merchant registered domain and callback | **Unverified (owner)** | official error `-14`: the `callback_url` domain must match the terminal's registered domain; `-18`: the referrer must match it. The callback the Backend will send is `https://yarizan.oarnova.games/payment/return` (the Nuxt return route). The registered website domain must be `yarizan.oarnova.games` or `oarnova.games` as ZarinPal's matching rule requires, and the same host must serve the callback. Confirm both in the panel; the Shaparak (eNamad) record already names the site |
| Return routing | **Fixed and tested** | the Nuxt `/payment/return` validation accepted only `A` plus exactly 32 characters (33 in all), while the documented authority has 36 characters and sandbox authorities start with `S`: a real authority would have been rejected with 400 before reaching the Backend. Web and Backend now share one pattern (`[AS]` plus 32-40 alphanumerics, or the fake test form); a unit test fails if they differ and a full-application test proves which layer decided |
| Sandbox | **Real sandbox round trip, cancel and inquiry done** | sections 9 and 10 |
| Merchant activation | **Not granted** | the owner reports activation is pending; nothing here changes it |
| Real-payment authorization | **Not granted** | `COMMERCE_MODE=zarinpal` is refused at startup; needs merchant activation, the Backend production gates and a separate recorded go/no-go |

### Operator actions

1. In the ZarinPal panel: confirm the custom domain shows as confirmed, register the Backend egress IP (`82.115.18.101` unless the payment egress path differs), and confirm the registered website domain matches `yarizan.oarnova.games`.
2. Ask ZarinPal support, in writing, whether API-created StartPay links must use `pay.yarizan.oarnova.games`, and the exact form (host, path, sandbox variant).
3. Build the dedicated payment egress (not the SMS relay), then re-verify its public address and the allowlist from that path.

## 9. Real ZarinPal sandbox round trip (2026-10-21)

Run on the owner's workstation against `https://sandbox.zarinpal.com` (not a mock): local full stack, `COMMERCE_MODE=zarinpal_sandbox`, a random UUID sandbox merchant ID, the labelled Grade 1 test price, callback `http://localhost:3200/payment/return`. No real money, no live merchant, no production gate touched.

| Step | Observed |
|---|---|
| Request | HTTP 200, `code 100`, authority of the form `S` plus 35 characters, fee 3000. The sandbox **accepts an `http://localhost` callback**, so no callback bridge is needed for local sandbox tests |
| Amount | customer-facing 100,000 IRR (10,000 Toman, labelled test price); order subtotal, discount 0, total, payment attempt, the request and the verify request all 100,000 IRR; the official 12,990,000 IRR price and history untouched |
| Redirect | the app opened `https://sandbox.zarinpal.com/pg/StartPay/<authority>`; the owner completed the sandbox payment in the browser and returned to the local callback |
| Server-side verification | the worker verified with the stored authority and the original amount: attempt `VERIFIED`, `provider_config zarinpal-sandbox-v1`, provider reference recorded, no exception |
| Settlement | order `PAID` then `FULFILLED` exactly once: one fulfillment, one entitlement, one purchase notice job |
| Duplicate callbacks | three more browser returns (`303` each) left the single capture, fulfillment and state unchanged |

Provider semantics now confirmed by direct sandbox calls (previously assumed):

| Call | Real answer |
|---|---|
| verify again with the original amount | `code 101`, "Verified", same `ref_id` (so 101 does mean "already verified", as the Backend policy assumes) |
| verify with a different amount | `errors.code -50`, "Session is not valid, amounts values is not the same." (`data` is empty, so the adapter reports an unanswered unknown and never captures) |
| verify an unknown authority | `errors.code -54`, "Invalid authority." |
| verify with a different merchant ID | **the sandbox still answered 101**: it does not bind the merchant ID. Merchant binding is therefore not testable in the sandbox; the Backend's own stored-merchant comparison stays authoritative |

Not yet exercised against the real sandbox: a cancelled payment (`Status=NOK`), an expired authority, and provider timeouts (covered only by local fake-server tests). Real-money payment and production activation remain blocked on merchant activation, the Backend production gates and a separate recorded go/no-go.

### 9.1 Cancelled payment and the sandbox page (2026-10-22, real sandbox)

A second Grade 1 test order (100,000 IRR) was taken to `https://sandbox.zarinpal.com/pg/StartPay/S...` and cancelled with the page's own «انصراف» button (no card data, no security code entered).

| Observation | Result |
|---|---|
| Sandbox page | shows the merchant «زرین‌پال», "100,000 ریال, equivalent to ten thousand Toman", a 10-minute timer, a card form with a security-code image and a dynamic-password step. The security code is a CAPTCHA: automation does not solve it, so a successful sandbox payment needs a person (the owner completed the first one) |
| Cancel | the sandbox returned the browser to `http://localhost:3200/payment/return?Authority=S...&Status=NOK`, which redirected to `/payment/result` |
| Provider answer after cancel | `verify` answers `errors.code -51`, "Session is not valid, session is not active paid try." with empty `data` |
| Our state | order `PENDING`, attempt `UNKNOWN`, no provider reference, no exception, no fulfillment, no entitlement; the page tells the customer the result is not final and not to pay again; the VERIFY job keeps retrying |
| Policy | fail closed: any answer that is not 100 or 101 never settles. `-51` is also what an unpaid authority answers before the customer pays, so it is not treated as a terminal failure. Owner decision (2026-10-22): `Status=NOK`, `-51` and elapsed time never mark a payment cancelled; see section 10 |

### 9.2 Workstation network diagnosis (2026-10-21)

| Check | Result |
|---|---|
| Cause of the failures | a foreign exit (`singbox_tun`, public address in DE) was active: ZarinPal hosts and the Iranian eNamad seal failed the TLS handshake (`schannel: failed to receive handshake`) with `--noproxy '*'`, while documentation and the sandbox worked as soon as the tunnel was off |
| Proxy variables | `HTTP_PROXY` and `HTTPS_PROXY` point at `127.0.0.1:10808`; requests through it succeeded or failed with the tunnel state, direct requests with the tunnel off succeed. Windows system proxy was off |
| DNS | normal; the failures were TLS handshake resets, not name resolution |
| TLS validation | never disabled. Certificates validated on every successful call |
| Remedy | disconnect the tunnel for ZarinPal sandbox tests, or route only `*.zarinpal.com` and `trustseal.enamad.ir` directly. The Claude Code MCP client reads `NO_PROXY` from `.claude/settings.local.json` (ignored by Git) in new sessions. No global network setting was changed |


## 10. Cancellation and reconciliation policy (2026-10-22)

> **Replaced in release 2.1.0 (owner decision 2026-10-26).** A browser `Status=NOK` now ends the invoice at once. So does an `OK` return that verify and inquiry show as unpaid, and so does the end of the 15-minute invoice window, after one last verify call. The customer can then pay again. An ended attempt is never verified later, and the bank returns unverified money. Capture rules are unchanged. See [YARIZAN-2.1.0-RELEASE.md](YARIZAN-2.1.0-RELEASE.md). The text below records the 2.0.0 policy.

Owner decisions: a browser `Status=NOK`, a verify error such as `-51` or an elapsed timer never marks a payment cancelled. Financial uncertainty stays until an authoritative provider answer establishes a terminal result. No new paid order or entitlement can come from `Status=NOK`.

### 10.1 Official inquiry method

Source: documentation MCP, `/paymentGateway/otherMethods/Inquiry.html`. `POST /pg/v4/payment/inquiry.json` with `merchant_id` and `authority`; `data.status` is one of `VERIFIED` (verified), `PAID` (paid, not verified), `IN_BANK` (payment in progress), `FAILED` (unsuccessful, not completed) or `REVERSED`. The page states that inquiry must never be used to verify a transaction. `/paymentGateway/moreFeatures/reverse.html` documents reversal of a successful payment within 30 minutes (errors `-60` to `-63`); the adapter has no reverse call.

### 10.2 Real sandbox observations (2026-10-22, no money)

| Authority | Verify | Inquiry |
|---|---|---|
| The paid and verified first order | `101` | `VERIFIED` |
| The cancelled second order (`Status=NOK`, about 13 hours earlier) | `-51`, **HTTP 401** | `IN_BANK` |
| A fresh authority, never opened | `-51`, HTTP 401 | `IN_BANK` |
| A paid authority, more than 30 minutes later | reverse: `-63` (reverse window expired) | — |

Findings:

- The sandbox never reported `FAILED` for a cancelled payment, so in the sandbox inquiry cannot tell a cancel from an unpaid authority. A cancelled sandbox attempt therefore stays unresolved and goes to Admin reconciliation, as the owner decided.
- The real provider sends refusals with HTTP 401 and an `errors.code`. The adapter previously treated any non-2xx as an outage, so `-51` was an unanswered call. That matters for the code 101 policy: an unanswered earlier call is the evidence that lets a later 101 count as our own capture. A documented refusal in a 4xx body is now an answered call; a 5xx is still unanswered.

### 10.3 Evidence categories

| Category | Source | Effect |
|---|---|---|
| Customer-reported return | `payment_attempts.customer_return` (`OK`/`NOK`, first report wins) | display only; never settles, never ends an attempt |
| Provider observation | `payment_inquiries` (append-only, every answer) and `payment_attempts.provider_status` | reconciliation evidence only |
| Provider-confirmed failure | a `FAILED` inquiry answer that repeats at least 15 minutes (`FAILED_CONFIRMATION_SECONDS`) after an earlier `FAILED`, with no other status in between, after a documented non-success verify | attempt `FAILED`, reason `provider_confirmed_failed`; the order becomes `FAILED` (never if it already has an accepted payment) and a reserved coupon is released |
| Unresolved | anything else (`IN_BANK`, a single `FAILED`, an outage, no answer) | attempt stays `UNKNOWN`; after eight verify runs the job goes to review with `RECONCILIATION_REVIEW` |
| Verified paid | verify `100`, or `101` with order-bound evidence (section 3) | the only capture path; unchanged |
| Contradiction | inquiry `VERIFIED` while verify refuses | `PROVIDER_STATE_CONFLICT` exception, no capture |
| Reversed | inquiry `REVERSED` without our capture | `PROVIDER_REVERSED` exception, no capture |

`PAID` keeps the attempt unknown; the next verify captures it. A delayed capture after `-51` settles exactly once through the normal verify path.

### 10.4 Customer messages (Persian)

- Unknown after a `NOK` return: the customer is told the gateway reported a cancellation or failure, that the financial result is not final, not to pay again, and that the result will appear on the same page.
- Unknown otherwise: the existing "not final, do not pay again" message.
- Provider-confirmed failure: the order was not paid; any debited amount returns under Shaparak rules within 72 hours; a new order can be placed.

### 10.5 Tests

`backend/test/integration.test.ts`, "Reconciliation:" (local sandbox-shaped server, real response shapes including HTTP 401 `-51`):

- `NOK`, contradictory and duplicate returns, repeated `-51` and two hours of `IN_BANK` answers leave the order `PENDING` with no capture. Every observation is kept, the history cannot be updated, and an inquiry outage records nothing.
- A single `FAILED` stays unknown. An older `FAILED` followed by `IN_BANK` does not confirm. A spaced repeat ends the attempt as `FAILED`, after which later returns, worker passes and a late verify success grant nothing.
- A delayed payment after `-51` settles once, with one fulfillment and one entitlement. Inquiry `VERIFIED` without a verify capture and inquiry `REVERSED` each raise an exception and capture nothing.
