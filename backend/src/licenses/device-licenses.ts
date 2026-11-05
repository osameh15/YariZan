import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { Database } from "../database/database";
import { requireCondition } from "../common/errors";
import { Audit, Actor } from "../audit/audit";
import { Licenses, LicenseRow } from "./licenses";

export type SiblingDevice = {
  username: string;
  label: string | null;
  current: boolean;
  created_at: Date;
};

/**
 * Devices that share one verified mobile number, their customer-chosen names, and moving a paid
 * license from one of those devices to another. A customer may move each purchase once; an Admin
 * may move it again for support. The source entitlement and its license are revoked, so the old
 * device loses the product at its next license check; the target device picks the license up
 * through the normal purchased-license check.
 */
@Injectable()
export class DeviceLicenses {
  constructor(
    private db: Database,
    private licenses: Licenses,
    private audit: Audit,
  ) {}

  /** Active devices of the customer's verified mobile, oldest first. Unverified mobile: only itself. */
  async siblings(customerId: string, c?: PoolClient): Promise<SiblingDevice[]> {
    const sql = `SELECT o.username,o.device_label label,o.claimed_at created_at,o.id=me.id current
      FROM customers me JOIN customers o ON (o.id=me.id OR (me.mobile_verified_at IS NOT NULL
        AND o.mobile_verified_at IS NOT NULL AND o.mobile_lookup=me.mobile_lookup))
      JOIN devices d ON d.id=o.device_id AND d.generation=o.generation
      WHERE me.id=$1 AND o.state='ACTIVE' ORDER BY o.claimed_at,o.id`;
    return (
      c
        ? await c.query<SiblingDevice>(sql, [customerId])
        : await this.db.query<SiblingDevice>(sql, [customerId])
    ).rows;
  }

  async setLabel(customerId: string, label: string | null, actor: Actor) {
    return this.db.transaction(async (c) => {
      await c.query(
        "UPDATE customers SET device_label=$2 WHERE id=$1 AND state='ACTIVE'",
        [customerId, label],
      );
      await this.audit.append(
        c,
        actor,
        "customer.device_label_changed",
        customerId,
        {
          labelled: label !== null,
        },
      );
      return { label };
    });
  }

  /** Purchases of this customer's current device, with whether each can still be moved by the customer. */
  async movable(customerId: string) {
    return (
      await this.db.query<{
        id: string;
        sku: string;
        source_type: string;
        moved: boolean;
      }>(
        `SELECT e.id,e.sku,e.source_type,EXISTS(SELECT 1 FROM entitlements t WHERE t.transferred_from=e.id) moved
         FROM entitlements e JOIN customers c ON c.id=e.customer_id AND c.generation=e.generation
         WHERE c.id=$1 AND e.state='ACTIVE' ORDER BY e.sku`,
        [customerId],
      )
    ).rows.map((e) => ({
      id: e.id,
      sku: e.sku,
      customer_can_move: e.source_type === "PURCHASE" && !e.moved,
    }));
  }

  /**
   * Moves an active entitlement to another active device of the same verified mobile.
   * byCustomer: only the owner's own, never-moved purchases; Admin may also move ADMIN, CODE and
   * already moved entitlements. The target must not already own or be buying the product.
   */
  async move(
    entitlementId: string,
    targetUsername: string,
    actor: Actor,
    owner?: { customerId: string },
    client?: PoolClient,
  ) {
    const work = async (c: PoolClient) => {
      const source = (
        await c.query<{
          id: string;
          customer_id: string;
          device_id: string;
          generation: number;
          sku: string;
          source_type: string;
          state: string;
        }>("SELECT * FROM entitlements WHERE id=$1 FOR UPDATE", [entitlementId])
      ).rows[0];
      requireCondition(
        source && source.state === "ACTIVE",
        "ENTITLEMENT_NOT_FOUND",
        404,
      );
      if (owner) {
        requireCondition(
          source.customer_id === owner.customerId,
          "ENTITLEMENT_NOT_FOUND",
          404,
        );
        requireCondition(
          source.source_type === "PURCHASE",
          "MOVE_NOT_ALLOWED",
          409,
        );
      }
      const from = (
        await c.query<{ id: string; generation: number; state: string }>(
          "SELECT c.id,c.generation,c.state FROM customers c JOIN devices d ON d.id=c.device_id AND d.generation=c.generation WHERE c.id=$1 FOR UPDATE OF c",
          [source.customer_id],
        )
      ).rows[0];
      requireCondition(
        from &&
          from.state === "ACTIVE" &&
          from.generation === source.generation,
        "ACCOUNT_GENERATION_CHANGED",
        409,
      );
      requireCondition(
        !(
          await c.query(
            "SELECT 1 FROM entitlements WHERE transferred_from=$1",
            [source.id],
          )
        ).rowCount,
        "MOVE_NOT_ALLOWED",
        409,
      );
      const target = (await this.siblings(source.customer_id, c)).find(
        (d) => d.username === targetUsername && !d.current,
      );
      requireCondition(target, "TARGET_DEVICE_INVALID", 422);
      const to = (
        await c.query<{ id: string; device_id: string; generation: number }>(
          "SELECT id,device_id,generation FROM customers WHERE username=$1 AND state='ACTIVE' FOR UPDATE",
          [targetUsername],
        )
      ).rows[0];
      requireCondition(to, "TARGET_DEVICE_INVALID", 422);
      requireCondition(
        !(
          await c.query(
            `SELECT 1 FROM entitlements e WHERE e.device_id=$1 AND e.generation=$2 AND e.sku=$3
             AND NOT EXISTS(SELECT 1 FROM entitlements t WHERE t.transferred_from=e.id)`,
            [to.device_id, to.generation, source.sku],
          )
        ).rowCount,
        "ALREADY_OWNED",
        409,
      );
      requireCondition(
        !(
          await c.query(
            "SELECT 1 FROM orders WHERE device_id=$1 AND generation=$2 AND sku=$3 AND state IN ('PENDING','PAID','FULFILLMENT_PENDING')",
            [to.device_id, to.generation, source.sku],
          )
        ).rowCount,
        "ORDER_ALREADY_OPEN",
        409,
      );
      const license = (
        await c.query<LicenseRow>(
          "SELECT * FROM licenses WHERE entitlement_id=$1 FOR UPDATE",
          [source.id],
        )
      ).rows[0];
      if (license?.state === "ACTIVE")
        await this.licenses.change(c, license, "REVOKED", actor);
      await c.query("UPDATE entitlements SET state='REVOKED' WHERE id=$1", [
        source.id,
      ]);
      const moved = randomUUID();
      await c.query(
        "INSERT INTO entitlements(id,customer_id,device_id,generation,sku,source_type,transferred_from) VALUES($1,$2,$3,$4,$5,'TRANSFER',$6)",
        [moved, to.id, to.device_id, to.generation, source.sku, source.id],
      );
      await this.audit.append(c, actor, "entitlement.moved", source.id, {
        sku: source.sku,
        to_entitlement: moved,
        by: owner ? "customer" : "admin",
      });
      return {
        entitlement_id: moved,
        sku: source.sku,
        target_username: targetUsername,
      };
    };
    // Admin operations already run inside their own audited transaction.
    return client ? work(client) : this.db.transaction(work);
  }
}
