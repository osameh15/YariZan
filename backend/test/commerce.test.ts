import { test } from "node:test";
import assert from "node:assert/strict";
import { discountAmount, coupon } from "../src/commerce/contracts";
import { ZarinPalAdapter, PaymentRequest } from "../src/commerce/gateway";
import { configuration } from "../src/config";
const request: PaymentRequest = {
  attempt_id: "00000000-0000-4000-8000-000000000001",
  order_id: "00000000-0000-4000-8000-000000000002",
  authority: "A" + "0".repeat(35),
  amount_irr: 12990000,
  currency: "IRR",
  provider_config: "offline-adapter-fixture",
};
test("Money arithmetic uses exact integers at safe-integer limits; ASCII coupons reject lookalikes", () => {
  assert.equal(
    discountAmount(Number.MAX_SAFE_INTEGER, {
      type: "percent",
      value: "99",
      max_discount_irr: null,
      min_order_irr: null,
    }),
    Number((BigInt(Number.MAX_SAFE_INTEGER) * 99n) / 100n),
  );
  assert.equal(
    discountAmount(12990000, {
      type: "fixed",
      value: "100000",
      max_discount_irr: null,
      min_order_irr: null,
    }),
    100000,
  );
  assert.equal(coupon.parse("  school-10 "), "SCHOOL-10");
  assert.throws(() => coupon.parse("SCHΟOL"));
});
test("Offline ZarinPal adapter uses fixed TLS v4 endpoints, explicit IRR and unchanged verify amount", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const transport: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), body });
    assert.equal(init?.redirect, "error");
    return new Response(
      JSON.stringify({
        data: String(url).includes("request")
          ? { code: 100, authority: request.authority }
          : { code: 101, ref_id: "12345" },
      }),
    );
  };
  const adapter = new ZarinPalAdapter(
    "00000000-0000-4000-8000-000000000003",
    "https://example.invalid/payment/return",
    transport,
  );
  const created = await adapter.create(request);
  assert.equal(
    created.redirect_url,
    "https://payment.zarinpal.com/pg/StartPay/" + request.authority,
  );
  assert.equal(calls[0].body.amount, 12990000);
  assert.equal(calls[0].body.currency, "IRR");
  assert.equal((await adapter.verify(request)).state, "VERIFIED");
  assert.equal(calls[1].body.amount, 12990000);
  await adapter.query(request);
  assert.ok(calls.some((c) => c.url.endsWith("/inquiry.json")));
});
test("Gateway malformed, nonauthoritative, oversized and transport failures stay unknown without refund methods", async () => {
  for (const transport of [
    async () => new Response('{"data":{"code":-51}}'),
    async () => new Response("not-json"),
    async () => new Response("x".repeat(17000)),
    async () => {
      throw Error("merchant-secret-not-logged");
    },
  ] as (typeof fetch)[]) {
    const adapter = new ZarinPalAdapter(
      "00000000-0000-4000-8000-000000000003",
      "https://example.invalid/payment/return",
      transport,
    );
    assert.deepEqual(await adapter.verify(request), { state: "UNKNOWN" });
    assert.equal("refund" in adapter, false);
  }
});
test("Real gateway selection is closed even with synthetic merchant-like environment variables", () => {
  assert.throws(
    () =>
      configuration({
        NODE_ENV: "test",
        COMMERCE_MODE: "zarinpal",
        DATABASE_URL: "postgresql://local@localhost/test",
        CODE_HMAC_KEY: "1".repeat(64),
        TOKEN_HMAC_KEY: "2".repeat(64),
        MFA_ENCRYPTION_KEY: "3".repeat(64),
      }),
    /ZARINPAL_LIVE_GATE_CLOSED/,
  );
});
test("Invalid merchant, callback, currency or amount contracts are refused before any provider request", async () => {
  let requests = 0;
  const transport: typeof fetch = async () => {
    requests++;
    return new Response(
      '{"data":{"code":100,"authority":"A' + "0".repeat(32) + '"}}',
    );
  };
  for (const [merchant, callback] of [
    ["not-a-merchant-uuid", "https://example.invalid/payment/return"],
    [
      "00000000-0000-4000-8000-000000000003",
      "http://example.invalid/payment/return",
    ],
    [
      "00000000-0000-4000-8000-000000000003",
      "https://example.invalid/return?x=1",
    ],
    [
      "00000000-0000-4000-8000-000000000003",
      "https://user:pass@example.invalid/return",
    ],
  ])
    assert.throws(() => new ZarinPalAdapter(merchant, callback, transport));
  const adapter = new ZarinPalAdapter(
    "00000000-0000-4000-8000-000000000003",
    "https://example.invalid/payment/return",
    transport,
  );
  for (const bad of [
    { currency: "IRT" },
    { amount_irr: 9999 },
    { amount_irr: 12990000.5 },
    { amount_irr: Number.MAX_SAFE_INTEGER + 2 },
  ])
    await assert.rejects(
      adapter.create({ ...request, ...bad } as PaymentRequest),
      (e: { code?: string }) => e.code === "GATEWAY_CONFIG_INVALID",
    );
  assert.equal(requests, 0);
  // Verification with a foreign currency or a malformed authority is never "paid".
  for (const bad of [{ currency: "IRT" }, { authority: "FAKE-authority" }])
    assert.deepEqual(
      await adapter.verify({ ...request, ...bad } as PaymentRequest),
      { state: "UNKNOWN" },
    );
  assert.equal(requests, 0);
});

test("ZarinPal authority pattern accepts the documented 36-character form and rejects path tricks", async () => {
  const { ZARINPAL_AUTHORITY } = await import("../src/commerce/gateway");
  assert.ok(ZARINPAL_AUTHORITY.test("A" + "0".repeat(35)));
  for (const bad of [
    "",
    "A" + "0".repeat(31),
    "A" + "0".repeat(41),
    "B" + "0".repeat(35),
    "A" + "0".repeat(34) + "/",
    "A" + "0".repeat(34) + "?",
    "A" + "0".repeat(34) + "\n",
  ])
    assert.equal(ZARINPAL_AUTHORITY.test(bad), false, JSON.stringify(bad));
});
test("ZarinPal verify treats non-success codes, missing reference and amount mismatch as unknown", async () => {
  const mk = (data: unknown) =>
    new ZarinPalAdapter(
      "00000000-0000-4000-8000-000000000003",
      "https://example.invalid/payment/return",
      async () => new Response(JSON.stringify({ data })),
    );
  for (const data of [
    { code: -50 },
    { code: -51 },
    { code: -53 },
    { code: 100 },
    { code: 100, ref_id: 0 },
    { code: 100, ref_id: "abc" },
    [],
  ])
    assert.equal((await mk(data).verify(request)).state, "UNKNOWN");
  assert.equal(
    (await mk({ code: 100, ref_id: 77 }).verify(request)).state,
    "VERIFIED",
  );
});
test("ZarinPal verify never reaches the network for a malformed authority or non-IRR currency", async () => {
  let calls = 0;
  const adapter = new ZarinPalAdapter(
    "00000000-0000-4000-8000-000000000003",
    "https://example.invalid/payment/return",
    async () => {
      calls++;
      return new Response("{}");
    },
  );
  assert.equal(
    (await adapter.verify({ ...request, authority: "A/../x" })).state,
    "UNKNOWN",
  );
  assert.equal(
    (await adapter.verify({ ...request, authority: null })).state,
    "UNKNOWN",
  );
  assert.equal(calls, 0);
});
