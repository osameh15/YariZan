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

export interface SmsTemplate {
  bodyId: string;
  /** Ordered pattern variables; the provider joins them with ";". */
  variables: readonly string[];
  textConfirmed: boolean;
}

export const MOBILE_VERIFICATION: SmsTemplate = {
  bodyId: "559424",
  variables: ["code"],
  textConfirmed: false,
};
export const ACCOUNT_LOGIN: SmsTemplate = {
  bodyId: "559422",
  variables: ["code"],
  textConfirmed: false,
};
export const PASSWORD_RECOVERY: SmsTemplate = {
  bodyId: "559372",
  variables: ["code"],
  textConfirmed: false,
};
export const PASSWORD_CHANGE_NOTICE: SmsTemplate = {
  bodyId: "559421",
  variables: ["date"],
  textConfirmed: false,
};
export const PURCHASE_NOTICE: SmsTemplate = {
  bodyId: "559397",
  // Variable list is unknown until the owner supplies the pattern text.
  variables: [],
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
) {
  return renderSms(OTP_TEMPLATES[purpose], { code }, options);
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
