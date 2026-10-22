import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { PAYMENT_RETURN_AUTHORITY } from "./gateway";
import { z } from "zod";
import { Orders } from "./orders";
import { Payments } from "./payments";
import { CommerceAdministration } from "./administration";
import { PaymentReadiness } from "./readiness";
import {
  quoteInput,
  orderInput,
  paymentInput,
  simulationInput,
  campaignInput,
  codeInput,
  filters,
} from "./contracts";
import { uuid, mutationSchema } from "../common/schemas";
import { Admin } from "../admin/admin";
import { requireCondition } from "../common/errors";
import { Capabilities } from "../security/capabilities";
import { capabilityIds } from "../config";

@Controller("api/v2")
@Capabilities("CUSTOMER_AUTH", "LIVE_COMMERCE")
export class CommerceController {
  constructor(
    private orders: Orders,
    private payments: Payments,
    private management: CommerceAdministration,
    private admin: Admin,
    private readiness: PaymentReadiness,
  ) {}
  private actor(req: Request, id?: string) {
    return {
      type: id ? ("CUSTOMER" as const) : ("SYSTEM" as const),
      id,
      correlationId: req.res!.locals.correlationId as string,
    };
  }
  @Capabilities("PRODUCTION_CORE")
  @Get("commerce/capabilities")
  capabilities() {
    const enabled = this.orders.security.config.enabledCapabilities;
    return {
      mode: this.orders.security.config.COMMERCE_MODE,
      checkout_enabled:
        enabled.has("LIVE_COMMERCE") &&
        enabled.has("CUSTOMER_AUTH") &&
        ["fake", "zarinpal_sandbox"].includes(
          this.orders.security.config.COMMERCE_MODE,
        ),
      real_payments_enabled: false,
      // True only for the explicit local sandbox mode (the official ZarinPal sandbox, no real money).
      sandbox: this.orders.security.config.COMMERCE_MODE === "zarinpal_sandbox",
      // Present only while the local acceptance test price is configured.
      test_price_irr:
        this.orders.security.config.LOCAL_TEST_PRICE_G1_IRR ?? null,
      currency: "IRR",
      // What this deployment serves, so the web hides entry points the API would refuse.
      enabled_capabilities: capabilityIds.filter((id) => enabled.has(id)),
    };
  }
  @Post("discounts/quote") async quote(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.orders.quote(
      await this.orders.security.customer(req),
      quoteInput.parse(body),
    );
  }
  @Post("orders") async create(@Body() body: unknown, @Req() req: Request) {
    const u = await this.orders.security.customer(req);
    return this.orders.create(u, orderInput.parse(body), this.actor(req, u.id));
  }
  @Get("orders") async list(@Query() query: unknown, @Req() req: Request) {
    return this.orders.list(
      await this.orders.security.customer(req),
      filters.parse(query).offset,
    );
  }
  @Get("account/orders") async accountOrders(
    @Query() query: unknown,
    @Req() req: Request,
  ) {
    return this.list(query, req);
  }
  @Get("orders/:id") async read(@Param("id") id: string, @Req() req: Request) {
    return this.orders.read(
      await this.orders.security.customer(req),
      uuid.parse(id),
    );
  }
  @Post("orders/:id/payments") async initiate(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const u = await this.orders.security.customer(req);
    await this.orders.security.rate("payment-start:" + u.id, 12, 300);
    return this.payments.initiate(
      u,
      uuid.parse(id),
      paymentInput.parse(body).request_id,
      this.actor(req, u.id),
    );
  }
  @Post("orders/:id/simulate") async simulate(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const u = await this.orders.security.customer(req);
    return this.payments.simulate(
      u,
      uuid.parse(id),
      simulationInput.parse(body).outcome,
      this.actor(req, u.id),
    );
  }
  @Capabilities("LIVE_COMMERCE")
  @Get("payments/zarinpal/return")
  async returned(@Query() query: unknown, @Req() req: Request) {
    await this.orders.security.rate(
      "payment-return:" + req.socket.remoteAddress,
      60,
      60,
    );
    const q = z
      .object({
        Authority: z.string().regex(PAYMENT_RETURN_AUTHORITY),
        Status: z.string().max(20).optional(),
      })
      .parse(query);
    return this.payments.returned(q.Authority, q.Status);
  }
  @Post("orders/:id/refund-request") async refund(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const u = await this.orders.security.customer(req),
      b = z
        .strictObject({ reason: z.string().trim().min(10).max(1000) })
        .parse(body);
    return this.orders.db.transaction(async (c) => {
      await this.orders.scope(c, u);
      const o = (
        await c.query(
          "SELECT * FROM orders WHERE id=$1 AND customer_id=$2 FOR UPDATE",
          [uuid.parse(id), u.id],
        )
      ).rows[0];
      requireCondition(o?.paid_at, "NOT_FOUND", 404);
      await c.query(
        "INSERT INTO refund_requests(id,order_id,customer_id,reason,state) VALUES(gen_random_uuid(),$1,$2,$3,'REQUESTED') ON CONFLICT(order_id) DO NOTHING",
        [id, u.id, b.reason],
      );
      await this.orders.audit.append(
        c,
        this.actor(req, u.id),
        "refund.requested",
        id,
      );
      return { requested: true, money_returned: false };
    });
  }
  @Capabilities("ADMIN_AUTH")
  @Get("admin/commerce/:section")
  async adminList(
    @Param("section") section: string,
    @Query() query: unknown,
    @Req() req: Request,
  ) {
    return this.orders.db.transaction(async (c) => {
      await this.orders.security.admin(
        req,
        section === "finance" ? "finance.read" : "commerce.read",
        c,
      );
      return section === "finance"
        ? this.management.finance(c, filters.parse(query))
        : this.management.list(c, section, filters.parse(query));
    });
  }
  // Read-only: no write route exists for readiness, and nothing here can enable payments.
  @Capabilities("ADMIN_AUTH")
  @Get("admin/payment-readiness")
  @Header("Cache-Control", "no-store")
  async paymentReadiness(@Req() req: Request) {
    return this.orders.db.transaction(async (c) => {
      const a = await this.orders.security.admin(req, "finance.read", c);
      await this.orders.audit.append(
        c,
        {
          type: "ADMIN",
          id: a.id,
          correlationId: req.res!.locals.correlationId as string,
        },
        "admin.payment_readiness.viewed",
        a.id,
      );
      return this.readiness.report(c);
    });
  }
  @Capabilities("ADMIN_AUTH")
  @Get("admin/commerce/orders/:id")
  async adminOrder(@Param("id") id: string, @Req() req: Request) {
    return this.orders.db.transaction(async (c) => {
      await this.orders.security.admin(req, "commerce.read", c);
      const order = await this.orders.view(c, uuid.parse(id));
      return {
        ...order,
        reconciliation: (
          await c.query(
            "SELECT r.job_id,r.attempt,r.event,r.error,r.created_at FROM commerce_job_runs r JOIN commerce_jobs j ON j.id=r.job_id WHERE j.order_id=$1 ORDER BY r.created_at,r.id",
            [id],
          )
        ).rows,
        inquiries: (
          await c.query(
            "SELECT q.attempt_id,q.status,q.observed_at FROM payment_inquiries q JOIN payment_attempts p ON p.id=q.attempt_id WHERE p.order_id=$1 ORDER BY q.observed_at,q.id",
            [id],
          )
        ).rows,
        transitions: (
          await c.query(
            "SELECT t.* FROM payment_transitions t JOIN payment_attempts p ON p.id=t.attempt_id WHERE p.order_id=$1 ORDER BY t.created_at,t.id",
            [id],
          )
        ).rows,
      };
    });
  }
  @Capabilities("ADMIN_AUTH")
  @Post("admin/commerce/campaigns")
  campaign(@Body() body: unknown, @Req() req: Request) {
    const b = campaignInput.parse(body);
    return this.admin.operation(
      req,
      "commerce.manage",
      b,
      { id: b.request_id },
      (c) => this.management.campaign(c, b),
    );
  }
  @Capabilities("ADMIN_AUTH")
  @Patch("admin/commerce/campaigns/:id")
  updateCampaign(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = campaignInput.parse(body);
    return this.admin.operation(
      req,
      "commerce.manage",
      b,
      { id: uuid.parse(id) },
      (c) => this.management.campaign(c, b, id),
    );
  }
  @Capabilities("ADMIN_AUTH")
  @Post("admin/commerce/coupons")
  coupon(@Body() body: unknown, @Req() req: Request) {
    const b = codeInput.parse(body);
    return this.admin.operation(
      req,
      "commerce.manage",
      b,
      { id: b.request_id },
      (c) => this.management.code(c, b),
    );
  }
  @Capabilities("ADMIN_AUTH")
  @Patch("admin/commerce/coupons/:id")
  updateCoupon(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = codeInput.parse(body);
    return this.admin.operation(
      req,
      "commerce.manage",
      b,
      { id: uuid.parse(id) },
      (c) => this.management.code(c, b, id),
    );
  }
  @Capabilities("ADMIN_AUTH", "LIVE_COMMERCE")
  @Post("admin/commerce/orders/:id/reconcile")
  reconcile(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      "finance.reconcile",
      b,
      { id: uuid.parse(id) },
      (c) => this.management.reconcile(c, id, b),
    );
  }
  @Capabilities("ADMIN_AUTH", "LIVE_COMMERCE")
  @Post("admin/commerce/refunds/:id/review")
  reviewRefund(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema
      .extend({ state: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]) })
      .parse(body);
    return this.admin.operation(
      req,
      "refunds.review",
      b,
      { id: uuid.parse(id) },
      async (c, a) => {
        const r = await c.query(
          "UPDATE refund_requests SET state=$2,revision=revision+1,review_reason=$3,reviewed_by=$4 WHERE id=$1 AND revision=$5 RETURNING revision",
          [id, b.state, b.reason, a.id, b.expected_revision],
        );
        requireCondition(r.rowCount, "STALE_REVISION", 409);
        return {
          state: b.state,
          revision: Number(r.rows[0].revision),
          money_returned: false,
        };
      },
    );
  }
}
