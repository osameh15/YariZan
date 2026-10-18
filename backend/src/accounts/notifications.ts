import {
  Injectable,
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { unseal } from "../security/crypto";
import { Sms } from "./sms";
import { NoticeEvent, jalaliDate } from "./sms-templates";

interface Claimed {
  id: string;
  type: string;
  aggregate_id: string;
  created_at: Date;
}
const EVENTS: Readonly<Record<string, NoticeEvent>> = {
  "password.changed": "PASSWORD_CHANGED",
  "password.reset_mobile": "PASSWORD_CHANGED",
  "password.reset_completed": "PASSWORD_CHANGED",
  "purchase.notification_recorded": "PURCHASE_CONFIRMED",
};
const MAX_AGE_HOURS = 24;
const system = (): Actor => ({ type: "SYSTEM", correlationId: randomUUID() });

/**
 * Sends customer notices from durable outbox events.
 *
 * Delivery is at-most-once: an event is claimed (processed_at set) in its own transaction before
 * the provider call, so a crash or an ambiguous provider timeout never sends twice. A failed or
 * skipped notice is audited and never retried; a notice that cannot be sent yet (SMS disabled,
 * template not confirmed) stays pending untouched.
 */
@Injectable()
export class Notifications
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<unknown>;
  constructor(
    private db: Database,
    private security: Security,
    private sms: Sms,
    private audit: Audit,
  ) {}
  onApplicationBootstrap() {
    if (this.security.config.SMS_PROVIDER === "disabled") return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.drain()
          .catch(() => undefined)
          .finally(() => {
            this.active = undefined;
          });
    }, 5000);
    this.timer.unref();
  }
  async beforeApplicationShutdown() {
    clearInterval(this.timer);
    await this.active;
  }
  private sendable() {
    return Object.keys(EVENTS).filter((type) =>
      this.sms.canNotify(EVENTS[type]!),
    );
  }
  async drain(limit = 10) {
    const types = this.sendable();
    if (!types.length) return 0;
    const claimed = (
      await this.db.query<Claimed>(
        `UPDATE outbox_events SET processed_at=now(),attempts=attempts+1 WHERE id IN (
           SELECT id FROM outbox_events WHERE processed_at IS NULL AND type=ANY($1)
           ORDER BY created_at,id LIMIT $2 FOR UPDATE SKIP LOCKED)
         RETURNING id,type,aggregate_id,created_at`,
        [types, limit],
      )
    ).rows;
    for (const event of claimed) await this.send(event);
    return claimed.length;
  }
  private async recipient(event: Claimed) {
    const customerId =
      event.type === "purchase.notification_recorded"
        ? (
            await this.db.query<{ customer_id: string }>(
              "SELECT customer_id FROM orders WHERE id=$1",
              [event.aggregate_id],
            )
          ).rows[0]?.customer_id
        : event.aggregate_id;
    if (!customerId) return undefined;
    const row = (
      await this.db.query<{ mobile_ciphertext: string | null }>(
        "SELECT mobile_ciphertext FROM customers WHERE id=$1 AND state='ACTIVE' AND mobile_ciphertext IS NOT NULL",
        [customerId],
      )
    ).rows[0];
    return row?.mobile_ciphertext
      ? unseal(
          row.mobile_ciphertext,
          this.security.config.MOBILE_ENCRYPTION_KEY!,
        )
      : undefined;
  }
  private async send(event: Claimed) {
    const kind = EVENTS[event.type]!;
    let outcome = "sms.notice_sent";
    try {
      const stale =
        Date.now() - event.created_at.getTime() > MAX_AGE_HOURS * 3_600_000;
      const mobile = stale ? undefined : await this.recipient(event);
      if (!mobile) outcome = "sms.notice_skipped";
      else
        await this.sms.notify({
          event: kind,
          mobile,
          values:
            kind === "PURCHASE_CONFIRMED"
              ? { order: event.aggregate_id }
              : { date: jalaliDate(event.created_at) },
        });
    } catch {
      outcome = "sms.notice_unavailable"; // No provider payload, mobile or credential is recorded.
    }
    try {
      await this.db.transaction((c) =>
        this.audit.append(c, system(), outcome, event.aggregate_id, {
          event: event.type,
          outbox_event: event.id,
        }),
      );
    } catch {
      /* Audit loss never triggers a resend. */
    }
  }
}
