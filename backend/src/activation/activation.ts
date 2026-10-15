import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { z } from "zod";
import { Database } from "../database/database";
import { Security, DeviceContext } from "../security/security";
import { Licenses } from "../licenses/licenses";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { redeemSchema } from "../common/schemas";
import { activationCode, normalizeCode, keyed, hash } from "../security/crypto";
import { canonical, Envelope } from "../signing/signing";

@Injectable()
export class Activation {
  constructor(
    private db: Database,
    private security: Security,
    private licenses: Licenses,
    private audit: Audit,
  ) {}
  verifier(code: string) {
    return keyed(
      this.security.config.CODE_HMAC_KEY,
      "YariZan-Activation-Code-V2:v1",
      normalizeCode(code),
    );
  }
  async issue(
    c: PoolClient,
    d: DeviceContext,
    sku: string,
    expires: string,
    actor: Actor,
  ) {
    await this.security.product(c, d, sku, "activation");
    const code = activationCode(),
      id = randomUUID();
    await c.query(
      `INSERT INTO activation_codes(id,verifier,key_version,sku,device_id,customer_id,generation,expires_at) VALUES($1,$2,'v1',$3,$4,$5,$6,$7)`,
      [
        id,
        this.verifier(code),
        sku,
        d.device_id,
        d.customer_id,
        d.generation,
        expires,
      ],
    );
    await this.audit.append(c, actor, "activation_code.issued", id, { sku });
    return { code_id: id, activation_code: code };
  }
  async cancel(c: PoolClient, id: string, actor: Actor) {
    const r = await c.query(
      "UPDATE activation_codes SET status='CANCELLED' WHERE id=$1 AND status='ISSUED' RETURNING id",
      [id],
    );
    requireCondition(r.rowCount, "CODE_NOT_CANCELLABLE", 409);
    await this.audit.append(c, actor, "activation_code.cancelled", id);
    return { cancelled: true };
  }
  async redeem(
    bearer: string,
    input: z.infer<typeof redeemSchema>,
    actor: Actor,
  ) {
    return this.db.transaction(async (c) => {
      const d = await this.security.device(c, bearer);
      requireCondition(d.device_id === input.device_id, "DEVICE_MISMATCH", 403);
      await this.security.product(c, d, input.sku, "activation");
      const verifier = this.verifier(input.activation_code);
      const requestDigest = hash(
        canonical({
          device_id: d.device_id,
          sku: input.sku,
          verifier,
          request_id: input.request_id,
        }),
      );
      const replay = (
        await c.query<{ request_digest: string; signed_license: Envelope }>(
          "SELECT request_digest,signed_license FROM activation_redemptions WHERE device_id=$1 AND generation=$2 AND request_id=$3",
          [d.device_id, d.generation, input.request_id],
        )
      ).rows[0];
      if (replay) {
        requireCondition(
          replay.request_digest === requestDigest,
          "IDEMPOTENCY_MISMATCH",
          409,
        );
        const l = await c.query(
          "SELECT 1 FROM licenses WHERE id=$1 AND state='ACTIVE'",
          [replay.signed_license.payload.license_id],
        );
        requireCondition(l.rowCount, "LICENSE_REVOKED", 403);
        return replay.signed_license;
      }
      const code = (
        await c.query<{
          id: string;
          sku: string;
          device_id: string;
          customer_id: string;
          generation: number;
          status: string;
          expires_at: Date;
        }>(
          "SELECT * FROM activation_codes WHERE verifier=$1 AND key_version='v1' FOR UPDATE",
          [verifier],
        )
      ).rows[0];
      requireCondition(
        code &&
          code.sku === input.sku &&
          code.device_id === d.device_id &&
          code.customer_id === d.customer_id,
        "ACTIVATION_CODE_INVALID",
      );
      requireCondition(
        code.generation === d.generation,
        "ACCOUNT_RESTRICTED",
        403,
      );
      requireCondition(
        code.status !== "CANCELLED",
        "ACTIVATION_CODE_CANCELLED",
      );
      requireCondition(code.status !== "REDEEMED", "ACTIVATION_CODE_USED");
      requireCondition(
        code.expires_at.getTime() > Date.now(),
        "ACTIVATION_CODE_EXPIRED",
      );
      // An old revoked license is never bypassed by creating a different ID from a new code.
      const revoked = await c.query(
        `SELECT 1 FROM licenses l JOIN entitlements e ON e.id=l.entitlement_id WHERE l.device_id=$1 AND l.sku=$2 AND e.generation=$3 AND l.state='REVOKED'`,
        [d.device_id, input.sku, d.generation],
      );
      requireCondition(!revoked.rowCount, "RECOVERY_REQUIRED", 409);
      const license = await this.licenses.issue(c, d, input.sku, "CODE", actor);
      await c.query(
        "UPDATE activation_codes SET status='REDEEMED' WHERE id=$1",
        [code.id],
      );
      await c.query(
        "INSERT INTO activation_redemptions(device_id,generation,request_id,request_digest,code_id,signed_license) VALUES($1,$2,$3,$4,$5,$6)",
        [
          d.device_id,
          d.generation,
          input.request_id,
          requestDigest,
          code.id,
          license,
        ],
      );
      await this.audit.append(
        c,
        { ...actor, type: "DEVICE", id: d.key_id },
        "activation_code.redeemed",
        code.id,
        { sku: input.sku },
      );
      return license;
    });
  }
}
