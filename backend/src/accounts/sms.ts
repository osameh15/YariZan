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
    this.notices.push({ ...notice });
    if (this.notices.length > 512) this.notices.shift();
  }
  codeFor(id: string) {
    return this.messages.findLast((m) => m.challengeId === id)?.code;
  }
}
export class MeliPayamakProvider implements SmsProvider {
  constructor(
    private username: string,
    private password: string,
    private transport: typeof fetch = fetch,
    private requireConfirmed = true,
  ) {}
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
        "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            username: this.username,
            password: this.password,
            to: mobile,
            text: rendered.text,
            bodyId: rendered.bodyId,
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
      const text = Buffer.concat(chunks).toString("utf8");
      const d = JSON.parse(text) as {
        Value?: string | number;
        RetStatus?: number;
      };
      if (
        !r.ok ||
        Number(d.RetStatus) !== 1 ||
        !/^[1-9][0-9]*$/.test(String(d.Value))
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
      this.provider = new MeliPayamakProvider(
        c.MELIPAYAMAK_USERNAME!,
        c.MELIPAYAMAK_PASSWORD!,
      );
  }
  available() {
    if (!this.provider) throw new ApiError("SMS_UNAVAILABLE", 503);
  }
  async send(m: SmsMessage) {
    this.available();
    await this.provider!.send(m);
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
