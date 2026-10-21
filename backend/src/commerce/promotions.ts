import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { z } from "zod";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { mutationSchema } from "../common/schemas";
import { Security } from "../security/security";

/**
 * Product promotional pricing.
 *
 * A promotion is a separate, audited record priced against the list price that was current when it
 * was created. It never rewrites the immutable price history. It applies only while ENABLED, inside
 * its window on DATABASE time, and while the list price still equals the price it was created
 * against, so expiry needs no manual action and a list price change can never silently change a
 * promotion's economics (the Admin price update is refused while a promotion is scheduled or active).
 */
export const minimumChargeIrr = 10000;
export type PromotionStatus = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "DISABLED";
export const promoMoney = z
  .number()
  .int()
  .min(minimumChargeIrr)
  .max(Number.MAX_SAFE_INTEGER);
export const promotionCreate = mutationSchema.extend({
  promo_price_irr: promoMoney,
  starts_at: z.iso.datetime().optional(),
  ends_at: z.iso.datetime(),
});
export const promotionUpdate = mutationSchema
  .extend({
    promo_price_irr: promoMoney.optional(),
    starts_at: z.iso.datetime().optional(),
    ends_at: z.iso.datetime().optional(),
  })
  .refine(
    (v) =>
      v.promo_price_irr !== undefined ||
      v.starts_at !== undefined ||
      v.ends_at !== undefined,
    { message: "Nothing to change" },
  );
export const promotionDecision = mutationSchema;

export interface PromotionRow {
  id: string;
  sku: string;
  base_price_id: string;
  original_price_irr: string;
  promo_price_irr: string;
  discount_percent: number;
  starts_at: Date;
  ends_at: Date;
  state: "ENABLED" | "DISABLED";
  revision: string;
  reason: string;
  created_by: string;
  updated_by: string;
  created_at: Date;
  updated_at: Date;
  status: PromotionStatus;
}
export interface ActivePromotion {
  id: string;
  revision: number;
  original_price_irr: number;
  price_irr: number;
  discount_irr: number;
  discount_percent: number;
  starts_at: Date;
  ends_at: Date;
}
export interface Pricing {
  sku: string;
  price_id: string;
  list_price_irr: number;
  promotion: ActivePromotion | null;
  effective_price_irr: number;
  priced_at: Date;
  /** True only for the local acceptance test price (never in a release). */
  test_price?: boolean;
}
// Exact integer percentage (whole percent, rounded down) from two integer prices. The database
// column is generated from the same formula; this mirrors it for validation and previews.
export function discountPercent(original: number, promo: number) {
  return Number(((BigInt(original) - BigInt(promo)) * 100n) / BigInt(original));
}
// Derived state at a database instant; never trusts a client clock.
export const statusSql = `CASE WHEN q.state='DISABLED' THEN 'DISABLED' WHEN clock_timestamp()<q.starts_at THEN 'SCHEDULED' WHEN clock_timestamp()>=q.ends_at THEN 'EXPIRED' ELSE 'ACTIVE' END`;
// The promotion that prices new quotes for a product row `r` (current list price). Used by the
// public catalog, quotes and order creation so every surface agrees.
export const activePromotionSql = `q.sku=r.sku AND q.state='ENABLED' AND q.original_price_irr=r.amount_irr AND q.starts_at<=clock_timestamp() AND q.ends_at>clock_timestamp()`;

@Injectable()
export class Promotions {
  constructor(
    private audit: Audit,
    private security: Security,
  ) {}

  /** Current list price and the active promotion, decided in one statement on database time. */
  async pricing(c: PoolClient, sku: string, lock = false): Promise<Pricing> {
    const row = (
      await c.query(
        `SELECT r.id price_id,r.amount_irr,clock_timestamp() priced_at,q.id promo_id,q.revision promo_revision,
          q.original_price_irr,q.promo_price_irr,q.discount_percent,q.starts_at,q.ends_at
        FROM product_prices r LEFT JOIN LATERAL (SELECT * FROM product_promotions q WHERE ${activePromotionSql} ORDER BY q.starts_at DESC LIMIT 1 ${lock ? "FOR SHARE" : ""}) q ON true
        WHERE r.sku=$1 AND r.ended_at IS NULL`,
        [sku],
      )
    ).rows[0];
    requireCondition(row, "PRODUCT_NOT_AVAILABLE", 403);
    // Local acceptance only (config refuses it outside development/test): Grade 1 is priced at the
    // configured test amount, no promotion applies, and everything downstream (quote, order snapshot,
    // payment, verification) uses that one amount and is labelled as a test price.
    const testPrice = this.security.config.LOCAL_TEST_PRICE_G1_IRR;
    if (testPrice !== undefined && sku === "YARIZAN-G1")
      return {
        sku,
        price_id: row.price_id,
        list_price_irr: testPrice,
        promotion: null,
        effective_price_irr: testPrice,
        priced_at: row.priced_at,
        test_price: true,
      };
    const list = Number(row.amount_irr);
    const promotion: ActivePromotion | null = row.promo_id
      ? {
          id: row.promo_id,
          revision: Number(row.promo_revision),
          original_price_irr: Number(row.original_price_irr),
          price_irr: Number(row.promo_price_irr),
          discount_irr: list - Number(row.promo_price_irr),
          discount_percent: row.discount_percent,
          starts_at: row.starts_at,
          ends_at: row.ends_at,
        }
      : null;
    return {
      sku,
      price_id: row.price_id,
      list_price_irr: list,
      promotion,
      effective_price_irr: promotion ? promotion.price_irr : list,
      priced_at: row.priced_at,
    };
  }

  async list(c: PoolClient, sku: string) {
    const rows = (
      await c.query<PromotionRow>(
        `SELECT q.*,${statusSql} AS status FROM product_promotions q WHERE q.sku=$1 ORDER BY q.starts_at DESC,q.id`,
        [sku],
      )
    ).rows;
    const events = (
      await c.query(
        "SELECT e.promotion_id,e.revision,e.action,e.reason,e.admin_id,a.username admin_username,e.created_at FROM product_promotion_events e JOIN product_promotions q ON q.id=e.promotion_id JOIN admins a ON a.id=e.admin_id WHERE q.sku=$1 ORDER BY e.created_at,e.revision",
        [sku],
      )
    ).rows;
    return {
      promotions: rows.map((r) => this.view(r)),
      history: events,
    };
  }
  view(r: PromotionRow) {
    return {
      id: r.id,
      sku: r.sku,
      original_price_irr: Number(r.original_price_irr),
      promo_price_irr: Number(r.promo_price_irr),
      discount_percent: r.discount_percent,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      state: r.state,
      status: r.status,
      revision: Number(r.revision),
      reason: r.reason,
      updated_by: r.updated_by,
      updated_at: r.updated_at,
    };
  }
  private async load(c: PoolClient, id: string) {
    const r = (
      await c.query<PromotionRow>(
        `SELECT q.*,${statusSql} AS status FROM product_promotions q WHERE q.id=$1 FOR UPDATE`,
        [id],
      )
    ).rows[0];
    requireCondition(r, "NOT_FOUND", 404);
    return r;
  }
  private async event(
    c: PoolClient,
    id: string,
    action: string,
    reason: string,
    actor: Actor,
  ) {
    const r = await this.load(c, id);
    await c.query(
      "INSERT INTO product_promotion_events(id,promotion_id,revision,action,snapshot,reason,admin_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [randomUUID(), id, r.revision, action, this.view(r), reason, actor.id],
    );
    await this.audit.append(c, actor, "promotion." + action.toLowerCase(), id, {
      sku: r.sku,
      promo_price_irr: Number(r.promo_price_irr),
      original_price_irr: Number(r.original_price_irr),
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      state: r.state,
      revision: Number(r.revision),
    });
    return this.view(r);
  }
  private conflict(error: unknown): never {
    const e = error as { code?: string; constraint?: string };
    if (e?.code === "23P01") requireCondition(false, "PROMOTION_OVERLAP", 409);
    throw error;
  }

  async create(
    c: PoolClient,
    sku: string,
    input: z.infer<typeof promotionCreate>,
    actor: Actor,
  ) {
    const product = (
      await c.query<{ revision: string }>(
        "SELECT revision FROM products WHERE sku=$1 FOR UPDATE",
        [sku],
      )
    ).rows[0];
    requireCondition(product, "NOT_FOUND", 404);
    requireCondition(
      Number(product.revision) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    const price = (
      await c.query<{ id: string; amount_irr: string; now: Date }>(
        "SELECT id,amount_irr,clock_timestamp() now FROM product_prices WHERE sku=$1 AND ended_at IS NULL FOR SHARE",
        [sku],
      )
    ).rows[0];
    requireCondition(price, "PRODUCT_NOT_AVAILABLE", 403);
    const original = Number(price.amount_irr);
    requireCondition(
      input.promo_price_irr < original,
      "PROMOTION_PRICE_NOT_LOWER",
      422,
    );
    const starts = input.starts_at ? new Date(input.starts_at) : price.now;
    const ends = new Date(input.ends_at);
    // A start in the past would advertise a window that already began: only "now" (omitted) or later.
    requireCondition(
      input.starts_at === undefined ||
        starts.getTime() >= price.now.getTime() - 60000,
      "PROMOTION_START_IN_PAST",
      422,
    );
    requireCondition(ends > starts, "PROMOTION_WINDOW_INVALID", 422);
    requireCondition(
      ends.getTime() > price.now.getTime(),
      "PROMOTION_WINDOW_INVALID",
      422,
    );
    const id = randomUUID();
    try {
      await c.query(
        `INSERT INTO product_promotions(id,sku,base_price_id,original_price_irr,promo_price_irr,starts_at,ends_at,state,reason,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,'ENABLED',$8,$9,$9)`,
        [
          id,
          sku,
          price.id,
          original,
          input.promo_price_irr,
          starts,
          ends,
          input.reason,
          actor.id,
        ],
      );
    } catch (error) {
      this.conflict(error);
    }
    return this.event(c, id, "CREATED", input.reason, actor);
  }

  async update(
    c: PoolClient,
    id: string,
    input: z.infer<typeof promotionUpdate>,
    actor: Actor,
  ) {
    const r = await this.load(c, id);
    requireCondition(
      Number(r.revision) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    requireCondition(r.status !== "EXPIRED", "PROMOTION_EXPIRED", 409);
    // An active promotion keeps its price and start: only its end may move (extend or shorten).
    requireCondition(
      r.status !== "ACTIVE" ||
        (input.promo_price_irr === undefined && input.starts_at === undefined),
      "PROMOTION_ACTIVE_LOCKED",
      409,
    );
    const price = input.promo_price_irr ?? Number(r.promo_price_irr);
    requireCondition(
      price < Number(r.original_price_irr),
      "PROMOTION_PRICE_NOT_LOWER",
      422,
    );
    const now = (await c.query<{ now: Date }>("SELECT clock_timestamp() now"))
      .rows[0].now;
    const starts = input.starts_at ? new Date(input.starts_at) : r.starts_at;
    const ends = input.ends_at ? new Date(input.ends_at) : r.ends_at;
    requireCondition(
      input.starts_at === undefined ||
        starts.getTime() >= now.getTime() - 60000,
      "PROMOTION_START_IN_PAST",
      422,
    );
    requireCondition(
      ends > starts && ends.getTime() > now.getTime(),
      "PROMOTION_WINDOW_INVALID",
      422,
    );
    try {
      await c.query(
        "UPDATE product_promotions SET promo_price_irr=$2,starts_at=$3,ends_at=$4,reason=$5,updated_by=$6,updated_at=now(),revision=revision+1 WHERE id=$1",
        [id, price, starts, ends, input.reason, actor.id],
      );
    } catch (error) {
      this.conflict(error);
    }
    return this.event(c, id, "UPDATED", input.reason, actor);
  }

  async deactivate(
    c: PoolClient,
    id: string,
    input: z.infer<typeof promotionDecision>,
    actor: Actor,
  ) {
    const r = await this.load(c, id);
    requireCondition(
      Number(r.revision) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    requireCondition(r.state === "ENABLED", "PROMOTION_NOT_ENABLED", 409);
    await c.query(
      "UPDATE product_promotions SET state='DISABLED',reason=$2,updated_by=$3,updated_at=now(),revision=revision+1 WHERE id=$1",
      [id, input.reason, actor.id],
    );
    return this.event(c, id, "DEACTIVATED", input.reason, actor);
  }

  async restore(
    c: PoolClient,
    id: string,
    input: z.infer<typeof promotionDecision>,
    actor: Actor,
  ) {
    const r = await this.load(c, id);
    requireCondition(
      Number(r.revision) === input.expected_revision,
      "STALE_REVISION",
      409,
    );
    requireCondition(r.state === "DISABLED", "PROMOTION_NOT_DISABLED", 409);
    const now = (await c.query<{ now: Date }>("SELECT clock_timestamp() now"))
      .rows[0].now;
    requireCondition(r.ends_at > now, "PROMOTION_EXPIRED", 409);
    // The list price must still be the one the promotion was created against.
    const price = (
      await c.query<{ amount_irr: string }>(
        "SELECT amount_irr FROM product_prices WHERE sku=$1 AND ended_at IS NULL FOR SHARE",
        [r.sku],
      )
    ).rows[0];
    requireCondition(
      price && BigInt(price.amount_irr) === BigInt(r.original_price_irr),
      "PROMOTION_BASE_PRICE_CHANGED",
      409,
    );
    try {
      await c.query(
        "UPDATE product_promotions SET state='ENABLED',reason=$2,updated_by=$3,updated_at=now(),revision=revision+1 WHERE id=$1",
        [id, input.reason, actor.id],
      );
    } catch (error) {
      this.conflict(error);
    }
    return this.event(c, id, "RESTORED", input.reason, actor);
  }

  /** The list price of a product may not move under a scheduled or active promotion. */
  async assertBasePriceFree(c: PoolClient, sku: string, newPrice: number) {
    const current = (
      await c.query<{ amount_irr: string }>(
        "SELECT amount_irr FROM product_prices WHERE sku=$1 AND ended_at IS NULL",
        [sku],
      )
    ).rows[0];
    if (current && BigInt(current.amount_irr) === BigInt(newPrice)) return;
    const blocking = await c.query(
      "SELECT 1 FROM product_promotions WHERE sku=$1 AND state='ENABLED' AND ends_at>clock_timestamp() FOR SHARE",
      [sku],
    );
    requireCondition(!blocking.rowCount, "PROMOTION_BASE_PRICE_CONFLICT", 409);
  }
}
