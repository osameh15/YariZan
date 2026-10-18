import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Request } from "express";
import { PoolClient } from "pg";
import { Database } from "../database/database";
import { Security, DeviceContext } from "../security/security";
import { Licenses, LicenseRow } from "../licenses/licenses";
import { Activation } from "../activation/activation";
import { Accounts } from "../accounts/accounts";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { Mutation } from "../common/schemas";
import { hash } from "../security/crypto";
import { canonical } from "../signing/signing";

@Injectable()
export class Admin {
  constructor(
    private db: Database,
    private security: Security,
    private licenses: Licenses,
    private activation: Activation,
    private accounts: Accounts,
    private audit: Audit,
  ) {}
  async operation(
    req: Request,
    permission: string,
    input: Mutation,
    target: Record<string, unknown>,
    work: (c: PoolClient, actor: Actor) => Promise<unknown>,
  ) {
    return this.db.transaction(async (c) => {
      const admin = await this.security.admin(req, permission, c);
      const requestDigest = hash(canonical({ permission, input, target }));
      const previous = (
        await c.query<{ request_digest: string; response: unknown }>(
          "SELECT request_digest,response FROM admin_operations WHERE admin_id=$1 AND request_id=$2",
          [admin.id, input.request_id],
        )
      ).rows[0];
      if (previous) {
        requireCondition(
          previous.request_digest === requestDigest,
          "IDEMPOTENCY_MISMATCH",
          409,
        );
        return previous.response;
      }
      const actor: Actor = {
        type: "ADMIN",
        id: admin.id,
        correlationId: req.res!.locals.correlationId,
      };
      const response = await work(c, actor);
      const safe = { ...(response as Record<string, unknown>) };
      for (const secret of ["activation_code", "reset_grant"])
        if (secret in safe) {
          delete safe[secret];
          safe.secret_already_delivered = true;
        }
      await c.query(
        "INSERT INTO admin_operations(admin_id,request_id,request_digest,response) VALUES($1,$2,$3,$4)",
        [admin.id, input.request_id, requestDigest, safe],
      );
      await this.audit.append(
        c,
        actor,
        permission + ".operation",
        String(target.id ?? target.device_id ?? target.sku),
        { reason: input.reason, request_id: input.request_id },
      );
      return response;
    });
  }
  async device(c: PoolClient, id: string): Promise<DeviceContext> {
    const r = await c.query<DeviceContext>(
      `SELECT d.id device_id,c.id customer_id,d.generation,d.fingerprint_digest FROM devices d
      JOIN customers c ON c.device_id=d.id AND c.generation=d.generation AND c.state='ACTIVE' WHERE d.id=$1 FOR UPDATE OF d`,
      [id],
    );
    requireCondition(r.rows[0], "ACCOUNT_RESTRICTED", 403);
    return r.rows[0];
  }
  async reset(
    c: PoolClient,
    customerId: string,
    input: Mutation,
    actor: Actor,
  ) {
    const found = (
      await c.query<{ device_id: string; state: string }>(
        "SELECT device_id,state FROM customers WHERE id=$1",
        [customerId],
      )
    ).rows[0];
    requireCondition(found, "NOT_FOUND", 404);
    const d = (
      await c.query<{ generation: number }>(
        "SELECT generation FROM devices WHERE id=$1 FOR UPDATE",
        [found.device_id],
      )
    ).rows[0];
    const current = (
      await c.query<{ state: string; generation: number }>(
        "SELECT state,generation FROM customers WHERE id=$1 FOR UPDATE",
        [customerId],
      )
    ).rows[0];
    requireCondition(
      current.state === "ACTIVE" &&
        current.generation === d.generation &&
        d.generation === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    const licenses = await c.query<LicenseRow>(
      `SELECT l.* FROM licenses l JOIN entitlements e ON e.id=l.entitlement_id WHERE e.customer_id=$1 AND l.state='ACTIVE' ORDER BY l.id FOR UPDATE OF l`,
      [customerId],
    );
    for (const l of licenses.rows)
      await this.licenses.change(c, l, "REVOKED", actor);
    await c.query(
      "UPDATE entitlements SET state='RESET' WHERE customer_id=$1",
      [customerId],
    );
    await c.query(
      "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1",
      [customerId],
    );
    await c.query(
      "UPDATE password_resets SET used_at=now() WHERE customer_id=$1 AND used_at IS NULL",
      [customerId],
    );
    await c.query(
      "UPDATE device_keys SET status='REVOKED' WHERE customer_id=$1",
      [customerId],
    );
    await c.query(
      "UPDATE device_credentials SET revoked_at=now() WHERE key_id IN (SELECT id FROM device_keys WHERE customer_id=$1)",
      [customerId],
    );
    await c.query(
      "UPDATE pairings SET cancelled_at=now() WHERE device_id=$1 AND generation=$2",
      [found.device_id, d.generation],
    );
    await c.query(
      "UPDATE activation_codes SET status='CANCELLED' WHERE customer_id=$1 AND status='ISSUED'",
      [customerId],
    );
    await c.query(
      "UPDATE customers SET state='RESET',password_hash=NULL,mobile_ciphertext=NULL,mobile_lookup=NULL,mobile_last4=NULL,mobile_verified_at=NULL,reset_at=now() WHERE id=$1",
      [customerId],
    );
    await c.query("UPDATE devices SET generation=generation+1 WHERE id=$1", [
      found.device_id,
    ]);
    await c.query(
      "INSERT INTO customer_reset_events(id,device_id,customer_id,prior_generation,next_generation,reason) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        found.device_id,
        customerId,
        d.generation,
        d.generation + 1,
        input.reason,
      ],
    );
    await this.audit.append(c, actor, "customer.reset", customerId, {
      next_generation: d.generation + 1,
    });
    return { generation: d.generation + 1 };
  }
  async restrict(
    c: PoolClient,
    deviceId: string,
    sku: string,
    blocked: boolean,
    input: Mutation,
    actor: Actor,
  ) {
    requireCondition(
      (
        await c.query("SELECT 1 FROM devices WHERE id=$1 FOR UPDATE", [
          deviceId,
        ])
      ).rowCount,
      "NOT_FOUND",
      404,
    );
    await c.query(
      "INSERT INTO device_product_restrictions(device_id,sku,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [deviceId, sku, "initial"],
    );
    const b = (
      await c.query<{ revision: string }>(
        "SELECT revision FROM device_product_restrictions WHERE device_id=$1 AND sku=$2 FOR UPDATE",
        [deviceId, sku],
      )
    ).rows[0];
    requireCondition(
      Number(b.revision) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    await c.query(
      "UPDATE device_product_restrictions SET blocked=$3,revision=revision+1,reason=$4 WHERE device_id=$1 AND sku=$2",
      [deviceId, sku, blocked, input.reason],
    );
    if (blocked) {
      const rows = await c.query<LicenseRow>(
        "SELECT * FROM licenses WHERE device_id=$1 AND sku=$2 AND state='ACTIVE' ORDER BY id FOR UPDATE",
        [deviceId, sku],
      );
      for (const l of rows.rows)
        await this.licenses.change(c, l, "REVOKED", actor);
    }
    await this.audit.append(
      c,
      actor,
      blocked ? "product.blocked" : "product.unblocked",
      deviceId,
      { sku },
    );
    return { restriction_revision: Number(b.revision) + 1 };
  }
  async revoke(
    c: PoolClient,
    id: string,
    input: Mutation,
    actor: Actor,
    recover = false,
  ) {
    const found = (
      await c.query<{ device_id: string }>(
        "SELECT device_id FROM licenses WHERE id=$1",
        [id],
      )
    ).rows[0];
    requireCondition(found, "NOT_FOUND", 404);
    await c.query("SELECT 1 FROM devices WHERE id=$1 FOR UPDATE", [
      found.device_id,
    ]);
    const l = (
      await c.query<LicenseRow>(
        "SELECT * FROM licenses WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    requireCondition(
      Number(l.decision_version) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    if (recover) {
      requireCondition(input.evidence_ref, "OWNERSHIP_EVIDENCE_REQUIRED", 403);
      const d = await this.device(c, l.device_id);
      await this.security.product(c, d, l.sku);
      const e = await c.query(
        "SELECT 1 FROM entitlements WHERE id=$1 AND generation=$2 AND customer_id=$3 AND state='ACTIVE'",
        [l.entitlement_id, d.generation, d.customer_id],
      );
      requireCondition(e.rowCount, "CROSS_ID_RECOVERY_BLOCKED", 409);
    }
    const result = await this.licenses.change(
      c,
      l,
      recover ? "ACTIVE" : "REVOKED",
      actor,
    );
    if (recover)
      await c.query(
        "INSERT INTO license_recoveries(id,license_id,decision_version,evidence_ref) VALUES($1,$2,$3,$4)",
        [randomUUID(), id, result.payload.decision_version, input.evidence_ref],
      );
    return result;
  }
  async trialReset(
    c: PoolClient,
    deviceId: string,
    sku: string,
    input: Mutation,
    actor: Actor,
  ) {
    const d = await this.device(c, deviceId);
    requireCondition(
      d.generation === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    await this.security.product(c, d, sku, "trial");
    await c.query(
      "INSERT INTO trial_counters(device_id,sku,generation) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [deviceId, sku, d.generation],
    );
    const previous = (
      await c.query<{ used: number; allocation_epoch: string }>(
        "SELECT used,allocation_epoch FROM trial_counters WHERE device_id=$1 AND sku=$2 AND generation=$3 FOR UPDATE",
        [deviceId, sku, d.generation],
      )
    ).rows[0];
    requireCondition(
      Number(previous.allocation_epoch) < Number.MAX_SAFE_INTEGER,
      "TRIAL_ALLOCATION_EXHAUSTED",
      409,
    );
    const allocationEpoch = Number(previous.allocation_epoch) + 1;
    await c.query(
      "UPDATE trial_counters SET used=0,allocation_epoch=$4 WHERE device_id=$1 AND sku=$2 AND generation=$3",
      [deviceId, sku, d.generation, allocationEpoch],
    );
    await this.audit.append(c, actor, "trial.reset", deviceId, {
      sku,
      generation: d.generation,
      retired_allocation_epoch: previous.allocation_epoch,
      retired_used: previous.used,
      allocation_epoch: allocationEpoch,
    });
    return {
      remaining: 2,
      generation: d.generation,
      allocation_epoch: allocationEpoch,
    };
  }
  async issue(
    c: PoolClient,
    deviceId: string,
    sku: string,
    input: Mutation,
    actor: Actor,
    expires?: string,
  ) {
    requireCondition(input.evidence_ref, "OWNERSHIP_EVIDENCE_REQUIRED", 403);
    const d = await this.device(c, deviceId);
    requireCondition(
      d.generation === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    const revoked = await c.query(
      `SELECT 1 FROM licenses l JOIN entitlements e ON e.id=l.entitlement_id WHERE l.device_id=$1 AND l.sku=$2 AND e.generation=$3 AND l.state='REVOKED'`,
      [deviceId, sku, d.generation],
    );
    requireCondition(!revoked.rowCount, "RECOVERY_REQUIRED", 409);
    return expires
      ? this.activation.issue(c, d, sku, expires, actor)
      : this.licenses.issue(c, d, sku, "ADMIN", actor);
  }
  async cancel(c: PoolClient, id: string, actor: Actor) {
    return this.activation.cancel(c, id, actor);
  }
  async passwordReset(
    c: PoolClient,
    customer: string,
    input: Mutation,
    actor: Actor,
  ) {
    requireCondition(input.evidence_ref, "OWNERSHIP_EVIDENCE_REQUIRED", 403);
    const r = (
      await c.query<{ device_id: string; generation: number }>(
        "SELECT device_id,generation FROM customers WHERE id=$1",
        [customer],
      )
    ).rows[0];
    requireCondition(r, "NOT_FOUND", 404);
    requireCondition(
      r.generation === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    await c.query("SELECT 1 FROM devices WHERE id=$1 FOR UPDATE", [
      r.device_id,
    ]);
    return this.accounts.issueReset(c, customer, input.evidence_ref, actor);
  }
  async products(
    c: PoolClient,
    sku: string,
    input: Mutation,
    changes: {
      price_irr: number;
      publication_status: string;
      sale_enabled: boolean;
      trial_enabled: boolean;
      activation_enabled: boolean;
    },
    actor: Actor,
  ) {
    const r = (
      await c.query<{ revision: string }>(
        "SELECT revision FROM products WHERE sku=$1 FOR UPDATE",
        [sku],
      )
    ).rows[0];
    requireCondition(
      r && Number(r.revision) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    requireCondition(
      changes.publication_status === "published" ||
        (!changes.sale_enabled &&
          !changes.trial_enabled &&
          !changes.activation_enabled),
      "PRODUCT_NOT_AVAILABLE",
      409,
    );
    await c.query(
      "UPDATE products SET publication_status=$2,sale_enabled=$3,trial_enabled=$4,activation_enabled=$5,revision=revision+1 WHERE sku=$1",
      [
        sku,
        changes.publication_status,
        changes.sale_enabled,
        changes.trial_enabled,
        changes.activation_enabled,
      ],
    );
    // One instant closes the previous price and begins the next; no overlap/gap.
    await c.query(
      "UPDATE product_prices SET ended_at=transaction_timestamp() WHERE sku=$1 AND ended_at IS NULL",
      [sku],
    );
    await c.query(
      "INSERT INTO product_prices(id,sku,amount_irr,effective_at,changed_by,source) VALUES($1,$2,$3,transaction_timestamp(),$4,'ADMIN')",
      [randomUUID(), sku, changes.price_irr, actor.id],
    );
    await this.audit.append(c, actor, "product.updated", sku, {
      price_irr: changes.price_irr,
    });
    return { revision: Number(r.revision) + 1 };
  }
}
