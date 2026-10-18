import { ApiError } from "../common/errors";

/**
 * Purpose-aware MeliPayamak pattern registry.
 *
 * Body IDs come from the owner's MeliPayamak panel. The panel confirmed the ID and purpose of
 * each pattern; the pattern text (variable count and order) has not been verified against the
 * panel. Every entry therefore carries `textConfirmed: false`, and the live provider refuses to
 * send an unconfirmed template. Flip a flag only in a reviewed change that cites the panel text.
 */
export type OtpPurpose =
  | "CLAIM"
  | "LOGIN"
  | "RESET"
  | "PASSWORD"
  | "MOBILE_OLD"
  | "MOBILE_NEW"
  | "ADMIN";
export type NoticeEvent = "PASSWORD_CHANGED" | "PURCHASE_CONFIRMED";
export type SmsEvent = OtpPurpose | NoticeEvent;

/** Backend OTP lifetime (otp.ts issues "5 minutes"). Provider OTP texts must state the same. */
export const OTP_VALIDITY_MINUTES = 5;

export interface SmsTemplate {
  bodyId: string;
  /** Ordered pattern variables; the provider joins them with ";". */
  variables: readonly string[];
  /** Owner transcription of the panel text, kept as review evidence. */
  providerText: string;
  /** Validity the provider text promises, for OTP templates. */
  providerValidityMinutes?: number;
  /** True only after the exact text and approval were checked in the provider panel. */
  textConfirmed: boolean;
}

export const MOBILE_VERIFICATION: SmsTemplate = {
  bodyId: "559424",
  variables: ["code"],
  providerText:
    "یاریزان: کد تایید شماره موبایل شما: {0} اعتبار کد: ۲ دقیقه این کد محرمانه است.",
  providerValidityMinutes: 2, // Mismatch: backend issues 5-minute codes. Update the provider text.
  textConfirmed: false,
};
export const ACCOUNT_LOGIN: SmsTemplate = {
  bodyId: "559422",
  variables: ["code"],
  providerText:
    "یاریزان: کد ورود شما: {0} اعتبار کد: ۲ دقیقه این کد را در اختیار دیگران قرار ندهید.",
  providerValidityMinutes: 2, // Mismatch: backend issues 5-minute codes. Update the provider text.
  textConfirmed: false,
};
export const PASSWORD_RECOVERY: SmsTemplate = {
  bodyId: "559372",
  variables: ["code"],
  providerText:
    "یاریزان: کد بازیابی رمز عبور شما: {0} است. اعتبار: ۵ دقیقه. این کد را در اختیار دیگران قرار ندهید.",
  providerValidityMinutes: 5,
  textConfirmed: false,
};
export const PASSWORD_CHANGE_NOTICE: SmsTemplate = {
  bodyId: "559421",
  variables: ["date"],
  providerText:
    "یاریزان: رمز عبور حساب شما در تاریخ {0} تغییر کرد. اگر این تغییر توسط شما انجام نشده است، با پشتیبانی یاریزان تماس بگیرید.",
  textConfirmed: false,
};
export const PURCHASE_NOTICE: SmsTemplate = {
  bodyId: "559397",
  variables: ["order"],
  providerText:
    "یاریزان: سفارش شماره {0} با موفقیت پرداخت شد. برای مشاهده و فعال‌سازی محصول به حساب کاربری خود مراجعه کنید.",
  textConfirmed: false,
};

/**
 * `null` means no approved pattern exists. Admin MFA is deliberately unmapped: the customer
 * login pattern wording is not contractually suitable for a privileged Admin step-up, and
 * PASSWORD has no OTP pattern (559421 is a post-change notice, not an OTP).
 */
export const OTP_TEMPLATES: Readonly<Record<OtpPurpose, SmsTemplate | null>> = {
  CLAIM: MOBILE_VERIFICATION,
  MOBILE_OLD: MOBILE_VERIFICATION,
  MOBILE_NEW: MOBILE_VERIFICATION,
  LOGIN: ACCOUNT_LOGIN,
  RESET: PASSWORD_RECOVERY,
  PASSWORD: null,
  ADMIN: null,
};
export const NOTICE_TEMPLATES: Readonly<Record<NoticeEvent, SmsTemplate>> = {
  PASSWORD_CHANGED: PASSWORD_CHANGE_NOTICE,
  PURCHASE_CONFIRMED: PURCHASE_NOTICE,
};

const unavailable = () => new ApiError("SMS_UNAVAILABLE", 503);

export function latinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632));
}

/** Pattern variables are `;`-separated, so a value can never contain `;` or control text. */
const UNSAFE_VALUE = new RegExp("[;\u0000-\u001f\u007f\u2028\u2029]");
function safeValue(name: string, value: string) {
  const v = latinDigits(value);
  if (name === "code" && !/^[0-9]{6}$/.test(v)) throw unavailable();
  if (name === "date" && !/^[0-9]{4}\/[0-9]{2}\/[0-9]{2}$/.test(v))
    throw unavailable();
  // The customer-visible order number is the order UUID.
  if (
    name === "order" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
  )
    throw unavailable();
  if (!v || v.length > 64 || UNSAFE_VALUE.test(v)) throw unavailable();
  return v;
}

export interface RenderedSms {
  bodyId: string;
  text: string;
}

export function renderSms(
  template: SmsTemplate | null | undefined,
  values: Readonly<Record<string, string>>,
  options: { requireConfirmed: boolean },
): RenderedSms {
  if (!template || !/^[1-9][0-9]*$/.test(template.bodyId)) throw unavailable();
  if (options.requireConfirmed && !template.textConfirmed) throw unavailable();
  if (template.variables.length === 0) throw unavailable();
  const names = Object.keys(values);
  if (
    names.length !== template.variables.length ||
    !template.variables.every((n) => names.includes(n))
  )
    throw unavailable();
  return {
    bodyId: template.bodyId,
    text: template.variables.map((n) => safeValue(n, values[n]!)).join(";"),
  };
}

export function renderOtp(
  purpose: OtpPurpose,
  code: string,
  options: { requireConfirmed: boolean },
  templates: Readonly<Record<OtpPurpose, SmsTemplate | null>> = OTP_TEMPLATES,
) {
  const template = templates[purpose];
  // A provider text that promises a different lifetime would mislead the user.
  if (
    options.requireConfirmed &&
    template?.providerValidityMinutes !== OTP_VALIDITY_MINUTES
  )
    throw unavailable();
  return renderSms(template, { code }, options);
}

/** Jalali date with Latin digits, e.g. 1405/07/27, the format assumed for the date variable. */
export function jalaliDate(at: Date) {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}/${get("month")}/${get("day")}`;
}
