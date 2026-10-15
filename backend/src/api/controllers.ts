import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { Request, Response } from "express";
import { z } from "zod";
import { Database } from "../database/database";
import { Identity } from "../identity/identity";
import { Accounts } from "../accounts/accounts";
import { Security } from "../security/security";
import { Trials } from "../trials/trials";
import { Licenses } from "../licenses/licenses";
import { Activation } from "../activation/activation";
import { Admin } from "../admin/admin";
import { Audit, Actor } from "../audit/audit";
import {
  challengeSchema,
  proofSchema,
  password,
  secret,
  uuid,
  sku,
  startSchema,
  redeemSchema,
  mutationSchema,
} from "../common/schemas";
import { requireCondition } from "../common/errors";

const actor = (req: Request): Actor => ({
  type: "SYSTEM",
  correlationId: req.res!.locals.correlationId,
});
const userActor = (req: Request, id: string): Actor => ({
  ...actor(req),
  type: "CUSTOMER",
  id,
});
@Controller()
export class HealthController {
  constructor(private db: Database) {}
  @Get("health") health() {
    return { status: "alive" };
  }
  @Get("ready") async ready() {
    await this.db.query("SELECT 1");
    const r = await this.db.query<{ count: string }>(
      "SELECT count(*) FROM schema_migrations",
    );
    requireCondition(Number(r.rows[0].count) === 5, "MIGRATIONS_REQUIRED", 503);
    return { status: "ready", production_gate: "closed" };
  }
}
@Controller("api/v2")
export class PublicController {
  constructor(private db: Database) {}
  @Get("products") async products() {
    return (
      await this.db.query<{
        sku: string;
        grade: number;
        price_irr: string;
        revision: string;
      }>(
        `SELECT p.*,price.amount_irr price_irr FROM products p JOIN product_prices price ON price.sku=p.sku AND price.ended_at IS NULL WHERE publication_status<>'hidden' ORDER BY grade`,
      )
    ).rows.map((r) => ({
      ...r,
      price_irr: Number(r.price_irr),
      revision: Number(r.revision),
    }));
  }
  @Get("products/:sku") async product(@Param("sku") id: string) {
    const p = (await this.products()).find((p) => p.sku === sku.parse(id));
    requireCondition(p, "NOT_FOUND", 404);
    return p;
  }
}
@Controller("api/v2")
export class IdentityController {
  constructor(
    private identity: Identity,
    private security: Security,
  ) {}
  private origin(req: Request) {
    requireCondition(
      req.headers.origin === this.security.config.BROWSER_ORIGIN,
      "CSRF_REJECTED",
      403,
    );
  }
  @Post("devices/challenges") challenge(@Body() body: unknown) {
    return this.identity.challenge(challengeSchema.parse(body));
  }
  @Post("device-pairings") pair(@Body() body: unknown, @Req() req: Request) {
    return this.identity.pairing(proofSchema.parse(body), actor(req));
  }
  @Post("device-pairings/:id/confirm") async confirm(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.origin(req);
    const b = z.strictObject({ pairing_secret: secret }).parse(body);
    const customer = (req.cookies as Record<string, string>)?.yz_customer
      ? await this.security.customer(req)
      : undefined;
    return this.identity.browserConfirm(
      uuid.parse(id),
      b.pairing_secret,
      customer?.id,
      customer ? userActor(req, customer.id) : actor(req),
    );
  }
  @Post("device-pairings/:id/desktop-confirm") desktop(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.identity.desktopConfirm(
      uuid.parse(id),
      proofSchema.parse(body),
      actor(req),
    );
  }
  @Post("auth/claim") claim(@Body() body: unknown, @Req() req: Request) {
    this.origin(req);
    const b = z
      .strictObject({
        pairing_id: uuid,
        browser_token: secret,
        claim_grant: secret,
        password: password.optional(),
      })
      .parse(body);
    return this.identity.claim(
      b.pairing_id,
      b.browser_token,
      b.claim_grant,
      b.password,
      actor(req),
    );
  }
  @Post("devices/register") register(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    // Alias completes approved paired enrollment; anonymous registration is never accepted.
    const b = z
      .strictObject({
        pairing_id: uuid,
        browser_token: secret,
        claim_grant: secret,
        password: password.optional(),
      })
      .parse(body);
    return this.identity.claim(
      b.pairing_id,
      b.browser_token,
      b.claim_grant,
      b.password,
      actor(req),
    );
  }
  @Post("devices/authenticate") authenticate(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.identity.authenticate(proofSchema.parse(body), actor(req));
  }
}
@Controller("api/v2")
export class AccountsController {
  constructor(
    private accounts: Accounts,
    private security: Security,
    private db: Database,
    private audit: Audit,
  ) {}
  private cookie(res: Response, name: string, session: string) {
    res.cookie(name, session, {
      httpOnly: true,
      sameSite: "strict",
      secure: this.security.config.NODE_ENV === "production",
      path: "/api/v2",
      maxAge: 8 * 3600000,
    });
    res.setHeader("Cache-Control", "no-store");
  }
  @Post("auth/login") async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireCondition(
      req.headers.origin === this.security.config.BROWSER_ORIGIN,
      "CSRF_REJECTED",
      403,
    );
    const b = z
      .strictObject({
        username: z.string().max(64),
        password: z.string().max(128),
      })
      .parse(body);
    await this.security.rate("customer-login:" + b.username, 8, 300);
    const result = await this.accounts.login(
      b.username,
      b.password,
      actor(req),
    );
    this.cookie(res, "yz_customer", result.session);
    return { csrf_token: result.csrf };
  }
  @Post("auth/session/rotate") async rotate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const c = await this.security.customer(req);
    const result = await this.accounts.rotate(
      c.token_hash,
      c.id,
      userActor(req, c.id),
    );
    this.cookie(res, "yz_customer", result.session);
    return { csrf_token: result.csrf };
  }
  @Post("auth/logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const c = await this.security.customer(req);
    const result = await this.accounts.logout(
      c.token_hash,
      userActor(req, c.id),
    );
    res.clearCookie("yz_customer", { path: "/api/v2" });
    return result;
  }
  @Post("auth/password-reset/complete") reset(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    requireCondition(
      req.headers.origin === this.security.config.BROWSER_ORIGIN,
      "CSRF_REJECTED",
      403,
    );
    const b = z.strictObject({ reset_grant: secret, password }).parse(body);
    return this.accounts.completeReset(b.reset_grant, b.password, actor(req));
  }
  @Get("account") async account(@Req() req: Request) {
    const c = await this.security.customer(req);
    return (
      await this.db.query(
        "SELECT id,username,device_id,generation FROM customers WHERE id=$1",
        [c.id],
      )
    ).rows[0];
  }
  @Get("account/devices") async devices(@Req() req: Request) {
    const c = await this.security.customer(req);
    return (
      await this.db.query(
        "SELECT id,status,created_at FROM device_keys WHERE customer_id=$1",
        [c.id],
      )
    ).rows;
  }
  @Get("account/licenses") async licenses(@Req() req: Request) {
    const c = await this.security.customer(req);
    return (
      await this.db.query(
        "SELECT l.id,l.sku,l.state,l.decision_version FROM licenses l JOIN entitlements e ON e.id=l.entitlement_id WHERE e.customer_id=$1",
        [c.id],
      )
    ).rows;
  }
  @Post("admin/auth/login") async adminLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    requireCondition(
      req.headers.origin === this.security.config.BROWSER_ORIGIN,
      "CSRF_REJECTED",
      403,
    );
    const b = z
      .strictObject({
        username: z.string().max(64),
        password: z.string().max(128),
        mfa_code: z.string().regex(/^[0-9]{6}$/),
      })
      .parse(body);
    await this.security.rate("admin-login:" + b.username, 5, 300);
    const result = await this.accounts.adminLogin(
      b.username,
      b.password,
      b.mfa_code,
      actor(req),
    );
    this.cookie(res, "yz_admin", result.session);
    return { csrf_token: result.csrf };
  }
  @Post("admin/auth/logout") async adminLogout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.db.transaction(async (c) => {
      const a = await this.security.admin(req, undefined, c);
      await c.query(
        "UPDATE admin_sessions SET revoked_at=now() WHERE token_hash=$1",
        [a.token_hash],
      );
      await this.audit.append(
        c,
        { ...actor(req), type: "ADMIN", id: a.id },
        "admin.logout",
        a.id,
      );
    });
    res.clearCookie("yz_admin", { path: "/api/v2" });
    return { revoked: true };
  }
}
@Controller("api/v2/desktop")
export class DesktopController {
  constructor(
    private security: Security,
    private trials: Trials,
    private licenses: Licenses,
    private activation: Activation,
    private db: Database,
  ) {}
  @Get("trials/:sku/status") status(
    @Param("sku") id: string,
    @Req() req: Request,
  ) {
    return this.trials.status(this.security.bearer(req), sku.parse(id));
  }
  @Post("trials/:sku/start") start(
    @Param("sku") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.trials.start(
      this.security.bearer(req),
      sku.parse(id),
      startSchema.parse(body),
      actor(req),
    );
  }
  @Post("licenses/pickup") pickup(@Body() body: unknown, @Req() req: Request) {
    return this.licenses.pickup(
      this.security.bearer(req),
      z.strictObject({ sku }).parse(body).sku,
      actor(req),
    );
  }
  @Post("licenses/sync") sync(@Body() body: unknown, @Req() req: Request) {
    const b = z.strictObject({ license_id: uuid, sku }).parse(body);
    return this.licenses.sync(this.security.bearer(req), b.license_id, b.sku);
  }
  @Post("activation-codes/redeem") redeem(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.activation.redeem(
      this.security.bearer(req),
      redeemSchema.parse(body),
      actor(req),
    );
  }
  @Get("entitlements") entitlements(@Req() req: Request) {
    return this.db.transaction(async (c) => {
      const d = await this.security.device(c, this.security.bearer(req));
      return (
        await c.query(
          "SELECT sku,state FROM entitlements WHERE device_id=$1 AND generation=$2",
          [d.device_id, d.generation],
        )
      ).rows;
    });
  }
}
@Controller("api/v2/admin")
export class AdminController {
  constructor(
    private admin: Admin,
    private db: Database,
    private security: Security,
  ) {}
  @Post("customers/:id/reset") reset(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      "customers.reset",
      b,
      { id: uuid.parse(id) },
      (c, a) => this.admin.reset(c, id, b, a),
    );
  }
  @Post("devices/:id/products/:sku/block") block(
    @Param("id") id: string,
    @Param("sku") product: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.restrict(id, product, body, req, true);
  }
  @Post("devices/:id/products/:sku/unblock") unblock(
    @Param("id") id: string,
    @Param("sku") product: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.restrict(id, product, body, req, false);
  }
  private restrict(
    id: string,
    product: string,
    body: unknown,
    req: Request,
    blocked: boolean,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      blocked ? "device_products.block" : "device_products.unblock",
      b,
      { device_id: uuid.parse(id), sku: sku.parse(product) },
      (c, a) => this.admin.restrict(c, id, product, blocked, b, a),
    );
  }
  @Post("trials/:id/:sku/reset") trial(
    @Param("id") id: string,
    @Param("sku") product: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      "trials.reset",
      b,
      { device_id: uuid.parse(id), sku: sku.parse(product) },
      (c, a) => this.admin.trialReset(c, id, product, b, a),
    );
  }
  @Post("licenses/issue") issue(@Body() body: unknown, @Req() req: Request) {
    const b = mutationSchema.extend({ device_id: uuid, sku }).parse(body);
    return this.admin.operation(
      req,
      "licenses.issue",
      b,
      { device_id: b.device_id, sku: b.sku },
      (c, a) => this.admin.issue(c, b.device_id, b.sku, b, a),
    );
  }
  @Post("licenses/:id/revoke") revoke(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      "licenses.revoke",
      b,
      { id: uuid.parse(id) },
      (c, a) => this.admin.revoke(c, id, b, a),
    );
  }
  @Post("licenses/:id/reissue") recover(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      "licenses.reissue",
      b,
      { id: uuid.parse(id) },
      (c, a) => this.admin.revoke(c, id, b, a, true),
    );
  }
  @Post("activation-codes") code(@Body() body: unknown, @Req() req: Request) {
    const b = mutationSchema
      .extend({ device_id: uuid, sku, expires_at: z.iso.datetime() })
      .parse(body);
    requireCondition(
      Date.parse(b.expires_at) > Date.now() &&
        Date.parse(b.expires_at) < Date.now() + 30 * 86400000,
      "INVALID_EXPIRATION",
    );
    return this.admin.operation(
      req,
      "activation_codes.issue",
      b,
      { device_id: b.device_id, sku: b.sku },
      (c, a) => this.admin.issue(c, b.device_id, b.sku, b, a, b.expires_at),
    );
  }
  @Post("activation-codes/:id/cancel") cancel(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    requireCondition(b.expected_revision === 1, "STALE_REVISION", 409);
    return this.admin.operation(
      req,
      "activation_codes.cancel",
      b,
      { id: uuid.parse(id) },
      (c, a) => this.admin.cancel(c, id, a),
    );
  }
  @Post("customers/:id/password-reset") passwordReset(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema.parse(body);
    return this.admin.operation(
      req,
      "support.password_reset",
      b,
      { id: uuid.parse(id) },
      (c, a) => this.admin.passwordReset(c, id, b, a),
    );
  }
  @Patch("products/:sku") product(
    @Param("sku") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = mutationSchema
      .extend({
        price_irr: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        publication_status: z.enum(["published", "coming_soon", "hidden"]),
        sale_enabled: z.boolean(),
        trial_enabled: z.boolean(),
        activation_enabled: z.boolean(),
      })
      .parse(body);
    return this.admin.operation(
      req,
      "products.manage",
      b,
      { sku: sku.parse(id) },
      (c, a) => this.admin.products(c, id, b, b, a),
    );
  }
  @Get("audit") audit(@Req() req: Request) {
    return this.db.transaction(async (c) => {
      await this.security.admin(req, "audit.read", c);
      const query = z
        .strictObject({
          action: z.string().max(128).optional(),
          entity_id: z.string().max(128).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(req.query);
      return (
        await c.query(
          "SELECT * FROM audit_logs WHERE ($1::text IS NULL OR action=$1) AND ($2::text IS NULL OR entity_id=$2) ORDER BY created_at DESC,id LIMIT $3",
          [query.action ?? null, query.entity_id ?? null, query.limit],
        )
      ).rows;
    });
  }
  @Get("reports") reports(@Req() req: Request) {
    return this.db.transaction(async (c) => {
      await this.security.admin(req, "audit.read", c);
      return {
        customers: (
          await c.query("SELECT count(*) FROM customers WHERE state='ACTIVE'")
        ).rows[0].count,
        trials: (await c.query("SELECT count(*) FROM trial_starts")).rows[0]
          .count,
        outbox_pending: (
          await c.query(
            "SELECT count(*) FROM outbox_events WHERE processed_at IS NULL",
          )
        ).rows[0].count,
      };
    });
  }
}
