import { z } from "zod";
import { sku, uuid, mutationSchema } from "../common/schemas";
import { requireCondition } from "../common/errors";

export const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const coupon = z
  .string()
  .trim()
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((v) => v.toUpperCase());
export const quoteInput = z.strictObject({ sku, coupon: coupon.optional() });
export const orderInput = quoteInput.extend({ request_id: uuid });
export const paymentInput = z.strictObject({ request_id: uuid });
export const simulationInput = z.strictObject({
  outcome: z.enum(["SUCCESS", "FAILED", "CANCELLED", "UNKNOWN"]),
});
export const campaignInput = mutationSchema
  .extend({
    name: z.string().trim().min(2).max(120),
    starts_at: z.iso.datetime(),
    ends_at: z.iso.datetime(),
    enabled: z.boolean(),
    max_redemptions: z.number().int().min(1).max(1000000).nullable(),
    max_per_customer: z.number().int().min(1).max(1000).nullable(),
  })
  .refine((v) => v.ends_at > v.starts_at);
export const codeInput = mutationSchema
  .extend({
    campaign_id: uuid,
    code: coupon,
    type: z.enum(["percent", "fixed"]),
    value: money.refine((v) => v > 0),
    max_discount_irr: money.nullable(),
    min_order_irr: money.nullable(),
    enabled: z.boolean(),
    max_redemptions: z.number().int().min(1).max(1000000).nullable(),
    max_per_customer: z.number().int().min(1).max(1000).nullable(),
    skus: z.array(sku).min(1).max(6),
  })
  .refine((v) => v.type !== "percent" || v.value <= 100);
export const filters = z.object({
  search: z.string().max(120).default(""),
  state: z.string().max(32).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  /** Archived orders and devices are hidden unless asked for. */
  archived: z.enum(["active", "archived", "all"]).default("active"),
});
export interface CouponRule {
  type: string;
  value: string;
  max_discount_irr: string | null;
  min_order_irr: string | null;
}
export function discountAmount(amount: number, rule?: CouponRule) {
  money.parse(amount);
  if (!rule) return 0;
  requireCondition(
    BigInt(amount) >= BigInt(rule.min_order_irr ?? 0),
    "COUPON_UNAVAILABLE",
    422,
  );
  let result =
    rule.type === "percent"
      ? (BigInt(amount) * BigInt(rule.value)) / 100n
      : BigInt(rule.value);
  if (rule.max_discount_irr !== null && rule.type === "percent")
    result =
      result < BigInt(rule.max_discount_irr)
        ? result
        : BigInt(rule.max_discount_irr);
  return Number(result < BigInt(amount) ? result : BigInt(amount));
}

export const orderView = z.object({
  id: uuid,
  customer_id: uuid,
  device_id: uuid,
  generation: z.number().int(),
  sku,
  state: z.string(),
  currency: z.literal("IRR"),
  created_at: z.iso.datetime(),
  paid_at: z.iso.datetime().nullable(),
  expires_at: z.iso.datetime(),
  exception_code: z.string().nullable(),
  /** Set when an unpaid invoice ended; the customer may then issue a new one. */
  closed_reason: z
    .enum([
      "customer_cancelled",
      "payment_unsuccessful",
      "invoice_expired",
      "admin_voided",
      "provider_confirmed_failed",
    ])
    .nullable(),
  closed_at: z.iso.datetime().nullable(),
  license_id: uuid.nullable(),
  snapshot: z
    .object({ title_fa: z.string(), username: z.string() })
    .catchall(z.unknown()),
  subtotal_irr: money,
  discount_irr: money,
  promotion_id: uuid.nullable(),
  promotion_discount_irr: money,
  coupon_discount_irr: money,
  total_irr: money,
  revision: z.number().int(),
  mode: z.literal("simulated"),
  payments: z.array(
    z.object({
      id: uuid,
      state: z.string(),
      created_at: z.iso.datetime(),
      verified_at: z.iso.datetime().nullable(),
      provider_ref: z.string().nullable(),
      exception_code: z.string().nullable(),
      redirect_url: z.string().nullable(),
      /** What the browser reported on return (untrusted, display only). */
      customer_return: z.enum(["OK", "NOK"]).nullable(),
      /** Latest provider inquiry answer (reconciliation evidence, never settlement). */
      provider_status: z
        .enum(["VERIFIED", "PAID", "IN_BANK", "FAILED", "REVERSED"])
        .nullable(),
      /** Why a terminal attempt ended, from the transition history. */
      terminal_reason: z.string().nullable(),
    }),
  ),
});
export const quoteView = z.strictObject({
  sku,
  title_fa: z.string(),
  currency: z.literal("IRR"),
  subtotal_irr: money,
  discount_irr: money,
  promotion_discount_irr: money,
  coupon_discount_irr: money,
  total_irr: money,
  test_price: z.boolean(),
  promotion: z
    .strictObject({
      id: uuid,
      price_irr: money,
      discount_percent: z.number().int().min(1).max(99),
      ends_at: z.iso.datetime(),
    })
    .nullable(),
  mode: z.literal("simulated"),
  pricing_revision: z.number().int(),
});
export const commercePage = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  /** Rows matching the filters before paging. */
  total: z.number().int().optional(),
  next_offset: z.number().nullable(),
});
