import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeSmsProvider, Sms } from "../src/accounts/sms";
import { Security } from "../src/security/security";
import {
  OTP_TEMPLATES,
  NOTICE_TEMPLATES,
  OTP_VALIDITY_SECONDS,
  OtpPurpose,
  SmsTemplate,
  jalaliDate,
  renderOtp,
  renderSms,
} from "../src/accounts/sms-templates";

const loose = { requireConfirmed: false };
const strict = { requireConfirmed: true };
const unavailable = (e: unknown) =>
  (e as { code: string }).code === "SMS_UNAVAILABLE";
const ORDER = "0b9f3c1e-8a2d-4c7e-9f10-2b6d5a4e3c21";

test("every OTP purpose maps to its own approved Body ID", () => {
  const expected: Record<OtpPurpose, string> = {
    ADMIN: "562281",
    PASSWORD: "562280",
    CLAIM: "559424",
    MOBILE_OLD: "559424",
    MOBILE_NEW: "559424",
    LOGIN: "559422",
    RESET: "559372",
  };
  for (const [purpose, id] of Object.entries(expected))
    assert.equal(OTP_TEMPLATES[purpose as OtpPurpose]?.bodyId, id, purpose);
  assert.equal(NOTICE_TEMPLATES.PASSWORD_CHANGED.bodyId, "559421");
  assert.equal(NOTICE_TEMPLATES.PURCHASE_CONFIRMED.bodyId, "559397");
});

test("authentication purposes never share a pattern with a notice, and Admin/password have their own", () => {
  const notices = new Set(Object.values(NOTICE_TEMPLATES).map((t) => t.bodyId));
  for (const t of Object.values(OTP_TEMPLATES))
    assert.ok(!notices.has(t!.bodyId));
  assert.notEqual(OTP_TEMPLATES.ADMIN!.bodyId, OTP_TEMPLATES.LOGIN!.bodyId);
  assert.notEqual(
    OTP_TEMPLATES.PASSWORD!.bodyId,
    NOTICE_TEMPLATES.PASSWORD_CHANGED.bodyId,
  );
});

test("OTP rendering is one six-digit Latin argument; JSON body id is numeric", () => {
  assert.deepEqual(renderOtp("LOGIN", "123456", loose), {
    bodyId: 559422,
    args: ["123456"],
  });
  assert.deepEqual(renderOtp("ADMIN", "654321", loose), {
    bodyId: 562281,
    args: ["654321"],
  });
  assert.deepEqual(renderOtp("PASSWORD", "000123", loose).args, ["000123"]);
  assert.deepEqual(renderOtp("RESET", "۱۲۳۴۵۶", loose).args, ["123456"]);
  assert.deepEqual(renderOtp("CLAIM", "٠٠١٢٣٤", loose).args, ["001234"]);
});

test("malformed OTP values are rejected before any provider call", () => {
  for (const code of [
    "12345",
    "1234567",
    "12345a",
    "123;56",
    "",
    "12 345",
    "١٢٣٤٥",
  ])
    assert.throws(() => renderOtp("LOGIN", code, loose), unavailable, code);
});

test("password change notice carries exactly one Jalali date argument", () => {
  const t = NOTICE_TEMPLATES.PASSWORD_CHANGED;
  assert.deepEqual(renderSms(t, { date: "۱۴۰۵/۰۷/۲۷" }, loose), {
    bodyId: 559421,
    args: ["1405/07/27"],
  });
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

test("purchase notice carries exactly the order UUID", () => {
  const t = NOTICE_TEMPLATES.PURCHASE_CONFIRMED;
  assert.deepEqual(renderSms(t, { order: ORDER }, loose), {
    bodyId: 559397,
    args: [ORDER],
  });
  for (const bad of ["1", ORDER.toUpperCase(), ORDER + ";x", "x" + ORDER])
    assert.throws(() => renderSms(t, { order: bad }, loose), unavailable, bad);
  assert.throws(() => renderSms(t, { code: "123456" }, loose), unavailable);
});

test("OTP lifetime is exactly 180 seconds and every OTP pattern states it", () => {
  assert.equal(OTP_VALIDITY_SECONDS, 180);
  for (const [purpose, t] of Object.entries(OTP_TEMPLATES))
    assert.equal(t!.providerValiditySeconds, 180, purpose);
});

test("a template promising another lifetime is never production-ready", () => {
  const withLifetime = (seconds: number | undefined) =>
    Object.fromEntries(
      Object.entries(OTP_TEMPLATES).map(([k, t]) => [
        k,
        { ...t!, textConfirmed: true, providerValiditySeconds: seconds },
      ]),
    ) as Record<OtpPurpose, SmsTemplate | null>;
  for (const wrong of [120, 300, 179, 181, undefined])
    for (const p of ["CLAIM", "LOGIN", "RESET", "PASSWORD", "ADMIN"] as const)
      assert.throws(
        () => renderOtp(p, "123456", strict, withLifetime(wrong)),
        unavailable,
        `${p} ${wrong}`,
      );
  assert.equal(
    renderOtp("LOGIN", "123456", strict, withLifetime(180)).bodyId,
    559422,
  );
});

test("every pattern is one-argument and stays unconfirmed until the exact text is verified", () => {
  for (const t of [
    ...Object.values(OTP_TEMPLATES),
    ...Object.values(NOTICE_TEMPLATES),
  ]) {
    assert.equal(t!.variables.length, 1, t!.bodyId);
    assert.equal(t!.textConfirmed, false, t!.bodyId);
    // Every pattern carries exactly one {0} and a recorded transcription.
    assert.equal(t!.providerText.split("{0}").length - 1, 1, t!.bodyId);
    assert.ok(t!.providerText.startsWith("یاریزان: "), t!.bodyId);
  }
  // Every OTP pattern promises exactly the backend lifetime (three minutes = 180 seconds).
  for (const t of Object.values(OTP_TEMPLATES)) {
    assert.match(t!.providerText, /۳ دقیقه/, t!.bodyId);
    assert.equal(t!.providerValiditySeconds, OTP_VALIDITY_SECONDS, t!.bodyId);
  }
});

test("owner attestation is recorded as such and can never silently become a live confirmation", () => {
  const all = [
    ...new Set([
      ...Object.values(OTP_TEMPLATES),
      ...Object.values(NOTICE_TEMPLATES),
    ]),
  ];
  assert.equal(all.length, 7, "seven distinct patterns");
  for (const t of all) {
    // A direct panel verification is the only thing that may confirm text for live sending.
    assert.equal(t!.verification, "OWNER_ATTESTED", t!.bodyId);
    if (t!.textConfirmed)
      assert.equal(t!.verification, "PANEL_VERIFIED", t!.bodyId);
  }
});

test("the seven approved Body IDs, purposes and exact transcriptions are registered", () => {
  const exact: [string, string][] = [
    [
      "562281",
      "یاریزان: کد تایید ورود به پنل مدیریت شما: {0} اعتبار: ۳ دقیقه. این کد محرمانه است و نباید در اختیار دیگران قرار بگیرد.",
    ],
    [
      "562280",
      "یاریزان: کد تایید تغییر رمز عبور شما: {0} اعتبار: ۳ دقیقه. این کد را در اختیار دیگران قرار ندهید.",
    ],
    [
      "559424",
      "یاریزان: کد تایید شماره موبایل شما: {0} اعتبار کد: ۳ دقیقه این کد محرمانه است.",
    ],
    [
      "559422",
      "یاریزان: کد ورود شما: {0} اعتبار کد: ۳ دقیقه این کد را در اختیار دیگران قرار ندهید.",
    ],
    [
      "559372",
      "یاریزان: کد بازیابی رمز عبور شما: {0} است. اعتبار: ۳ دقیقه. این کد را در اختیار دیگران قرار ندهید.",
    ],
  ];
  const byId = new Map(
    [...Object.values(OTP_TEMPLATES), ...Object.values(NOTICE_TEMPLATES)].map(
      (t) => [t!.bodyId, t!.providerText],
    ),
  );
  for (const [id, text] of exact) assert.equal(byId.get(id), text, id);
  assert.match(byId.get("559421")!, /تاریخ \{0\} تغییر کرد/);
  assert.match(byId.get("559397")!, /سفارش شماره \{0\} با موفقیت پرداخت شد/);
});

test("pending templates cannot be rendered for live sending", () => {
  for (const p of ["CLAIM", "LOGIN", "RESET", "PASSWORD", "ADMIN"] as const)
    assert.throws(() => renderOtp(p, "123456", strict), unavailable, p);
  for (const t of Object.values(NOTICE_TEMPLATES))
    assert.throws(
      () =>
        renderSms(
          t,
          t.variables[0] === "date" ? { date: "1405/07/27" } : { order: ORDER },
          strict,
        ),
      unavailable,
    );
});

test("invalid Body IDs and missing templates fail closed", () => {
  for (const bodyId of ["0", "-1", "12a", "", "01", "5.5"])
    assert.throws(
      () =>
        renderSms(
          {
            bodyId,
            verification: "PANEL_VERIFIED" as const,
            variables: ["code"],
            providerText: "",
            textConfirmed: true,
          },
          { code: "123456" },
          loose,
        ),
      unavailable,
      bodyId,
    );
  assert.throws(() => renderSms(null, { code: "123456" }, loose), unavailable);
});

test("fake provider records notices and enforces the variable contract without any network", async () => {
  const fake = new FakeSmsProvider();
  await fake.notify({
    event: "PURCHASE_CONFIRMED",
    mobile: "09123456789",
    values: { order: ORDER },
  });
  assert.equal(fake.notices.length, 1);
  await assert.rejects(
    fake.notify({
      event: "PURCHASE_CONFIRMED",
      mobile: "09123456789",
      values: { order: "1" },
    }),
  );
});

test("Sms.canNotify refuses live notices until text is confirmed and, for purchases, real commerce", () => {
  const sms = (config: Record<string, string>) =>
    new Sms({ config } as unknown as Security);
  const live = {
    SMS_PROVIDER: "melipayamak",
    SMS_ALLOW_LIVE: "true",
    MELIPAYAMAK_API_TOKEN: "ci-synthetic-token-0123456789",
  };
  assert.equal(sms(live).canNotify("PASSWORD_CHANGED"), false);
  assert.equal(sms(live).canNotify("PURCHASE_CONFIRMED"), false);
  assert.equal(
    sms({ ...live, COMMERCE_MODE: "fake" }).canNotify("PURCHASE_CONFIRMED"),
    false,
  );
  assert.equal(
    sms({ SMS_PROVIDER: "disabled" }).canNotify("PURCHASE_CONFIRMED"),
    false,
  );
  assert.equal(
    sms({ SMS_PROVIDER: "fake" }).canNotify("PURCHASE_CONFIRMED"),
    true,
  );
});
