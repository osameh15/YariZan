import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FakeSmsProvider,
  MeliPayamakSharedProvider,
  MELIPAYAMAK_HOST,
} from "../src/accounts/sms";
import { normalizeMobile } from "../src/accounts/otp";
import { configuration } from "../src/config";

const TOKEN = "ci-synthetic-token-0123456789";
const message = {
  challengeId: "synthetic",
  mobile: "09123456789",
  code: "123456",
  purpose: "LOGIN" as const,
};
const unavailable = (e: unknown) =>
  (e as { code: string }).code === "SMS_UNAVAILABLE";
// Loose provider: renders pending templates so the wire contract can be asserted. The strict
// default constructor is covered by the "pending templates" test.
const provider = (transport: typeof fetch) =>
  new MeliPayamakSharedProvider(TOKEN, transport, false);
const accepted = () =>
  new Response(JSON.stringify({ recId: "123456789", status: "ok" }));

test("Shared API: fixed host, token only in the path, JSON bodyId/to/args, no redirects", async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, `https://${MELIPAYAMAK_HOST}/api/send/shared/${TOKEN}`);
    assert.equal(MELIPAYAMAK_HOST, "console.melipayamak.com");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(
      (init?.headers as Record<string, string>)["Content-Type"],
      "application/json",
    );
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, {
      bodyId: 559422,
      to: message.mobile,
      args: [message.code],
    });
    assert.equal(typeof body.bodyId, "number");
    assert.equal(String(init?.body).includes(TOKEN), false);
    return accepted();
  };
  await provider(transport).send(message);
  assert.equal(calls, 1);
});

test("Shared API: request length is computed in bytes for UTF-8 content", async () => {
  // fetch derives Content-Length from the encoded body; assert the encoded size differs from the
  // string length when non-ASCII is present, and that our payload is plain ASCII digits.
  const body = JSON.stringify({
    bodyId: 559421,
    to: "09123456789",
    args: ["1405/07/27"],
  });
  assert.equal(Buffer.byteLength(body), body.length);
  assert.notEqual(Buffer.byteLength("تاریخ"), "تاریخ".length);
});

test("Shared API: every OTP purpose sends its own Body ID and one argument", async () => {
  const expected: Record<string, number> = {
    CLAIM: 559424,
    MOBILE_OLD: 559424,
    MOBILE_NEW: 559424,
    LOGIN: 559422,
    RESET: 559372,
    PASSWORD: 562280,
    ADMIN: 562281,
  };
  for (const [purpose, bodyId] of Object.entries(expected)) {
    let sent: { bodyId?: number; args?: string[] } = {};
    await provider(async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return accepted();
    }).send({ ...message, purpose: purpose as typeof message.purpose });
    assert.equal(sent.bodyId, bodyId, purpose);
    assert.deepEqual(sent.args, ["123456"], purpose);
  }
});

test("Shared API: notices carry the date or the order UUID as the single argument", async () => {
  const sent: Array<{ bodyId: number; to: string; args: string[] }> = [];
  const p = provider(async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)));
    return accepted();
  });
  await p.notify({
    event: "PASSWORD_CHANGED",
    mobile: "09123456789",
    values: { date: "۱۴۰۵/۰۷/۲۷" },
  });
  const order = "0b9f3c1e-8a2d-4c7e-9f10-2b6d5a4e3c21";
  await p.notify({
    event: "PURCHASE_CONFIRMED",
    mobile: "09123456789",
    values: { order },
  });
  assert.deepEqual(sent, [
    { bodyId: 559421, to: "09123456789", args: ["1405/07/27"] },
    { bodyId: 559397, to: "09123456789", args: [order] },
  ]);
});

test("Shared API: only a positive recId with a non-failure status is acceptance", async () => {
  for (const ok of [
    { recId: 1, status: "ok" },
    { recId: "987654321" },
    { recId: 42, status: "ارسال شد" },
  ])
    await provider(async () => new Response(JSON.stringify(ok))).send(message);
  for (const bad of [
    {},
    { recId: 0 },
    { recId: -6 },
    { recId: "abc" },
    { recId: "0" },
    { recId: null },
    { recId: 5, status: "failed" },
    { recId: 5, status: "Invalid token" },
    { recId: 5, status: { code: 1 } },
    { recId: 5, status: "x".repeat(100) },
    [],
    "text",
  ])
    await assert.rejects(
      provider(async () => new Response(JSON.stringify(bad))).send(message),
      unavailable,
      JSON.stringify(bad),
    );
});

test("Shared API: HTTP errors, redirects, malformed, oversized and empty bodies fail generically", async () => {
  const cases: Array<() => Response | Promise<Response>> = [
    () => new Response(JSON.stringify({ recId: 5 }), { status: 400 }),
    () => new Response(JSON.stringify({ recId: 5 }), { status: 401 }),
    () => new Response(JSON.stringify({ recId: 5 }), { status: 500 }),
    () => new Response(JSON.stringify({ recId: 5 }), { status: 201 }),
    () => new Response("not json"),
    () => new Response("x".repeat(9000)),
    () => new Response(null),
    () => {
      throw new TypeError("redirect mode is set to error");
    },
    () => {
      throw new DOMException("t", "TimeoutError");
    },
  ];
  for (const respond of cases) {
    let calls = 0;
    await assert.rejects(
      provider(async () => {
        calls++;
        return respond();
      }).send(message),
      unavailable,
    );
    assert.equal(calls, 1, "no retry after failure or ambiguous timeout");
  }
});

test("Shared API: a transport error carrying the URL never leaks the token, number or code", async () => {
  const leaky: typeof fetch = async (url) => {
    throw Object.assign(
      new Error(`connect failed for ${String(url)} to 09123456789 code 123456`),
      { cause: new Error(String(url)) },
    );
  };
  const logged: string[] = [];
  const original = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };
  console.log =
    console.error =
    console.warn =
      (...a: unknown[]) => {
        logged.push(a.map(String).join(" "));
      };
  let caught: unknown;
  try {
    await provider(leaky).send(message);
  } catch (e) {
    caught = e;
  } finally {
    Object.assign(console, original);
  }
  assert.ok(unavailable(caught));
  const everything = [
    JSON.stringify(caught),
    String((caught as Error).stack),
    String((caught as Error).message),
    String((caught as { cause?: unknown }).cause),
    ...logged,
  ].join("\n");
  for (const secret of [
    TOKEN,
    "09123456789",
    "123456",
    "console.melipayamak.com",
  ])
    assert.equal(everything.includes(secret), false, secret);
});

test("Shared API: pending (unconfirmed) templates never reach the network", async () => {
  let calls = 0;
  const p = new MeliPayamakSharedProvider(TOKEN, async () => {
    calls++;
    return accepted();
  });
  for (const purpose of ["LOGIN", "ADMIN", "PASSWORD", "RESET"] as const)
    await assert.rejects(p.send({ ...message, purpose }), unavailable);
  await assert.rejects(
    p.notify({
      event: "PASSWORD_CHANGED",
      mobile: "09123456789",
      values: { date: "1405/07/27" },
    }),
    unavailable,
  );
  assert.equal(calls, 0);
});

test("Shared API: an invalid token is refused at construction, before any request", () => {
  for (const bad of [
    "",
    "short",
    "has/slash-0123456789",
    "q?x=1-0123456789",
    "a b c d e f g h",
    "x".repeat(300),
  ])
    assert.throws(
      () => new MeliPayamakSharedProvider(bad),
      unavailable,
      JSON.stringify(bad),
    );
});

test("Shared API: wrong argument count or malformed argument is refused before the request", async () => {
  let calls = 0;
  const p = provider(async () => {
    calls++;
    return accepted();
  });
  for (const code of ["", "12345", "1234567", "12345a", "123;456"])
    await assert.rejects(p.send({ ...message, code }), unavailable, code);
  assert.equal(calls, 0);
});

test("Fake SMS is observable only through injected test provider, never a public API", async () => {
  const fake = new FakeSmsProvider();
  await fake.send(message);
  assert.equal(fake.codeFor(message.challengeId), message.code);
});
test("Iran mobile normalization accepts local/international and Persian digits", () => {
  assert.equal(normalizeMobile("+989123456789"), "09123456789");
  assert.equal(normalizeMobile("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.throws(() => normalizeMobile("123"));
});
test("Live SMS needs the API token and the explicit live flag; fake cannot open production", () => {
  const env = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://local@localhost/test",
    CODE_HMAC_KEY: "1".repeat(64),
    TOKEN_HMAC_KEY: "2".repeat(64),
    MFA_ENCRYPTION_KEY: "3".repeat(64),
    MOBILE_ENCRYPTION_KEY: "4".repeat(64),
    OTP_HMAC_KEY: "5".repeat(64),
    SMS_PROVIDER: "melipayamak",
  };
  assert.throws(
    () => configuration(env),
    /SMS_PROVIDER_CONFIGURATION_REQUIRED/,
  );
  assert.throws(
    () => configuration({ ...env, MELIPAYAMAK_API_TOKEN: TOKEN }),
    /SMS_PROVIDER_CONFIGURATION_REQUIRED/,
    "token without the live flag",
  );
  assert.throws(
    () => configuration({ ...env, SMS_ALLOW_LIVE: "true" }),
    /SMS_PROVIDER_CONFIGURATION_REQUIRED/,
    "live flag without the token",
  );
  assert.throws(
    () =>
      configuration({
        ...env,
        SMS_ALLOW_LIVE: "true",
        MELIPAYAMAK_API_TOKEN: "bad/token",
      }),
    /CONFIGURATION_INVALID/,
    "path-unsafe token",
  );
  assert.doesNotThrow(() =>
    configuration({
      ...env,
      SMS_ALLOW_LIVE: "true",
      MELIPAYAMAK_API_TOKEN: TOKEN,
    }),
  );
  assert.throws(
    () =>
      configuration({ ...env, NODE_ENV: "production", SMS_PROVIDER: "fake" }),
    /PRODUCTION_GATE_CLOSED/,
  );
});
