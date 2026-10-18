import { Injectable } from "@nestjs/common";
import { appendFile, mkdir } from "node:fs/promises";
import { Security } from "../security/security";
import { seal } from "../security/crypto";
import { ApiError } from "../common/errors";
import {
  NOTICE_TEMPLATES,
  NoticeEvent,
  OtpPurpose,
  RenderedSms,
  renderOtp,
  renderSms,
} from "./sms-templates";
export interface SmsMessage {
  challengeId: string;
  mobile: string;
  code: string;
  purpose: OtpPurpose;
}
export interface SmsNotice {
  event: NoticeEvent;
  mobile: string;
  values: Readonly<Record<string, string>>;
}
export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
  notify(notice: SmsNotice): Promise<void>;
}
export class FakeSmsProvider implements SmsProvider {
  readonly messages: SmsMessage[] = [];
  async send(message: SmsMessage) {
    this.messages.push({ ...message });
    if (this.messages.length > 512) this.messages.shift();
  }
  readonly notices: SmsNotice[] = [];
  async notify(notice: SmsNotice) {
    // Fake mode still enforces the provider variable contract so tests catch drift.
    renderSms(NOTICE_TEMPLATES[notice.event], notice.values, {
      requireConfirmed: false,
    });
    this.notices.push({ ...notice });
    if (this.notices.length > 512) this.notices.shift();
  }
  codeFor(id: string) {
    return this.messages.findLast((m) => m.challengeId === id)?.code;
  }
}
/**
 * MeliPayamak console shared-service JSON API.
 *
 * POST https://console.melipayamak.com/api/send/shared/{token} with {"bodyId":N,"to":"09...","args":[...]}.
 * The token is a secret that sits in the URL path: the URL is built here from the allowlisted
 * host and a validated token, is never logged, and no error produced here carries the URL, the
 * token, the phone number or the code (every failure is the generic SMS_UNAVAILABLE).
 *
 * Response semantics are NOT yet confirmed against provider documentation or a controlled test:
 * a send is accepted only for HTTP 200 with a JSON `recId` that is a positive integer (string
 * or number) and, when present, a `status` string without a failure marker. The first controlled
 * live test must record the real `status` vocabulary and tighten this check.
 */
export const MELIPAYAMAK_HOST = "console.melipayamak.com";
export const MELIPAYAMAK_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{8,256}$/;
const FAILURE_STATUS =
  /fail|error|invalid|reject|denied|unauthor|insufficient|block/i;
export class MeliPayamakSharedProvider implements SmsProvider {
  constructor(
    private token: string,
    private transport: typeof fetch = fetch,
    private requireConfirmed = true,
  ) {
    if (!MELIPAYAMAK_TOKEN_PATTERN.test(token))
      throw new ApiError("SMS_UNAVAILABLE", 503);
  }
  async send(m: SmsMessage) {
    await this.post(
      m.mobile,
      renderOtp(m.purpose, m.code, { requireConfirmed: this.requireConfirmed }),
    );
  }
  async notify(n: SmsNotice) {
    await this.post(
      n.mobile,
      renderSms(NOTICE_TEMPLATES[n.event], n.values, {
        requireConfirmed: this.requireConfirmed,
      }),
    );
  }
  private async post(mobile: string, rendered: RenderedSms) {
    try {
      const r = await this.transport(
        `https://${MELIPAYAMAK_HOST}/api/send/shared/${this.token}`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            bodyId: rendered.bodyId,
            to: mobile,
            args: rendered.args,
          }),
        },
      );
      const reader = r.body?.getReader();
      if (!reader) throw Error();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 8192) {
            await reader.cancel();
            throw Error();
          }
          chunks.push(next.value);
        }
      } finally {
        reader.releaseLock();
      }
      const d = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        recId?: string | number;
        status?: unknown;
      };
      if (
        r.status !== 200 ||
        !/^[1-9][0-9]{0,18}$/.test(String(d.recId)) ||
        (d.status !== undefined &&
          (typeof d.status !== "string" ||
            d.status.length > 64 ||
            FAILURE_STATUS.test(d.status)))
      )
        throw Error();
    } catch {
      throw new ApiError("SMS_UNAVAILABLE", 503);
    }
  }
}
@Injectable()
export class Sms {
  readonly fake = new FakeSmsProvider();
  private provider: SmsProvider | undefined;
  constructor(private security: Security) {
    const c = security.config;
    if (c.SMS_PROVIDER === "fake") this.provider = this.fake;
    else if (c.SMS_PROVIDER === "melipayamak")
      this.provider = new MeliPayamakSharedProvider(c.MELIPAYAMAK_API_TOKEN!);
  }
  available() {
    if (!this.provider) throw new ApiError("SMS_UNAVAILABLE", 503);
  }
  async send(m: SmsMessage) {
    this.available();
    await this.provider!.send(m);
  }
  /** True when a notice can leave this process now (fake mode, or a confirmed live template). */
  canNotify(event: NoticeEvent) {
    const c = this.security.config;
    if (c.SMS_PROVIDER === "fake") return true;
    return (
      c.SMS_PROVIDER === "melipayamak" &&
      c.SMS_ALLOW_LIVE === "true" &&
      NOTICE_TEMPLATES[event].textConfirmed &&
      // A purchase notice is never sent for a simulated or disabled commerce flow.
      (event !== "PURCHASE_CONFIRMED" || c.COMMERCE_MODE === "zarinpal")
    );
  }
  async notify(n: SmsNotice) {
    this.available();
    await this.provider!.notify(n);
  }
  async record(m: SmsMessage) {
    const c = this.security.config;
    if (c.SMS_PROVIDER === "fake" && c.SMS_FAKE_OUTBOX) {
      await mkdir(".local", { recursive: true });
      await appendFile(
        c.SMS_FAKE_OUTBOX,
        seal(JSON.stringify(m), c.MOBILE_ENCRYPTION_KEY!) + "\n",
        { mode: 0o600 },
      );
    }
  }
}
