import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireCondition } from "../common/errors";
import { Orders } from "./orders";
import { campaignInput, codeInput, filters } from "./contracts";
import { Mutation } from "../common/schemas";

@Injectable()
export class CommerceAdministration {
  constructor(readonly orders: Orders) {}
  private async quota(
    c: PoolClient,
    scope: "campaign" | "code",
    id: string,
    total: number | null,
    per: number | null,
  ) {
    const field = scope === "campaign" ? "d.campaign_id" : "d.id";
    const use = (
      await c.query(
        `SELECT customer_id,count(*)::integer n FROM (
      SELECT r.customer_id FROM discount_reservations r JOIN discount_codes d ON d.id=r.code_id WHERE ${field}=$1 AND r.state IN ('RESERVED','UNKNOWN')
      UNION ALL SELECT r.customer_id FROM discount_redemptions r JOIN discount_codes d ON d.id=r.code_id WHERE ${field}=$1) x GROUP BY customer_id`,
        [id],
      )
    ).rows;
    requireCondition(
      (total === null || use.reduce((n, r) => n + r.n, 0) <= total) &&
        (per === null || use.every((r) => r.n <= per)),
      "QUOTA_BELOW_ALLOCATED",
      409,
    );
  }
  async campaign(c: PoolClient, b: z.infer<typeof campaignInput>, id?: string) {
    const current = id
      ? (
          await c.query(
            "SELECT * FROM discount_campaigns WHERE id=$1 FOR UPDATE",
            [id],
          )
        ).rows[0]
      : undefined;
    requireCondition(!id || current, "NOT_FOUND", 404);
    requireCondition(
      !current || Number(current.revision) === b.expected_revision,
      "STALE_REVISION",
      409,
    );
    const target = id ?? randomUUID();
    if (current)
      await this.quota(
        c,
        "campaign",
        target,
        b.max_redemptions,
        b.max_per_customer,
      );
    await c.query(
      "INSERT INTO discount_campaigns(id,name,starts_at,ends_at,enabled,max_redemptions,max_per_customer) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,enabled=EXCLUDED.enabled,max_redemptions=EXCLUDED.max_redemptions,max_per_customer=EXCLUDED.max_per_customer,revision=discount_campaigns.revision+1",
      [
        target,
        b.name,
        b.starts_at,
        b.ends_at,
        b.enabled,
        b.max_redemptions,
        b.max_per_customer,
      ],
    );
    return { id: target, revision: current ? Number(current.revision) + 1 : 1 };
  }
  async code(c: PoolClient, b: z.infer<typeof codeInput>, id?: string) {
    requireCondition(
      (
        await c.query(
          "SELECT id FROM discount_campaigns WHERE id=$1 FOR UPDATE",
          [b.campaign_id],
        )
      ).rowCount,
      "NOT_FOUND",
      404,
    );
    const current = id
      ? (
          await c.query("SELECT * FROM discount_codes WHERE id=$1 FOR UPDATE", [
            id,
          ])
        ).rows[0]
      : undefined;
    requireCondition(!id || current, "NOT_FOUND", 404);
    requireCondition(
      !current || Number(current.revision) === b.expected_revision,
      "STALE_REVISION",
      409,
    );
    requireCondition(
      !current || current.campaign_id === b.campaign_id,
      "CAMPAIGN_BINDING_IMMUTABLE",
      409,
    );
    const target = id ?? randomUUID();
    if (current)
      await this.quota(
        c,
        "code",
        target,
        b.max_redemptions,
        b.max_per_customer,
      );
    await c.query(
      "INSERT INTO discount_codes(id,campaign_id,code,type,value,max_discount_irr,min_order_irr,enabled,max_redemptions,max_per_customer) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET code=EXCLUDED.code,type=EXCLUDED.type,value=EXCLUDED.value,max_discount_irr=EXCLUDED.max_discount_irr,min_order_irr=EXCLUDED.min_order_irr,enabled=EXCLUDED.enabled,max_redemptions=EXCLUDED.max_redemptions,max_per_customer=EXCLUDED.max_per_customer,revision=discount_codes.revision+1",
      [
        target,
        b.campaign_id,
        b.code,
        b.type,
        b.value,
        b.max_discount_irr,
        b.min_order_irr,
        b.enabled,
        b.max_redemptions,
        b.max_per_customer,
      ],
    );
    await c.query("DELETE FROM discount_products WHERE code_id=$1", [target]);
    for (const sku of new Set(b.skus))
      await c.query("INSERT INTO discount_products VALUES($1,$2)", [
        target,
        sku,
      ]);
    return { id: target, revision: current ? Number(current.revision) + 1 : 1 };
  }
  async list(c: PoolClient, type: string, f: z.infer<typeof filters>) {
    const search = "%" + f.search.replace(/[\\%_]/g, "\\$&") + "%";
    let sql: string;
    if (type === "orders")
      sql =
        "SELECT o.id,o.sku,o.state,o.total_irr,o.discount_irr,o.subtotal_irr,o.created_at,o.paid_at,o.revision,o.device_id,o.customer_id,c.username,o.exception_code FROM orders o JOIN customers c ON c.id=o.customer_id";
    else if (type === "payments")
      sql =
        "SELECT p.id,p.order_id,p.state,p.provider_ref,p.authority,p.amount_irr,p.currency,p.created_at,p.verified_at,p.exception_code,o.sku,o.device_id,c.username FROM payment_attempts p JOIN orders o ON o.id=p.order_id JOIN customers c ON c.id=o.customer_id";
    else if (type === "campaigns") sql = "SELECT d.* FROM discount_campaigns d";
    else if (type === "coupons")
      sql =
        "SELECT d.*,c.name campaign_name,ARRAY(SELECT sku FROM discount_products WHERE code_id=d.id ORDER BY sku) skus FROM discount_codes d JOIN discount_campaigns c ON c.id=d.campaign_id";
    else if (type === "jobs") sql = "SELECT j.* FROM commerce_jobs j";
    else if (type === "exceptions")
      sql =
        "SELECT x.*,o.sku,c.username FROM commerce_exceptions x JOIN orders o ON o.id=x.order_id JOIN customers c ON c.id=o.customer_id";
    else if (type === "reservations")
      sql =
        "SELECT r.*,d.code FROM discount_reservations r JOIN discount_codes d ON d.id=r.code_id";
    else if (type === "redemptions")
      sql =
        "SELECT r.*,d.code FROM discount_redemptions r JOIN discount_codes d ON d.id=r.code_id";
    else if (type === "refunds")
      sql =
        "SELECT r.*,c.username FROM refund_requests r JOIN customers c ON c.id=r.customer_id";
    else requireCondition(false, "NOT_FOUND", 404);
    const noteType = ["orders", "payments", "campaigns", "coupons"].includes(
      type,
    )
      ? type
      : "none";
    const rows = (
      await c.query(
        `SELECT x.*,n.note,n.revision note_revision FROM (${sql}) x LEFT JOIN entity_notes n ON n.entity_type=$1 AND n.entity_id=x.id::text WHERE (to_jsonb(x)::text ILIKE $2 ESCAPE '\\' OR n.note ILIKE $2 ESCAPE '\\') AND ($3::text IS NULL OR COALESCE(to_jsonb(x)->>'state',to_jsonb(x)->>'enabled')=$3) AND ($4::timestamptz IS NULL OR (to_jsonb(x)->>'created_at')::timestamptz >=$4) AND ($5::timestamptz IS NULL OR (to_jsonb(x)->>'created_at')::timestamptz <$5) ORDER BY x.id DESC LIMIT $6 OFFSET $7`,
        [
          noteType,
          search,
          f.state ?? null,
          f.from ?? null,
          f.to ?? null,
          f.limit,
          f.offset,
        ],
      )
    ).rows;
    return {
      items: rows,
      next_offset: rows.length === f.limit ? f.offset + f.limit : null,
    };
  }
  async reconcile(c: PoolClient, id: string, b: Mutation) {
    const scope = (
      await c.query("SELECT device_id FROM orders WHERE id=$1", [id])
    ).rows[0];
    requireCondition(scope, "NOT_FOUND", 404);
    await c.query("SELECT id FROM devices WHERE id=$1 FOR UPDATE", [
      scope.device_id,
    ]);
    const o = (
      await c.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    requireCondition(o, "NOT_FOUND", 404);
    requireCondition(
      Number(o.revision) === b.expected_revision,
      "STALE_REVISION",
      409,
    );
    // Only retryable operational exceptions can be cleared; verification and ownership run again.
    await c.query(
      "UPDATE orders SET revision=revision+1,exception_code=CASE WHEN exception_code IN ('PRODUCT_BLOCKED','RECONCILIATION_REVIEW') THEN NULL ELSE exception_code END WHERE id=$1",
      [id],
    );
    await c.query(
      "UPDATE commerce_jobs SET state='PENDING',attempts=0,due_at=now(),lease_until=NULL,lease_token=NULL WHERE order_id=$1 AND state IN ('PENDING','REVIEW')",
      [id],
    );
    return { scheduled: true, revision: Number(o.revision) + 1 };
  }
  async finance(c: PoolClient, f: z.infer<typeof filters>) {
    const totals = (
      await c.query(
        "SELECT count(*) FILTER(WHERE paid_at IS NOT NULL)::text paid_orders,COALESCE(sum(subtotal_irr) FILTER(WHERE paid_at IS NOT NULL),0)::text gross_irr,COALESCE(sum(discount_irr) FILTER(WHERE paid_at IS NOT NULL),0)::text discount_irr,COALESCE(sum(total_irr) FILTER(WHERE paid_at IS NOT NULL),0)::text net_irr,count(*) FILTER(WHERE paid_at IS NOT NULL AND state<>'FULFILLED')::text paid_unfulfilled,count(*) FILTER(WHERE exception_code IS NOT NULL)::text exceptions FROM orders WHERE ($1::timestamptz IS NULL OR created_at >=$1) AND ($2::timestamptz IS NULL OR created_at<$2)",
        [f.from ?? null, f.to ?? null],
      )
    ).rows[0];
    const states = (
      await c.query(
        "SELECT state,count(*)::text count,COALESCE(sum(amount_irr),0)::text amount_irr FROM payment_attempts WHERE ($1::timestamptz IS NULL OR created_at >=$1) AND ($2::timestamptz IS NULL OR created_at<$2) GROUP BY state ORDER BY state",
        [f.from ?? null, f.to ?? null],
      )
    ).rows;
    const coupons = (
      await c.query(
        "SELECT count(*)::text redemptions FROM discount_redemptions WHERE ($1::timestamptz IS NULL OR created_at >=$1) AND ($2::timestamptz IS NULL OR created_at<$2)",
        [f.from ?? null, f.to ?? null],
      )
    ).rows[0];
    return {
      currency: "IRR",
      mode: "simulated",
      period_basis: "order_created_at",
      from: f.from ?? null,
      to: f.to ?? null,
      ...totals,
      ...coupons,
      payment_states: states,
    };
  }
}
