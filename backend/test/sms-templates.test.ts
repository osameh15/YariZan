import { test } from "node:test";
import assert from "node:assert/strict";
import { MeliPayamakProvider, FakeSmsProvider } from "../src/accounts/sms";
import {
  OTP_TEMPLATES,
  NOTICE_TEMPLATES,
  OtpPurpose,
  jalaliDate,
  renderOtp,
  renderSms,
} from "../src/accounts/sms-templates";

const loose = { requireConfirmed: false };
const strict = { requireConfirmed: true };
const unavailable = (e: unknown) =>
  (e as { code: string }).code === "SMS_UNAVAILABLE";

test("every OTP purpose maps to the approved pattern or is explicitly unmapped", () => {
  const expected: Record<OtpPurpose, string | null> = {
    CLAIM: "559424",
    MOBILE_OLD: "559424",
    MOBILE_NEW: "559424",
    LOGIN: "559422",
    RESET: "559372",
    PASSWORD: null,
    ADMIN: null,
  };
  for (const [purpose, id] of Object.entries(expected))
    assert.equal(
      OTP_TEMPLATES[purpose as OtpPurpose]?.bodyId ?? null,
      id,
      purpose,
    );
  assert.equal(NOTICE_TEMPLATES.PASSWORD_CHANGED.bodyId, "559421");
  assert.equal(NOTICE_TEMPLATES.PURCHASE_CONFIRMED.bodyId, "559397");
});

test("Admin MFA and password OTP never reuse an incompatible pattern", () => {
  for (const p of ["ADMIN", "PASSWORD"] as const)
    assert.throws(() => renderOtp(p, "123456", loose), unavailable);
});

test("OTP pattern text is the single code, Persian and Arabic digits become Latin", () => {
  assert.deepEqual(renderOtp("LOGIN", "123456", loose), {
    bodyId: "559422",
    text: "123456",
  });
  assert.equal(renderOtp("RESET", "۱۲۳۴۵۶", loose).text, "123456");
  assert.equal(renderOtp("CLAIM", "٠٠١٢٣٤", loose).text, "001234");
});

test("malformed OTP values are rejected before any provider call", () => {
  for (const code of ["12345", "1234567", "12345a", "123;56", "", "12 345"])
    assert.throws(() => renderOtp("LOGIN", code, loose), unavailable, code);
});

test("password change notice carries exactly one date variable", () => {
  const t = NOTICE_TEMPLATES.PASSWORD_CHANGED;
  assert.equal(renderSms(t, { date: "۱۴۰۵/۰۷/۲۷" }, loose).text, "1405/07/27");
  assert.throws(() => renderSms(t, { code: "123456" }, loose), unavailable);
  assert.throws(() => renderSms(t, { date: "x" }, loose), unavailable);
  assert.throws(
    () => renderSms(t, { date: "1405/07/27", code: "123456" }, loose),
    unavailable,
  );
  assert.match(
    jalaliDate(new Date("2026-10-18T12:00:00Z")),
    /^14\d\d\/\d\d\/\d\d$/,
  );
});

test("purchase notice is not renderable until its variables are confirmed", () => {
  assert.throws(
    () => renderSms(NOTICE_TEMPLATES.PURCHASE_CONFIRMED, { order: "1" }, loose),
    unavailable,
  );
});

test("invalid Body IDs and missing templates fail closed", () => {
  for (const bodyId of ["0", "-1", "12a", "", "01"])
    assert.throws(
      () =>
        renderSms(
          { bodyId, variables: ["code"], textConfirmed: true },
          { code: "123456" },
          loose,
        ),
      unavailable,
      bodyId,
    );
  assert.throws(() => renderSms(null, { code: "123456" }, loose), unavailable);
});

test("unconfirmed templates cannot reach the live provider", async () => {
  let calls = 0;
  const provider = new MeliPayamakProvider("u", "p", async () => {
    calls++;
    return new Response(JSON.stringify({ RetStatus: 1, Value: "9" }));
  });
  assert.throws(() => renderOtp("LOGIN", "123456", strict), unavailable);
  await assert.rejects(
    provider.send({
      challengeId: "c",
      mobile: "09123456789",
      code: "123456",
      purpose: "LOGIN",
    }),
    unavailable,
  );
  await assert.rejects(
    provider.notify({
      event: "PASSWORD_CHANGED",
      mobile: "09123456789",
      values: { date: "1405/07/27" },
    }),
    unavailable,
  );
  assert.equal(calls, 0);
});

test("provider sends a notice with its own Body ID", async () => {
  let body: Record<string, string> = {};
  const provider = new MeliPayamakProvider(
    "u",
    "p",
    async (_url, init) => {
      body = Object.fromEntries(new URLSearchParams(String(init?.body)));
      return new Response(JSON.stringify({ RetStatus: 1, Value: "77" }));
    },
    false,
  );
  await provider.notify({
    event: "PASSWORD_CHANGED",
    mobile: "09123456789",
    values: { date: "1405/07/27" },
  });
  assert.equal(body.bodyId, "559421");
  assert.equal(body.text, "1405/07/27");
});

test("HTTP 4xx/5xx, timeout, oversized and unterminated bodies fail generically", async () => {
  const message = {
    challengeId: "c",
    mobile: "09123456789",
    code: "123456",
    purpose: "LOGIN" as const,
  };
  const cases: Array<() => Response | Promise<Response>> = [
    () => new Response("{}", { status: 400 }),
    () => new Response("{}", { status: 503 }),
    () => new Response("x".repeat(9000)),
    () => new Response(JSON.stringify({ RetStatus: 1, Value: "0" })),
    () => new Response(null),
    () => {
      throw new DOMException("t", "TimeoutError");
    },
  ];
  for (const respond of cases) {
    let calls = 0;
    await assert.rejects(
      new MeliPayamakProvider(
        "secret-user",
        "secret-pass",
        async () => {
          calls++;
          return respond();
        },
        false,
      ).send(message),
      (e: unknown) =>
        unavailable(e) && !JSON.stringify(e).includes("secret-pass"),
    );
    assert.equal(calls, 1, "no retry after failure or ambiguous timeout");
  }
});

test("fake provider records notices without any network", async () => {
  const fake = new FakeSmsProvider();
  await fake.notify({
    event: "PURCHASE_CONFIRMED",
    mobile: "09123456789",
    values: { order: "1" },
  });
  assert.equal(fake.notices.length, 1);
});
