import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { productionGates } from "../config";
import { Orders } from "./orders";

/**
 * Read-only Payment Readiness report (docs/YARIZAN-PAYMENT-READINESS-DASHBOARD-DESIGN.md).
 * It reports; it never enables anything. Static evidence below changes only through a reviewed code
 * change that cites docs/YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md. Live values are derived from the
 * validated configuration (presence only, never a value) and from the database.
 */
export type ReadinessStatus =
  "verified" | "owner_confirmed" | "partial" | "blocked" | "not_started";
export const PAYMENT_READINESS_EVIDENCE: readonly {
  id: string;
  status: ReadinessStatus;
  evidence: string;
  reference: string;
}[] = [
  {
    id: "merchant_activation",
    status: "blocked",
    evidence:
      "Merchant account provisioned; activation not granted by ZarinPal",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#8",
  },
  {
    id: "custom_payment_domain",
    status: "owner_confirmed",
    evidence:
      "pay.yarizan.oarnova.games CNAME zpc.zarinpal.com and TLS verified; dashboard confirmation reported by the owner",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#8",
  },
  {
    id: "callback_domain",
    status: "owner_confirmed",
    evidence:
      "Callback https://yarizan.oarnova.games/payment/return; registered domain confirmed by the owner in the panel",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#8",
  },
  {
    id: "outbound_ip_allowlist",
    status: "partial",
    evidence:
      "VPS egress 82.115.18.101 registered by the owner; the Backend payment egress path is not built and must be re-checked",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#8",
  },
  {
    id: "sandbox_acceptance",
    status: "verified",
    evidence:
      "Official sandbox: paid order settled once; cancel, inquiry and error codes recorded (2026-10-21/22)",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#9",
  },
  {
    id: "payment_reconciliation_tests",
    status: "verified",
    evidence:
      "Settlement, code 101, outage, duplicate callback and reconciliation integration tests in Backend CI",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#10",
  },
  {
    id: "refund_readiness",
    status: "not_started",
    evidence:
      "Refund requests are recorded and reviewed only; no refund or reverse call exists and no money is returned",
    reference: "YARIZAN-ZARINPAL-CONTRACT-AND-READINESS.md#4",
  },
  {
    id: "legal_merchant_documentation",
    status: "partial",
    evidence:
      "Legal pages exist with owner-pending passages; eNamad record present; final texts need owner approval",
    reference: "YARIZAN-FULL-APPLICATION-PRODUCTION-GATES.md",
  },
];

@Injectable()
export class PaymentReadiness {
  constructor(private orders: Orders) {}
  async report(c: PoolClient) {
    const config = this.orders.security.config;
    const one = async (sql: string) => (await c.query(sql)).rows[0];
    const sandbox = await one(
      "SELECT count(*) FILTER(WHERE state='VERIFIED')::int verified,count(*) FILTER(WHERE state IN ('CREATED','PENDING','UNKNOWN'))::int unresolved,max(verified_at) last_verified_at FROM payment_attempts WHERE provider_config='zarinpal-sandbox-v1'",
    );
    const health = await one(
      `SELECT
        (SELECT count(*) FROM payment_attempts WHERE state='UNKNOWN')::int unknown_payments,
        (SELECT count(*) FROM orders WHERE exception_code IS NOT NULL)::int open_exceptions,
        (SELECT count(*) FROM commerce_jobs WHERE state='REVIEW')::int jobs_in_review,
        (SELECT count(*) FROM commerce_jobs WHERE state IN ('PENDING','RUNNING') AND due_at<now()-interval '5 minutes')::int overdue_jobs,
        (SELECT count(*) FROM orders WHERE paid_at IS NOT NULL AND state<>'FULFILLED')::int paid_unfulfilled,
        (SELECT floor(extract(epoch FROM now()-min(created_at)))::int FROM payment_attempts WHERE state IN ('CREATED','PENDING','UNKNOWN')) oldest_unresolved_seconds`,
    );
    const catalog = (
      await c.query(
        "SELECT p.sku,p.publication_status,p.sale_enabled,r.amount_irr::text price_irr FROM products p LEFT JOIN product_prices r ON r.sku=p.sku AND r.ended_at IS NULL ORDER BY p.grade",
      )
    ).rows;
    return {
      real_payments_possible: false as const,
      generated_at: new Date().toISOString(),
      // The live gateway refuses to start in source (ZARINPAL_LIVE_GATE_CLOSED); no setting opens it.
      production_payment_gate: { id: "ZARINPAL_LIVE_GATE_CLOSED", open: false },
      gates: productionGates.map((g) => ({
        id: g.id,
        reason: g.reason,
        open: g.open,
      })),
      runtime: {
        node_env: config.NODE_ENV,
        commerce_mode: config.COMMERCE_MODE,
        sandbox: config.COMMERCE_MODE === "zarinpal_sandbox",
      },
      merchant_configuration: {
        // Presence only. The value is never read into a response.
        merchant_id_present: Boolean(config.ZARINPAL_MERCHANT_ID),
        callback_url_present: Boolean(config.ZARINPAL_CALLBACK_URL),
        live_merchant_usable: false as const,
      },
      sandbox_evidence: {
        verified_payments: sandbox.verified,
        unresolved_payments: sandbox.unresolved,
        last_verified_at: sandbox.last_verified_at
          ? new Date(sandbox.last_verified_at).toISOString()
          : null,
      },
      health,
      catalog,
      evidence: PAYMENT_READINESS_EVIDENCE,
    };
  }
}
