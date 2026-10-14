import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Signing, canonical, Envelope } from "../signing/signing";
import { hash } from "../security/crypto";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { startSchema } from "../common/schemas";

export type TrialResponse = {
  grant: Envelope;
  remaining: number;
  server_time: string;
};
@Injectable()
export class Trials {
  constructor(
    private db: Database,
    private security: Security,
    private signing: Signing,
    private audit: Audit,
  ) {}
  async status(bearer: string, sku: string) {
    return this.db.transaction(async (c) => {
      const d = await this.security.device(c, bearer);
      await this.security.product(c, d, sku, "trial");
      const r = await c.query<{ used: number }>(
        "SELECT used FROM trial_counters WHERE device_id=$1 AND sku=$2 AND generation=$3",
        [d.device_id, sku, d.generation],
      );
      return { remaining: 2 - (r.rows[0]?.used ?? 0) };
    });
  }
  async start(
    bearer: string,
    sku: string,
    input: z.infer<typeof startSchema>,
    actor: Actor,
  ) {
    return this.db.transaction(async (c) => {
      const d = await this.security.device(c, bearer);
      requireCondition(d.device_id === input.device_id, "DEVICE_MISMATCH", 403);
      const p = await this.security.product(c, d, sku, "trial");
      await c.query(
        "INSERT INTO trial_counters(device_id,sku,generation) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [d.device_id, sku, d.generation],
      );
      const counter = (
        await c.query<{ used: number }>(
          "SELECT used FROM trial_counters WHERE device_id=$1 AND sku=$2 AND generation=$3 FOR UPDATE",
          [d.device_id, sku, d.generation],
        )
      ).rows[0];
      const digest = hash(canonical({ ...input, sku }));
      const previous = (
        await c.query<{ request_digest: string; response: TrialResponse }>(
          "SELECT request_digest,response FROM trial_starts WHERE device_id=$1 AND sku=$2 AND generation=$3 AND nonce=$4",
          [d.device_id, sku, d.generation, input.client_nonce],
        )
      ).rows[0];
      if (previous) {
        requireCondition(
          previous.request_digest === digest,
          "IDEMPOTENCY_MISMATCH",
          409,
        );
        return previous.response;
      }
      requireCondition(counter.used < 2, "TRIAL_EXHAUSTED", 403);
      const grant = this.signing.artifact("trial", {
        device_id: d.device_id,
        sku,
        grade: p.grade,
        client_nonce: input.client_nonce,
        process_session_id: input.client_process_session_id,
      });
      const response: TrialResponse = {
        grant,
        remaining: 1 - counter.used,
        server_time: new Date().toISOString(),
      };
      const stored = await c.query<{response:TrialResponse}>(
        "INSERT INTO trial_starts(id,device_id,sku,generation,nonce,request_digest,response) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING response",
        [
          randomUUID(),
          d.device_id,
          sku,
          d.generation,
          input.client_nonce,
          digest,
          response,
        ],
      );
      await c.query(
        "UPDATE trial_counters SET used=used+1 WHERE device_id=$1 AND sku=$2 AND generation=$3",
        [d.device_id, sku, d.generation],
      );
      await this.audit.append(
        c,
        { ...actor, type: "DEVICE", id: d.key_id },
        "trial.started",
        d.device_id,
        { sku, generation: d.generation },
      );
      return stored.rows[0].response;
    });
  }
}
