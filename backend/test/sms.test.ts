import { test } from "node:test";
import assert from "node:assert/strict";
import { MeliPayamakProvider, FakeSmsProvider } from "../src/accounts/sms";
import { normalizeMobile } from "../src/accounts/otp";
import { configuration } from "../src/config";
const message = {
  challengeId: "synthetic",
  mobile: "09123456789",
  code: "123456",
  purpose: "LOGIN" as const,
};
test("MeliPayamak uses fixed HTTPS pattern service, one OTP variable, no redirects", async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(
      url,
      "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber",
    );
    assert.equal(init?.redirect, "error");
    assert.deepEqual(
      Object.fromEntries(new URLSearchParams(String(init?.body))),
      {
        username: "test-user",
        password: "test-api-password",
        to: message.mobile,
        text: message.code,
        bodyId: "559422",
      },
    );
    return new Response(JSON.stringify({ RetStatus: 1, Value: "123456789" }));
  };
  await new MeliPayamakProvider(
    "test-user",
    "test-api-password",
    transport,
    false,
  ).send(message);
  assert.equal(calls, 1);
});
test("MeliPayamak failure, malformed result, timeout and negative receipt fail closed", async () => {
  for (const response of [
    "bad",
    JSON.stringify({ RetStatus: 1, Value: "-6" }),
    JSON.stringify({ RetStatus: 0, Value: "99" }),
  ]) {
    await assert.rejects(
      new MeliPayamakProvider(
        "u",
        "p",
        async () => new Response(response),
        false,
      ).send(message),
      (e: unknown) => (e as { code: string }).code === "SMS_UNAVAILABLE",
    );
  }
  await assert.rejects(
    new MeliPayamakProvider(
      "u",
      "p",
      async () => {
        throw Error("secret");
      },
      false,
    ).send(message),
    (e: unknown) => (e as { code: string }).code === "SMS_UNAVAILABLE",
  );
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
test("Live SMS missing config refuses startup and fake cannot open production", () => {
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
    () =>
      configuration({ ...env, NODE_ENV: "production", SMS_PROVIDER: "fake" }),
    /PRODUCTION_GATE_CLOSED/,
  );
});
