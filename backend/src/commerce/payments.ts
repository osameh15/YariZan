import {
  Injectable,
  BeforeApplicationShutdown,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PoolClient } from "pg";
import { CustomerContext } from "../security/security";
import { Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { hash } from "../security/crypto";
import { Orders, OrderRow } from "./orders";
import { PaymentRequest, PaymentResult } from "./gateway";
import { Licenses } from "../licenses/licenses";

interface Attempt extends PaymentRequest {
  id: string;
  state: string;
  redirect_url: string | null;
  customer_return: string | null;
}
const system = (): Actor => ({ type: "SYSTEM", correlationId: randomUUID() });
/** Spacing between the first FAILED inquiry answer and the one that confirms it (sandbox session: 10 min). */
export const FAILED_CONFIRMATION_SECONDS = 900;
/** A payment started near the end of the invoice window keeps the bank page this long before the invoice ends. */
export const PAYMENT_GRACE_SECONDS = 900;
export type ClosedReason =
  | "customer_cancelled"
  | "payment_unsuccessful"
  | "invoice_expired"
  | "admin_voided"
  | "provider_confirmed_failed";
@Injectable()
export class Payments
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<unknown>;
  constructor(
    readonly orders: Orders,
    private licenses: Licenses,
  ) {}
  onApplicationBootstrap() {
    if (
      !["fake", "zarinpal_sandbox", "zarinpal"].includes(
        this.orders.security.config.COMMERCE_MODE,
      )
    )
      return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.work(4)
          .catch(() => undefined)
          .finally(() => {
            this.active = undefined;
          });
    }, 2000);
    this.timer.unref();
  }
  async beforeApplicationShutdown() {
    clearInterval(this.timer);
    await this.active;
  }
  private async orderLock(c: PoolClient, id: string) {
    const found = (
      await c.query<OrderRow>("SELECT * FROM orders WHERE id=$1", [id])
    ).rows[0];
    requireCondition(found, "NOT_FOUND", 404);
    await c.query("SELECT id FROM devices WHERE id=$1 FOR UPDATE", [
      found.device_id,
    ]);
    return (
      await c.query<OrderRow>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
  }
  private async attempt(id: string): Promise<Attempt> {
    const a = (
      await this.orders.db.query<Attempt>(
        "SELECT *,id attempt_id FROM payment_attempts WHERE id=$1",
        [id],
      )
    ).rows[0];
    requireCondition(a, "NOT_FOUND", 404);
    return { ...a, amount_irr: Number(a.amount_irr) };
  }
  private async transition(
    c: PoolClient,
    id: string,
    next: string,
    reason: string,
    actor: Actor,
  ) {
    const current = (
      await c.query(
        "SELECT state FROM payment_attempts WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (current.state === next) return;
    requireCondition(
      current.state !== "VERIFIED",
      "PAYMENT_STATE_CONFLICT",
      409,
    );
    await c.query(
      "UPDATE payment_attempts SET state=$2,updated_at=now() WHERE id=$1",
      [id, next],
    );
    await c.query(
      "INSERT INTO payment_transitions(id,attempt_id,prior_state,next_state,reason,correlation_id) VALUES($1,$2,$3,$4,$5,$6)",
      [randomUUID(), id, current.state, next, reason, actor.correlationId],
    );
    await this.orders.audit.append(
      c,
      actor,
      "payment." + next.toLowerCase(),
      id,
      { reason },
    );
  }
  async initiate(
    u: CustomerContext,
    id: string,
    requestId: string,
    actor: Actor,
  ) {
    this.orders.gateway.available();
    const admission = await this.orders.db.transaction(async (c) => {
      await this.orders.scope(c, u);
      const order = await this.orderLock(c, id);
      requireCondition(order.customer_id === u.id, "NOT_FOUND", 404);
      const previous = (
        await c.query(
          "SELECT id FROM payment_attempts WHERE order_id=$1 AND request_id=$2",
          [id, requestId],
        )
      ).rows[0];
      if (previous) return { id: previous.id as string, create: false };
      requireCondition(
        order.state === "PENDING" && order.expires_at.getTime() > Date.now(),
        "ORDER_NOT_PAYABLE",
        409,
      );
      await this.orders.eligible(c, u, order.sku);
      requireCondition(
        !(
          await c.query(
            "SELECT 1 FROM payment_attempts WHERE order_id=$1 AND state IN ('CREATED','PENDING','UNKNOWN','VERIFIED')",
            [id],
          )
        ).rowCount,
        "PAYMENT_ALREADY_PENDING",
        409,
      );
      const attempt = randomUUID();
      await c.query(
        "INSERT INTO payment_attempts(id,order_id,amount_irr,provider,state,request_id,provider_config) VALUES($1,$2,$3,'zarinpal','CREATED',$4,$5)",
        [
          attempt,
          id,
          order.total_irr,
          requestId,
          this.orders.gateway.provider.providerConfig,
        ],
      );
      await c.query(
        "INSERT INTO payment_transitions(id,attempt_id,next_state,reason,correlation_id) VALUES($1,$2,'CREATED','admission',$3)",
        [randomUUID(), attempt, actor.correlationId],
      );
      await this.orders.job(
        c,
        "VERIFY",
        attempt,
        id,
        new Date(Date.now() + 15000),
      );
      await this.orders.audit.append(c, actor, "payment.created", attempt, {
        order_id: id,
        mode: "simulated",
      });
      return { id: attempt, create: true };
    });
    if (admission.create) {
      const attempt = await this.attempt(admission.id);
      try {
        const created = await this.orders.gateway.provider.create(attempt);
        requireCondition(
          this.orders.gateway.provider.acceptCreated(created, id),
          "GATEWAY_REDIRECT_REJECTED",
          503,
        );
        await this.orders.db.transaction(async (c) => {
          await this.orderLock(c, id);
          await c.query(
            "UPDATE payment_attempts SET authority=$2,redirect_url=$3 WHERE id=$1 AND authority IS NULL",
            [attempt.id, created.authority, created.redirect_url],
          );
          await this.transition(
            c,
            attempt.id,
            "PENDING",
            "provider_request_created",
            actor,
          );
        });
      } catch {
        // Never create again. Durable query may recover a fake authority by attempt ID;
        // live orphan authorities require merchant reconciliation, not another charge.
        await this.orders.db.transaction(async (c) => {
          await this.orderLock(c, id);
          await this.transition(
            c,
            attempt.id,
            "UNKNOWN",
            "creation_ambiguous",
            actor,
          );
        });
      }
    }
    const a = await this.attempt(admission.id);
    return {
      attempt_id: a.id,
      state: a.state,
      redirect_url: a.redirect_url,
      mode: "simulated",
    };
  }
  /**
   * Ends an unpaid invoice: every open attempt and the order become terminal with one reason, the coupon
   * allocation is released and no verify call is ever made for these attempts again (the bank returns
   * unverified money to the payer). A captured order is never touched. Returns false when nothing changed.
   */
  async close(
    c: PoolClient,
    o: OrderRow,
    state: "FAILED" | "CANCELLED",
    reason: ClosedReason,
    actor: Actor,
  ) {
    if (o.accepted_payment_id || o.state !== "PENDING") return false;
    const open = (
      await c.query<{ id: string }>(
        "SELECT id FROM payment_attempts WHERE order_id=$1 AND state IN ('CREATED','PENDING','UNKNOWN') ORDER BY created_at,id FOR UPDATE",
        [o.id],
      )
    ).rows;
    for (const a of open) await this.transition(c, a.id, state, reason, actor);
    await c.query(
      "UPDATE commerce_jobs SET state='DONE',lease_until=NULL,lease_token=NULL,last_error=NULL WHERE order_id=$1 AND kind IN ('VERIFY','EXPIRE') AND state<>'DONE' AND (lease_until IS NULL OR lease_until<now())",
      [o.id],
    );
    const reservation = await this.reservation(c, o.id);
    if (reservation)
      await c.query(
        "UPDATE discount_reservations SET state='RELEASED' WHERE id=$1 AND state IN ('RESERVED','UNKNOWN')",
        [reservation.id],
      );
    await c.query(
      "UPDATE orders SET state=$2,closed_reason=$3,closed_at=now(),revision=revision+1 WHERE id=$1",
      [o.id, state, reason],
    );
    await this.orders.audit.append(c, actor, "order.closed", o.id, {
      state,
      reason,
    });
    return true;
  }
  /**
   * A new invoice replaces the customer's unpaid one for the same product once that one went to the bank,
   * so leaving the bank page never blocks a new purchase. An invoice the bank reported as paid is kept.
   */
  async supersede(
    u: CustomerContext,
    sku: string,
    requestId: string,
    actor: Actor,
  ) {
    this.orders.gateway.available();
    await this.orders.db.transaction(async (c) => {
      await this.orders.scope(c, u);
      const open = (
        await c.query<{ id: string }>(
          "SELECT o.id FROM orders o WHERE o.device_id=$1 AND o.generation=$2 AND o.sku=$3 AND o.customer_id=$4 AND o.state='PENDING' AND o.accepted_payment_id IS NULL AND o.request_id<>$5 AND EXISTS(SELECT 1 FROM payment_attempts p WHERE p.order_id=o.id) AND NOT EXISTS(SELECT 1 FROM payment_attempts p WHERE p.order_id=o.id AND p.customer_return='OK' AND p.state IN ('CREATED','PENDING','UNKNOWN'))",
          [u.device_id, u.generation, sku, u.id, requestId],
        )
      ).rows;
      for (const row of open)
        await this.close(
          c,
          await this.orderLock(c, row.id),
          "CANCELLED",
          "customer_cancelled",
          actor,
        );
    });
  }
  /** Customer ends their own unpaid invoice so they can issue a new one. */
  async cancel(u: CustomerContext, id: string, actor: Actor) {
    this.orders.gateway.available();
    return this.orders.db.transaction(async (c) => {
      await this.orders.scope(c, u);
      const o = await this.orderLock(c, id);
      requireCondition(o.customer_id === u.id, "NOT_FOUND", 404);
      requireCondition(
        o.state === "PENDING" && !o.accepted_payment_id,
        "ORDER_NOT_CANCELLABLE",
        409,
      );
      // The bank sent the customer back with success: wait for verification instead of dropping a payment.
      requireCondition(
        !(
          await c.query(
            "SELECT 1 FROM payment_attempts WHERE order_id=$1 AND customer_return='OK' AND state IN ('CREATED','PENDING','UNKNOWN')",
            [id],
          )
        ).rowCount,
        "PAYMENT_VERIFICATION_PENDING",
        409,
      );
      await this.close(c, o, "CANCELLED", "customer_cancelled", actor);
      return this.orders.view(c, id, u.id);
    });
  }
  /**
   * Provider inquiry after a documented non-success verify answer. Every observation is kept. A FAILED
   * answer that repeats after FAILED_CONFIRMATION_SECONDS, with no other status in between, ends the
   * attempt as FAILED. Once the customer is back from the bank, a non-success answer ends it at once
   * unless the provider reports that money moved (VERIFIED, PAID or REVERSED).
   */
  private async reconcile(
    a: Attempt,
    verified: PaymentResult,
    returned: boolean,
  ): Promise<PaymentResult> {
    const unsuccessful: PaymentResult = {
      state: "FAILED",
      answered: true,
      terminal_reason: "payment_unsuccessful",
    };
    const provider = this.orders.gateway.provider;
    // Without a documented provider answer nothing ends: only the provider can say the money did not move.
    if (!provider.inquire) return verified;
    const status = await provider.inquire(a);
    if (!status) return verified;
    return this.orders.db.transaction(async (c) => {
      const o = await this.orderLock(c, a.order_id);
      const current = (
        await c.query(
          "SELECT state FROM payment_attempts WHERE id=$1 FOR UPDATE",
          [a.id],
        )
      ).rows[0];
      if (current.state === "VERIFIED") return verified;
      const confirmed =
        status === "FAILED" &&
        Boolean(
          (
            await c.query(
              "SELECT 1 FROM payment_inquiries f WHERE f.attempt_id=$1 AND f.status='FAILED' AND f.observed_at<=now()-($2::integer*interval '1 second') AND NOT EXISTS(SELECT 1 FROM payment_inquiries x WHERE x.attempt_id=$1 AND x.status<>'FAILED' AND x.observed_at>=f.observed_at)",
              [a.id, FAILED_CONFIRMATION_SECONDS],
            )
          ).rowCount,
        );
      const actor = system();
      await c.query(
        "INSERT INTO payment_inquiries(id,attempt_id,status,correlation_id) VALUES($1,$2,$3,$4)",
        [randomUUID(), a.id, status, actor.correlationId],
      );
      await c.query(
        "UPDATE payment_attempts SET provider_status=$2,provider_status_at=now() WHERE id=$1",
        [a.id, status],
      );
      await this.orders.audit.append(c, actor, "payment.inquiry", a.id, {
        status,
      });
      // The provider says the money moved but verify did not accept it: a person must look.
      if (status === "VERIFIED")
        await this.exception(c, o, a.id, "PROVIDER_STATE_CONFLICT");
      if (status === "REVERSED")
        await this.exception(c, o, a.id, "PROVIDER_REVERSED");
      if (confirmed)
        return {
          state: "FAILED",
          answered: true,
          terminal_reason: "provider_confirmed_failed",
        };
      return returned && ["IN_BANK", "FAILED"].includes(status)
        ? unsuccessful
        : verified;
    });
  }
  async returned(authority: string, status?: string) {
    this.orders.gateway.available();
    const a = (
      await this.orders.db.query(
        "SELECT id,order_id FROM payment_attempts WHERE provider='zarinpal' AND authority=$1",
        [authority],
      )
    ).rows[0];
    requireCondition(a, "NOT_FOUND", 404);
    const ended = await this.orders.db.transaction(async (c) => {
      const o = await this.orderLock(c, a.order_id);
      // What the browser reported first is kept and never settles a payment.
      if (status === "OK" || status === "NOK")
        await c.query(
          "UPDATE payment_attempts SET customer_return=$2,customer_return_at=now() WHERE id=$1 AND customer_return IS NULL",
          [a.id, status],
        );
      await this.orders.audit.append(c, system(), "payment.return_hint", a.id);
      const current = (
        await c.query(
          "SELECT state,customer_return FROM payment_attempts WHERE id=$1",
          [a.id],
        )
      ).rows[0];
      // Cancelled or failed at the bank: the invoice ends now and the customer may pay again.
      if (
        current.customer_return === "NOK" &&
        ["CREATED", "PENDING", "UNKNOWN"].includes(current.state)
      )
        return this.close(c, o, "CANCELLED", "customer_cancelled", system());
      await c.query(
        "UPDATE commerce_jobs SET due_at=now(),state=CASE WHEN state='REVIEW' THEN state ELSE 'PENDING' END WHERE kind='VERIFY' AND target_id=$1 AND (lease_until IS NULL OR lease_until<now()) AND state<>'DONE'",
        [a.id],
      );
      return false;
    });
    return {
      order_id: a.order_id as string,
      status: ended ? "CANCELLED" : "VERIFICATION_PENDING",
    };
  }
  async simulate(
    u: CustomerContext,
    id: string,
    outcome: string,
    actor: Actor,
  ) {
    this.orders.gateway.available();
    // The browser simulator only ever drives the in-database fake provider.
    requireCondition(
      this.orders.gateway.simulated,
      "SIMULATION_UNAVAILABLE",
      409,
    );
    return this.orders.db.transaction(async (c) => {
      await this.orders.scope(c, u);
      const o = await this.orderLock(c, id);
      requireCondition(o.customer_id === u.id, "NOT_FOUND", 404);
      const a = (
        await c.query(
          "SELECT id FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      requireCondition(a, "PAYMENT_NOT_STARTED", 409);
      const changed = await c.query(
        "UPDATE fake_gateway_payments SET outcome=$2 WHERE attempt_id=$1 AND outcome IN ('PENDING','UNKNOWN') RETURNING authority",
        [a.id, outcome],
      );
      requireCondition(changed.rowCount, "PAYMENT_STATE_CONFLICT", 409);
      await c.query(
        "UPDATE commerce_jobs SET due_at=now() WHERE kind='VERIFY' AND target_id=$1",
        [a.id],
      );
      await this.orders.audit.append(
        c,
        actor,
        "payment.simulated_return",
        a.id,
        { outcome, mode: "simulated" },
      );
      return { order_id: id, status: "VERIFICATION_PENDING" };
    });
  }
  async exception(
    c: PoolClient,
    o: OrderRow,
    attempt: string | null,
    code: string,
  ) {
    const inserted = await c.query(
      "INSERT INTO commerce_exceptions(id,order_id,attempt_id,code) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
      [randomUUID(), o.id, attempt, code],
    );
    await c.query(
      "UPDATE orders SET exception_code=$2,revision=revision+1 WHERE id=$1 AND exception_code IS DISTINCT FROM $2",
      [o.id, code],
    );
    if (attempt)
      await c.query(
        "UPDATE payment_attempts SET exception_code=$2 WHERE id=$1",
        [attempt, code],
      );
    if (inserted.rowCount)
      await this.orders.audit.append(c, system(), "commerce.exception", o.id, {
        code,
      });
  }
  private async reservation(c: PoolClient, order: string) {
    const r = (
      await c.query(
        "SELECT r.*,d.campaign_id FROM discount_reservations r JOIN discount_codes d ON d.id=r.code_id WHERE r.order_id=$1",
        [order],
      )
    ).rows[0];
    if (!r) return;
    await c.query("SELECT id FROM discount_campaigns WHERE id=$1 FOR UPDATE", [
      r.campaign_id,
    ]);
    await c.query("SELECT id FROM discount_codes WHERE id=$1 FOR UPDATE", [
      r.code_id,
    ]);
    return (
      await c.query(
        "SELECT * FROM discount_reservations WHERE id=$1 FOR UPDATE",
        [r.id],
      )
    ).rows[0];
  }
  async settle(id: string, result: PaymentResult) {
    const snapshot = await this.attempt(id);
    await this.orders.db.transaction(async (c) => {
      const o = await this.orderLock(c, snapshot.order_id);
      const a = (
        await c.query<Attempt>(
          "SELECT *,id attempt_id FROM payment_attempts WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (a.state === "VERIFIED") return;
      const actor = system(),
        reservation = await this.reservation(c, o.id);
      if (result.authority && !a.authority) {
        await c.query(
          "UPDATE payment_attempts SET authority=$2,redirect_url=$3 WHERE id=$1",
          [
            id,
            result.authority,
            result.authority === "FAKE-" + id
              ? "/payment/simulate?order=" + o.id
              : null,
          ],
        );
        a.authority = result.authority;
      }
      const verified = result.state === "VERIFIED";
      if (
        verified &&
        (result.authority !== a.authority ||
          result.amount_irr !== Number(a.amount_irr) ||
          result.currency !== a.currency ||
          result.provider_config !== a.provider_config ||
          !result.reference)
      ) {
        await this.transition(c, id, "UNKNOWN", "verification_mismatch", actor);
        await this.exception(c, o, id, "VERIFICATION_MISMATCH");
        return;
      }
      if (verified) {
        const duplicate = (
          await c.query(
            "SELECT id FROM payment_attempts WHERE provider='zarinpal' AND provider_ref=$1 AND id<>$2",
            [result.reference, id],
          )
        ).rows[0];
        // Serialize global reference allocation before testing the unique business key.
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          "payment-ref:" + result.reference,
        ]);
        const reused =
          duplicate ||
          (
            await c.query(
              "SELECT id FROM payment_attempts WHERE provider='zarinpal' AND provider_ref=$1 AND id<>$2",
              [result.reference, id],
            )
          ).rows[0];
        await c.query(
          "UPDATE payment_attempts SET provider_ref=$2,reported_ref=$3,verified_at=now() WHERE id=$1",
          [id, reused ? null : result.reference, result.reference],
        );
        await this.transition(c, id, "VERIFIED", "provider_verified", actor);
        await c.query(
          "INSERT INTO payment_events(id,payment_attempt_id,provider,external_event_id,payload_digest) VALUES($1,$2,'zarinpal',$3,$4) ON CONFLICT DO NOTHING",
          [randomUUID(), id, "verified:" + id, hash(JSON.stringify(result))],
        );
        if (reused) {
          await this.exception(c, o, id, "REFERENCE_REUSED");
          await c.query(
            "UPDATE orders SET paid_at=COALESCE(paid_at,now()),state=CASE WHEN state='FULFILLED' THEN state ELSE 'FULFILLMENT_PENDING' END,closed_reason=NULL,closed_at=NULL,archived_at=NULL WHERE id=$1",
            [o.id],
          );
          return;
        }
        if (o.accepted_payment_id && o.accepted_payment_id !== id) {
          await this.exception(c, o, id, "DUPLICATE_CAPTURE");
          return;
        }
        await c.query(
          "UPDATE orders SET accepted_payment_id=$2,paid_at=now(),state='FULFILLMENT_PENDING',closed_reason=NULL,closed_at=NULL,archived_at=NULL,revision=revision+1 WHERE id=$1",
          [o.id, id],
        );
        if (reservation?.state === "RELEASED") {
          await this.exception(c, o, id, "LATE_RELEASED_COUPON");
          return;
        }
        if (reservation) {
          await c.query(
            "INSERT INTO discount_redemptions(id,code_id,order_id,customer_id) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING",
            [randomUUID(), reservation.code_id, o.id, o.customer_id],
          );
          await c.query(
            "UPDATE discount_reservations SET state='REDEEMED' WHERE id=$1",
            [reservation.id],
          );
        }
        await this.orders.job(c, "FULFILL", o.id, o.id);
        await this.orders.audit.append(c, actor, "order.paid", o.id, {
          amount_irr: Number(o.total_irr),
        });
      } else if (["FAILED", "CANCELLED"].includes(result.state)) {
        await this.transition(
          c,
          id,
          result.state,
          result.terminal_reason ?? "provider_terminal",
          actor,
        );
        await this.close(
          c,
          o,
          result.state as "FAILED" | "CANCELLED",
          result.terminal_reason === "provider_confirmed_failed"
            ? "provider_confirmed_failed"
            : result.state === "CANCELLED"
              ? "customer_cancelled"
              : "payment_unsuccessful",
          actor,
        );
      } else {
        await this.transition(c, id, "UNKNOWN", "provider_ambiguous", actor);
        if (reservation)
          await c.query(
            "UPDATE discount_reservations SET state='UNKNOWN' WHERE id=$1 AND state='RESERVED'",
            [reservation.id],
          );
      }
    });
  }
  async fulfill(id: string) {
    return this.orders.db.transaction(async (c) => {
      const o = await this.orderLock(c, id);
      if (o.state === "FULFILLED") return;
      requireCondition(o.accepted_payment_id, "PAYMENT_UNVERIFIED", 409);
      if (o.exception_code) return;
      const d = (
        await c.query(
          "SELECT d.id device_id,d.generation,d.fingerprint_digest,c.id customer_id FROM devices d JOIN customers c ON c.device_id=d.id AND c.generation=d.generation AND c.state='ACTIVE' WHERE d.id=$1 AND c.id=$2",
          [o.device_id, o.customer_id],
        )
      ).rows[0];
      if (!d || d.generation !== o.generation) {
        await this.exception(
          c,
          o,
          o.accepted_payment_id,
          "ACCOUNT_GENERATION_CHANGED",
        );
        return;
      }
      const blocked = (
        await c.query(
          "SELECT blocked FROM device_product_restrictions WHERE device_id=$1 AND sku=$2 FOR UPDATE",
          [o.device_id, o.sku],
        )
      ).rows[0];
      if (blocked?.blocked) {
        await this.exception(c, o, o.accepted_payment_id, "PRODUCT_BLOCKED");
        return;
      }
      const item = (
        await c.query("SELECT id FROM order_items WHERE order_id=$1", [id])
      ).rows[0];
      let entitlement = (
        await c.query(
          "SELECT * FROM entitlements WHERE device_id=$1 AND generation=$2 AND sku=$3 FOR UPDATE",
          [d.device_id, d.generation, o.sku],
        )
      ).rows[0];
      if (entitlement && entitlement.source_order_item_id !== item.id) {
        await this.exception(c, o, o.accepted_payment_id, "OWNERSHIP_CONFLICT");
        return;
      }
      if (!entitlement) {
        entitlement = { id: randomUUID() };
        await c.query(
          "INSERT INTO entitlements(id,customer_id,device_id,generation,sku,source_type,source_order_item_id) VALUES($1,$2,$3,$4,$5,'PURCHASE',$6)",
          [
            entitlement.id,
            d.customer_id,
            d.device_id,
            d.generation,
            o.sku,
            item.id,
          ],
        );
      }
      const license = await this.licenses.ensureLicense(
        c,
        { ...d, key_id: "" },
        o.sku,
        entitlement.id,
        system(),
      );
      await c.query(
        "INSERT INTO order_fulfillments(order_item_id,entitlement_id,license_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [item.id, entitlement.id, license.payload.license_id],
      );
      await c.query(
        "UPDATE orders SET state='FULFILLED',revision=revision+1 WHERE id=$1",
        [id],
      );
      await this.orders.job(c, "PURCHASE_NOTICE", id, id);
      await this.orders.audit.append(c, system(), "order.fulfilled", id, {
        sku: o.sku,
      });
    });
  }
  /**
   * One verify call for an open attempt, with the code-101 evidence rule and the inquiry follow-up,
   * then settlement. Returns whether the provider gave a documented answer.
   */
  private async verifyAttempt(a: Attempt) {
    let result: PaymentResult;
    // Evidence for provider code 101 (already verified): an earlier verify call for this
    // attempt that never received an answer. Written before the call, so a lost response
    // leaves proof that our own call may have captured the payment.
    const had = async (kind: string) =>
      Boolean(
        (
          await this.orders.db.query(
            "SELECT 1 FROM payment_events WHERE provider='zarinpal' AND external_event_id=$1",
            [kind + ":" + a.id],
          )
        ).rowCount,
      );
    const mark = (kind: string) =>
      this.orders.db.query(
        "INSERT INTO payment_events(id,payment_attempt_id,provider,external_event_id,payload_digest) VALUES($1,$2,'zarinpal',$3,$4) ON CONFLICT DO NOTHING",
        [randomUUID(), a.id, kind + ":" + a.id, hash(kind)],
      );
    const priorUnanswered =
      (await had("verify_requested")) && !(await had("verify_answered"));
    await mark("verify_requested");
    try {
      result = await this.orders.gateway.provider.query(a);
    } catch {
      result = { state: "UNKNOWN" };
    }
    const answered = Boolean(result.answered);
    if (answered) await mark("verify_answered");
    if (result.previously_verified && !priorUnanswered) {
      // Never treat an unexplained 101 as a new capture; leave it for reconciliation.
      await this.orders.db.transaction(async (c) => {
        const o = await this.orderLock(c, a.order_id);
        await this.exception(c, o, a.id, "ALREADY_VERIFIED_UNPROVEN");
      });
      result = { state: "UNKNOWN" };
    }
    // A documented non-success verify answer (for example -51) while the customer is still at
    // the bank is not a result: an unpaid authority answers the same way. Ask the provider.
    if (result.state === "UNKNOWN" && result.answered)
      result = await this.reconcile(a, result, a.customer_return === "OK");
    await this.settle(a.id, result);
    return answered;
  }
  /**
   * Ends an unpaid invoice whose window has passed. A payment started near the end keeps the bank page
   * for PAYMENT_GRACE_SECONDS. Before ending, every open attempt gets one last verify call, so a customer
   * who paid but never came back still receives the product. An attempt the bank reported as successful
   * (customer return OK) is left to verification and the Admin.
   */
  private async expire(id: string): Promise<{ done: boolean; later?: Date }> {
    const early = await this.orders.db.transaction(async (c) => {
      const o = await this.orderLock(c, id);
      if (o.state !== "PENDING" || o.accepted_payment_id) return { done: true };
      const latest = (
        await c.query<{ until: Date | null }>(
          "SELECT max(created_at)+($2::integer*interval '1 second') until FROM payment_attempts WHERE order_id=$1 AND state IN ('CREATED','PENDING','UNKNOWN')",
          [id, PAYMENT_GRACE_SECONDS],
        )
      ).rows[0].until;
      const until = latest && latest > o.expires_at ? latest : o.expires_at;
      if (until.getTime() > Date.now()) return { done: false, later: until };
      if (
        (
          await c.query(
            "SELECT 1 FROM payment_attempts WHERE order_id=$1 AND customer_return='OK' AND state IN ('CREATED','PENDING','UNKNOWN')",
            [id],
          )
        ).rowCount
      )
        return { done: true };
      return undefined;
    });
    if (early) return early;
    const open = (
      await this.orders.db.query<{ id: string }>(
        "SELECT id FROM payment_attempts WHERE order_id=$1 AND state IN ('CREATED','PENDING','UNKNOWN') AND authority IS NOT NULL ORDER BY created_at,id",
        [id],
      )
    ).rows;
    let unanswered = false;
    for (const row of open) {
      const a = await this.attempt(row.id);
      if (["CREATED", "PENDING", "UNKNOWN"].includes(a.state))
        unanswered = !(await this.verifyAttempt(a)) || unanswered;
    }
    return this.orders.db.transaction(async (c) => {
      const o = await this.orderLock(c, id);
      if (o.state !== "PENDING" || o.accepted_payment_id) return { done: true };
      // No documented answer (provider outage): try again later rather than drop a payment.
      if (unanswered) return { done: false };
      await this.close(c, o, "CANCELLED", "invoice_expired", system());
      return { done: true };
    });
  }
  async work(limit = 10) {
    this.orders.gateway.available();
    requireCondition(
      Number.isInteger(limit) && limit > 0 && limit <= 50,
      "INVALID_REQUEST",
    );
    const jobs = await this.orders.db.transaction(async (c) => {
      const rows = (
        await c.query(
          "SELECT * FROM commerce_jobs WHERE state IN ('PENDING','RUNNING') AND due_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY due_at,id LIMIT $1 FOR UPDATE SKIP LOCKED",
          [limit],
        )
      ).rows;
      for (const row of rows) {
        row.lease_token = randomUUID();
        await c.query(
          "UPDATE commerce_jobs SET state='RUNNING',attempts=attempts+1,lease_until=now()+interval '60 seconds',lease_token=$2 WHERE id=$1",
          [row.id, row.lease_token],
        );
        row.attempts++;
        await c.query(
          "INSERT INTO commerce_job_runs(id,job_id,attempt,event) VALUES($1,$2,$3,'STARTED')",
          [randomUUID(), row.id, row.attempts],
        );
      }
      return rows;
    });
    for (const job of jobs) {
      let done = false,
        error = "PENDING",
        later: Date | undefined;
      try {
        if (job.kind === "VERIFY") {
          const a = await this.attempt(job.target_id);
          // An ended attempt is never verified again (see close).
          if (["CREATED", "PENDING", "UNKNOWN"].includes(a.state))
            await this.verifyAttempt(a);
          done = ["VERIFIED", "FAILED", "CANCELLED"].includes(
            (await this.attempt(a.id)).state,
          );
        } else if (job.kind === "FULFILL") {
          await this.fulfill(job.target_id);
          const o = (
            await this.orders.db.query<OrderRow>(
              "SELECT * FROM orders WHERE id=$1",
              [job.order_id],
            )
          ).rows[0];
          done = o.state === "FULFILLED";
          error = o.exception_code ?? "SIGNING_PENDING";
        } else if (job.kind === "EXPIRE") {
          const r = await this.expire(job.order_id);
          done = r.done;
          later = r.later;
          error = "EXPIRY_CHECK_UNANSWERED";
        } else {
          await this.orders.db.transaction(async (c) => {
            const o = await this.orderLock(c, job.order_id);
            requireCondition(
              o.state === "FULFILLED",
              "FULFILLMENT_PENDING",
              409,
            );
            const recorded = await c.query(
              "INSERT INTO purchase_notifications(order_id,template_key,state) VALUES($1,$2,'RECORDED') ON CONFLICT DO NOTHING RETURNING order_id",
              [o.id, this.orders.security.config.PURCHASE_SMS_TEMPLATE],
            );
            if (recorded.rowCount)
              await this.orders.audit.append(
                c,
                system(),
                "purchase.notification_recorded",
                o.id,
                { delivery: "disabled", mode: "simulated" },
              );
          });
          done = true;
        }
      } catch {
        error = "RECOVERY_REQUIRED";
      }
      await this.orders.db.transaction(async (c) => {
        // A rescheduled expiry is waiting for the invoice or bank-page window, not failing.
        const review = !done && !later && job.attempts >= 8;
        const reviewOrder = review
          ? await this.orderLock(c, job.order_id)
          : undefined;
        const completed = await c.query(
          "UPDATE commerce_jobs SET state=$2,lease_until=NULL,lease_token=NULL,due_at=COALESCE($6,now()+($3::integer*interval '1 second')),last_error=$4 WHERE id=$1 AND lease_token=$5",
          [
            job.id,
            done ? "DONE" : review ? "REVIEW" : "PENDING",
            Math.min(3600, 5 * 2 ** Math.min(job.attempts, 10)),
            done || later ? null : error,
            job.lease_token,
            later ?? null,
          ],
        );
        if (completed.rowCount)
          await c.query(
            "INSERT INTO commerce_job_runs(id,job_id,attempt,event,error) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
            [
              randomUUID(),
              job.id,
              job.attempts,
              done ? "DONE" : review ? "REVIEW" : "RETRY",
              done ? null : error,
            ],
          );
        if (reviewOrder && completed.rowCount) {
          const o = reviewOrder;
          await this.exception(
            c,
            o,
            job.kind === "VERIFY" ? job.target_id : o.accepted_payment_id,
            "RECONCILIATION_REVIEW",
          );
        }
      });
    }
    return { processed: jobs.length };
  }
}
