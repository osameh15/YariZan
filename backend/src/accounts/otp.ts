import { Injectable, BeforeApplicationShutdown } from "@nestjs/common";
import { randomUUID, randomInt } from "node:crypto";
import { PoolClient } from "pg";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { equal, keyed, seal } from "../security/crypto";
import { requireCondition } from "../common/errors";
import { Sms } from "./sms";
export type Purpose =
  | "CLAIM"
  | "LOGIN"
  | "RESET"
  | "PASSWORD"
  | "MOBILE_OLD"
  | "MOBILE_NEW"
  | "ADMIN";
export interface OtpRow {
  id: string;
  purpose: Purpose;
  principal_id: string | null;
  pairing_id: string | null;
  generation: number | null;
  session_hash: string | null;
  mobile_ciphertext: string;
  mobile_lookup: string;
  code_hash: string;
  principal_stamp: string | null;
  attempts: number;
  delivered: boolean;
  expires_at: Date;
  used_at: Date | null;
}
export function normalizeMobile(value: string) {
  const n = value
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[\s-]/g, "");
  const v = n.startsWith("+98")
    ? "0" + n.slice(3)
    : n.startsWith("0098")
      ? "0" + n.slice(4)
      : n;
  requireCondition(/^09[0-9]{9}$/.test(v), "MOBILE_INVALID");
  return v;
}
interface Delivery {
  id: string;
  purpose: Purpose;
  mobile: string;
  code: string;
  actor: Actor;
  deliver: boolean;
}
@Injectable()
export class Otp implements BeforeApplicationShutdown {
  private admittedDeliveries = 0;
  private readonly pending: Delivery[] = [];
  private readonly running = new Set<Promise<void>>();
  private accepting = true;

  constructor(
    private db: Database,
    private security: Security,
    private sms: Sms,
    private audit: Audit,
  ) {}
  available() {
    this.sms.available();
  }
  lookup(m: string) {
    requireCondition(this.security.config.OTP_HMAC_KEY, "SMS_UNAVAILABLE", 503);
    return keyed(
      this.security.config.OTP_HMAC_KEY!,
      "YariZan-Mobile-Lookup-V1",
      normalizeMobile(m),
    );
  }
  encrypt(m: string) {
    requireCondition(
      this.security.config.MOBILE_ENCRYPTION_KEY,
      "SMS_UNAVAILABLE",
      503,
    );
    return seal(
      normalizeMobile(m),
      this.security.config.MOBILE_ENCRYPTION_KEY!,
    );
  }
  private verifier(id: string, purpose: Purpose, code: string) {
    requireCondition(this.security.config.OTP_HMAC_KEY, "SMS_UNAVAILABLE", 503);
    return keyed(
      this.security.config.OTP_HMAC_KEY!,
      "YariZan-OTP-V1",
      id + ":" + purpose + ":" + code,
    );
  }
  async issue(
    purpose: Purpose,
    mobile: string,
    actor: Actor,
    binding: {
      principal_id?: string;
      pairing_id?: string;
      generation?: number;
      session_hash?: string;
      principal_stamp?: string;
    },
    deliver = true,
  ) {
    this.sms.available();
    mobile = normalizeMobile(mobile);
    const lookup = this.lookup(mobile);
    // Reserve before the first admission await; matched and decoy requests share this bound.
    requireCondition(
      this.accepting && this.admittedDeliveries < 20,
      "SMS_UNAVAILABLE",
      503,
    );
    this.admittedDeliveries++;
    try {
      await this.security.rate("sms-global", 200, 3600);
      await this.security.rate("otp-phone:" + lookup, 6, 3600);
      await this.security.rate(
        "otp-cooldown:" +
          purpose +
          ":" +
          lookup +
          ":" +
          (["LOGIN", "RESET"].includes(purpose)
            ? "public"
            : (binding.principal_id ?? binding.pairing_id ?? "unknown")),
        1,
        60,
      );
      const id = randomUUID(),
        code = String(randomInt(0, 1000000)).padStart(6, "0");
      await this.db.transaction(async (c) => {
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          purpose + (binding.principal_id ?? binding.pairing_id ?? lookup),
        ]);
        await c.query(
          "UPDATE otp_challenges SET used_at=now() WHERE purpose=$1 AND (mobile_lookup=$2 OR $3::uuid IS NOT NULL OR $4::uuid IS NOT NULL) AND principal_id IS NOT DISTINCT FROM $3::uuid AND pairing_id IS NOT DISTINCT FROM $4::uuid AND used_at IS NULL",
          [
            purpose,
            lookup,
            binding.principal_id ?? null,
            binding.pairing_id ?? null,
          ],
        );
        await c.query(
          "INSERT INTO otp_challenges(id,purpose,principal_id,pairing_id,generation,session_hash,mobile_ciphertext,mobile_lookup,code_hash,principal_stamp,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now()+interval '5 minutes')",
          [
            id,
            purpose,
            binding.principal_id ?? null,
            binding.pairing_id ?? null,
            binding.generation ?? null,
            binding.session_hash ?? null,
            this.encrypt(mobile),
            lookup,
            this.verifier(id, purpose, code),
            binding.principal_stamp ?? null,
          ],
        );
        await this.audit.append(c, actor, "otp.requested", id, { purpose });
      });
      // Every accepted request has a reserved FIFO slot. No vendor timing in the receipt.
      const job = { id, purpose, mobile, code, actor, deliver };
      if (!this.accepting) {
        await this.failure(job, "interrupted");
        requireCondition(false, "SMS_UNAVAILABLE", 503);
      }
      this.pending.push(job);
      this.dispatch();
      return { challenge_id: id, expires_in: 300, retry_after: 60 };
    } catch (error) {
      this.admittedDeliveries--;
      throw error;
    }
  }
  private dispatch() {
    while (this.accepting && this.running.size < 4 && this.pending.length) {
      const job = this.pending.shift()!;
      const task = this.deliver(job).finally(() => {
        this.running.delete(task);
        this.admittedDeliveries--;
        this.dispatch();
      });
      this.running.add(task);
    }
  }
  async beforeApplicationShutdown() {
    this.accepting = false;
    const pending = this.pending.splice(0);
    for (const job of pending) {
      await this.failure(job, "interrupted");
      this.admittedDeliveries--;
    }
    await Promise.allSettled([...this.running]);
  }
  private async failure(job: Delivery, reason: string) {
    try {
      await this.db.transaction((c) =>
        this.audit.append(c, job.actor, "otp.delivery_unavailable", job.id, {
          purpose: job.purpose,
          reason,
        }),
      );
    } catch {
      // Database/process loss cannot make an undelivered challenge verifiable.
    }
  }
  private async deliver(job: Delivery) {
    const { id, purpose, mobile, code, actor } = job;
    try {
      const valid = await this.db.query(
        "SELECT 1 FROM otp_challenges WHERE id=$1 AND used_at IS NULL AND NOT delivered AND expires_at>clock_timestamp()",
        [id],
      );
      if (!valid.rowCount) {
        await this.failure(job, "expired_or_superseded");
        return;
      }
      if (!job.deliver) return; // Decoys use the same admission and queue, never contact a phone.
    } catch {
      await this.failure(job, "interrupted");
      return;
    }
    let delivered = false;
    try {
      await this.sms.send({ challengeId: id, mobile, code, purpose });
      delivered = true;
    } catch {
      /* No vendor payload or OTP is logged. */
    }
    try {
      await this.db.transaction(async (c) => {
        await c.query("UPDATE otp_challenges SET delivered=$2 WHERE id=$1", [
          id,
          delivered,
        ]);
        await this.audit.append(
          c,
          actor,
          delivered ? "otp.sent" : "otp.delivery_unavailable",
          id,
          { purpose },
        );
      });
      if (delivered)
        await this.sms.record({ challengeId: id, mobile, code, purpose });
    } catch {
      /* Shutdown/delivery loss requires a fresh request, never a bypass. */
    }
  }

  private valid(r: OtpRow | undefined, p: Purpose, code: string) {
    return (
      r &&
      r.purpose === p &&
      !r.used_at &&
      r.delivered &&
      r.expires_at.getTime() > Date.now() &&
      equal(r.code_hash, this.verifier(r.id, p, code))
    );
  }
  async admit(id: string, p: Purpose, code: string) {
    this.sms.available();
    const valid = await this.db.transaction(async (c) => {
      const r = (
        await c.query<OtpRow>(
          "SELECT * FROM otp_challenges WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!r || r.attempts >= 5) return undefined;
      await c.query(
        "UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1",
        [id],
      );
      const valid = !!this.valid(r, p, code);
      if (!valid)
        await this.audit.append(
          c,
          { type: "SYSTEM", correlationId: randomUUID() },
          "otp.verification_failed",
          id,
          { purpose: p },
        );
      return valid ? r : undefined;
    });
    requireCondition(valid, "OTP_INVALID", 401);
    return valid;
  }
  async consume(
    c: PoolClient,
    id: string,
    p: Purpose,
    code: string,
    actor: Actor,
  ) {
    const r = (
      await c.query<OtpRow>(
        "SELECT * FROM otp_challenges WHERE id=$1 AND expires_at>clock_timestamp() FOR UPDATE",
        [id],
      )
    ).rows[0];
    requireCondition(this.valid(r, p, code), "OTP_INVALID", 401);
    await c.query("UPDATE otp_challenges SET used_at=now() WHERE id=$1", [id]);
    await this.audit.append(c, actor, "otp.verified", id, { purpose: p });
    return r;
  }
}
