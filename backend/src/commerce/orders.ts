import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { z } from "zod";
import { Database } from "../database/database";
import { Security, CustomerContext } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { hash } from "../security/crypto";
import { canonical } from "../signing/signing";
import { Gateway } from "./gateway";
import { orderInput, quoteInput, discountAmount } from "./contracts";

export interface OrderRow {
  id: string;
  customer_id: string;
  device_id: string;
  generation: number;
  sku: string;
  total_irr: string;
  subtotal_irr: string;
  discount_irr: string;
  request_digest: string;
  state: string;
  expires_at: Date;
  accepted_payment_id: string | null;
  exception_code: string | null;
}
@Injectable()
export class Orders {
  constructor(
    readonly db: Database,
    readonly security: Security,
    readonly audit: Audit,
    readonly gateway: Gateway,
  ) {}
  async scope(c: PoolClient, u: CustomerContext) {
    const r = await c.query(
      "SELECT d.fingerprint_digest FROM devices d JOIN customers a ON a.device_id=d.id AND a.generation=d.generation AND a.state='ACTIVE' WHERE d.id=$1 AND a.id=$2 AND d.generation=$3 FOR UPDATE OF d",
      [u.device_id, u.id, u.generation],
    );
    requireCondition(r.rowCount, "ACCOUNT_RESTRICTED", 403);
    const session = await c.query(
      "SELECT 1 FROM customer_sessions WHERE token_hash=$1 AND customer_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE",
      [u.token_hash, u.id],
    );
    requireCondition(session.rowCount, "UNAUTHENTICATED", 401);
    return r.rows[0];
  }
  async eligible(c: PoolClient, u: CustomerContext, sku: string) {
    await this.scope(c, u);
    const d = {
      device_id: u.device_id,
      customer_id: u.id,
      generation: u.generation,
      key_id: "",
      fingerprint_digest: "",
    };
    await this.security.product(c, d, sku, "activation");
    const p = (
      await c.query(
        "SELECT p.*,r.amount_irr,r.id price_id FROM products p JOIN product_prices r ON r.sku=p.sku AND r.ended_at IS NULL WHERE p.sku=$1 FOR SHARE OF p,r",
        [sku],
      )
    ).rows[0];
    requireCondition(
      p?.sale_enabled && p.publication_status === "published",
      "PRODUCT_NOT_AVAILABLE",
      403,
    );
    requireCondition(
      !(
        await c.query(
          "SELECT 1 FROM entitlements WHERE device_id=$1 AND generation=$2 AND sku=$3",
          [u.device_id, u.generation, sku],
        )
      ).rowCount,
      "ALREADY_OWNED",
      409,
    );
    return p;
  }
  async coupon(
    c: PoolClient,
    code: string,
    sku: string,
    customerId: string,
    amount: number,
  ) {
    const found = (
      await c.query("SELECT id,campaign_id FROM discount_codes WHERE code=$1", [
        code,
      ])
    ).rows[0];
    requireCondition(found, "COUPON_UNAVAILABLE", 422);
    const campaign = (
      await c.query("SELECT * FROM discount_campaigns WHERE id=$1 FOR UPDATE", [
        found.campaign_id,
      ])
    ).rows[0];
    const rule = (
      await c.query("SELECT * FROM discount_codes WHERE id=$1 FOR UPDATE", [
        found.id,
      ])
    ).rows[0];
    const time = (await c.query("SELECT clock_timestamp() instant")).rows[0]
      .instant as Date;
    requireCondition(
      campaign.enabled &&
        rule.enabled &&
        campaign.starts_at <= time &&
        campaign.ends_at > time &&
        (
          await c.query(
            "SELECT 1 FROM discount_products WHERE code_id=$1 AND sku=$2",
            [rule.id, sku],
          )
        ).rowCount,
      "COUPON_UNAVAILABLE",
      422,
    );
    const usage = async (campaignScope: boolean, perCustomer: boolean) =>
      Number(
        (
          await c.query(
            `SELECT
      (SELECT count(*) FROM discount_reservations r JOIN discount_codes d ON d.id=r.code_id WHERE ${campaignScope ? "d.campaign_id" : "d.id"}=$1 AND r.state IN ('RESERVED','UNKNOWN') ${perCustomer ? "AND r.customer_id=$2" : ""})+
      (SELECT count(*) FROM discount_redemptions r JOIN discount_codes d ON d.id=r.code_id WHERE ${campaignScope ? "d.campaign_id" : "d.id"}=$1 ${perCustomer ? "AND r.customer_id=$2" : ""}) used`,
            perCustomer
              ? [campaignScope ? campaign.id : rule.id, customerId]
              : [campaignScope ? campaign.id : rule.id],
          )
        ).rows[0].used,
      );
    for (const [scope, per, limit] of [
      [true, false, campaign.max_redemptions],
      [true, true, campaign.max_per_customer],
      [false, false, rule.max_redemptions],
      [false, true, rule.max_per_customer],
    ] as const)
      if (limit !== null)
        requireCondition(
          (await usage(scope, per)) < limit,
          "COUPON_UNAVAILABLE",
          422,
        );
    return { rule, campaign, discount: discountAmount(amount, rule) };
  }
  async quote(u: CustomerContext, input: z.infer<typeof quoteInput>) {
    this.gateway.available();
    await this.security.rate("coupon-probe:" + u.id, 20, 300);
    return this.db.transaction(async (c) => {
      const p = await this.eligible(c, u, input.sku),
        amount = Number(p.amount_irr);
      const d = input.coupon
        ? await this.coupon(c, input.coupon, input.sku, u.id, amount)
        : undefined;
      requireCondition(
        amount - (d?.discount ?? 0) >= 10000,
        "ZERO_TOTAL_BLOCKED",
        422,
      );
      return {
        sku: p.sku,
        title_fa: p.title_fa,
        currency: "IRR",
        subtotal_irr: amount,
        discount_irr: d?.discount ?? 0,
        total_irr: amount - (d?.discount ?? 0),
        mode: "simulated",
        pricing_revision: Number(p.revision),
      };
    });
  }
  async create(
    u: CustomerContext,
    input: z.infer<typeof orderInput>,
    actor: Actor,
  ) {
    this.gateway.available();
    await this.security.rate("order-create:" + u.id, 20, 300);
    const digest = hash(canonical(input));
    return this.db.transaction(async (c) => {
      await this.scope(c, u);
      const prior = (
        await c.query<OrderRow>(
          "SELECT * FROM orders WHERE customer_id=$1 AND request_id=$2",
          [u.id, input.request_id],
        )
      ).rows[0];
      if (prior) {
        requireCondition(
          prior.request_digest === digest,
          "IDEMPOTENCY_MISMATCH",
          409,
        );
        return this.view(c, prior.id, u.id);
      }
      const p = await this.eligible(c, u, input.sku);
      const open = (
        await c.query(
          "SELECT id FROM orders WHERE device_id=$1 AND generation=$2 AND sku=$3 AND state IN ('PENDING','PAID','FULFILLMENT_PENDING','FULFILLED')",
          [u.device_id, u.generation, input.sku],
        )
      ).rows[0];
      requireCondition(!open, "ORDER_ALREADY_OPEN", 409);
      const id = randomUUID(),
        item = randomUUID(),
        amount = Number(p.amount_irr);
      const d = input.coupon
        ? await this.coupon(c, input.coupon, input.sku, u.id, amount)
        : undefined;
      const discount = d?.discount ?? 0,
        total = amount - discount;
      requireCondition(total >= 10000, "ZERO_TOTAL_BLOCKED", 422);
      await c.query(
        "INSERT INTO orders(id,customer_id,request_id,subtotal_irr,discount_irr,total_irr,state,device_id,generation,sku,request_digest) VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,$10)",
        [
          id,
          u.id,
          input.request_id,
          amount,
          discount,
          total,
          u.device_id,
          u.generation,
          p.sku,
          digest,
        ],
      );
      await c.query(
        "INSERT INTO order_items(id,order_id,sku,quantity,unit_price_irr,discount_irr,total_irr,snapshot) VALUES($1,$2,$3,1,$4,$5,$6,$7)",
        [
          item,
          id,
          p.sku,
          amount,
          discount,
          total,
          {
            title_fa: p.title_fa,
            username:
              p.username ??
              (
                await c.query("SELECT username FROM customers WHERE id=$1", [
                  u.id,
                ])
              ).rows[0].username,
            currency: "IRR",
            price_id: p.price_id,
            product_revision: Number(p.revision),
            coupon: input.coupon ?? null,
            code_revision: d ? Number(d.rule.revision) : null,
            campaign_revision: d ? Number(d.campaign.revision) : null,
          },
        ],
      );
      if (d)
        await c.query(
          "INSERT INTO discount_reservations(id,code_id,order_id,customer_id,expires_at,state) VALUES($1,$2,$3,$4,now()+interval '15 minutes','RESERVED')",
          [randomUUID(), d.rule.id, id, u.id],
        );
      await this.job(c, "EXPIRE", id, id, new Date(Date.now() + 900000));
      await this.audit.append(c, actor, "order.created", id, {
        sku: p.sku,
        total_irr: total,
      });
      return this.view(c, id, u.id);
    });
  }
  async job(
    c: PoolClient,
    kind: string,
    target: string,
    order: string,
    due = new Date(),
  ) {
    await c.query(
      "INSERT INTO commerce_jobs(id,kind,target_id,order_id,due_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(kind,target_id) DO NOTHING",
      [randomUUID(), kind, target, order, due],
    );
  }
  async view(c: PoolClient, id: string, customer?: string) {
    const r = (
      await c.query(
        "SELECT o.*,i.snapshot,i.id item_id,f.license_id FROM orders o JOIN order_items i ON i.order_id=o.id LEFT JOIN order_fulfillments f ON f.order_item_id=i.id WHERE o.id=$1 AND ($2::uuid IS NULL OR o.customer_id=$2)",
        [id, customer ?? null],
      )
    ).rows[0];
    requireCondition(r, "NOT_FOUND", 404);
    const payments = (
      await c.query(
        "SELECT id,state,created_at,verified_at,provider_ref,exception_code,redirect_url FROM payment_attempts WHERE order_id=$1 ORDER BY created_at,id",
        [id],
      )
    ).rows;
    return {
      id: r.id,
      customer_id: r.customer_id,
      device_id: r.device_id,
      generation: r.generation,
      sku: r.sku,
      state: r.state,
      currency: r.currency,
      created_at: r.created_at,
      paid_at: r.paid_at,
      expires_at: r.expires_at,
      exception_code: r.exception_code,
      license_id: r.license_id,
      snapshot: r.snapshot,
      subtotal_irr: Number(r.subtotal_irr),
      discount_irr: Number(r.discount_irr),
      total_irr: Number(r.total_irr),
      revision: Number(r.revision),
      mode: "simulated",
      payments,
    };
  }
  async read(u: CustomerContext, id: string) {
    return this.db.transaction((c) => this.view(c, id, u.id));
  }
  async list(u: CustomerContext, offset: number) {
    return {
      items: (
        await this.db.query(
          "SELECT id,sku,state,total_irr,created_at,paid_at,exception_code FROM orders WHERE customer_id=$1 ORDER BY created_at DESC,id LIMIT 20 OFFSET $2",
          [u.id, offset],
        )
      ).rows.map((r) => ({ ...r, total_irr: Number(r.total_irr) })),
      next_offset: offset + 20,
    };
  }
}
