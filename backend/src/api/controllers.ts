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
import { AuthFlows } from "../accounts/auth-flows";
import { otpProofSchema, mobile } from "../common/schemas";
import { Accounts } from "../accounts/accounts";
import { Security } from "../security/security";
import { Trials } from "../trials/trials";
import { Licenses } from "../licenses/licenses";
import { Activation } from "../activation/activation";
import { Notes, noteTypes } from "../admin/notes";
import { Otp } from "../accounts/otp";
import { Admin } from "../admin/admin";
import { Audit, Actor } from "../audit/audit";
import {
  challengeSchema,
  claimSchema,
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
    requireCondition(Number(r.rows[0].count) === 8, "MIGRATIONS_REQUIRED", 503);
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
  @Post("device-pairings/:id/preview") async preview(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.origin(req);
    await this.security.rate(
      "pairing-preview:" + req.socket.remoteAddress,
      60,
      300,
    );
    return this.identity.preview(
      uuid.parse(id),
      z.strictObject({ pairing_secret: secret }).parse(body).pairing_secret,
    );
  }
  @Post("device-pairings/:id/confirm") confirm(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = z
      .strictObject({
        pairing_secret: secret,
        password: password.optional(),
        otp: otpProofSchema.optional(),
      })
      .parse(body);
    return this.authorizedClaim({ ...b, pairing_id: uuid.parse(id) }, req);
  }
  @Post("device-pairings/:id/cancel") async cancel(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.origin(req);
    const b = z.strictObject({ pairing_secret: secret }).parse(body);
    return this.identity.cancel(uuid.parse(id), b.pairing_secret, actor(req));
  }
  @Post("device-pairings/:id/pickup") async pickup(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    await this.security.rate(
      "pairing-pickup:" + req.socket.remoteAddress,
      120,
      300,
    );
    return this.identity.pickup(
      uuid.parse(id),
      proofSchema.parse(body),
      actor(req),
    );
  }
  @Post("device-pairings/:id/desktop-confirm") retiredDesktop() {
    requireCondition(false, "PROTOCOL_RETIRED", 410);
  }
  @Post("devices/register") retiredRegister() {
    requireCondition(false, "PROTOCOL_RETIRED", 410);
  }
  @Post("auth/claim") claim(@Body() body: unknown, @Req() req: Request) {
    return this.authorizedClaim(body, req);
  }
  private async authorizedClaim(body: unknown, req: Request) {
    this.origin(req);
    const b = claimSchema.parse(body);
    await this.security.rate("claim-ip:" + req.socket.remoteAddress, 120, 300);
    const customer = (req.cookies as Record<string, string>)?.yz_customer
      ? await this.security.customer(req)
      : undefined;
    return this.identity.claim(
      b.pairing_id,
      b.pairing_secret,
      b.password,
      customer,
      customer ? userActor(req, customer.id) : actor(req),
      b.otp,
    );
  }
  @Post("auth/claim/otp/request") async claimOtp(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.origin(req);
    await this.security.rate(
      "sms-request-ip:" + req.socket.remoteAddress,
      20,
      300,
    );
    const b = z
      .strictObject({ pairing_id: uuid, pairing_secret: secret, mobile })
      .parse(body);
    return this.identity.requestClaimOtp(
      b.pairing_id,
      b.pairing_secret,
      b.mobile,
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
    private flows: AuthFlows,
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
      maxAge: name === "yz_admin" ? 3600000 : 8 * 3600000,
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
    await this.security.rate(
      "customer-login-ip:" + req.socket.remoteAddress,
      30,
      300,
    );
    await this.security.rate("customer-login:" + b.username, 8, 300);
    const result = await this.accounts.login(
      b.username,
      b.password,
      actor(req),
    );
    this.cookie(res, "yz_customer", result.session);
    res.cookie(
      "yz_csrf_" + (req.path.includes("/admin/") ? "admin" : "customer"),
      result.csrf,
      {
        httpOnly: false,
        sameSite: "strict",
        secure: this.security.config.NODE_ENV === "production",
        path: "/",
        maxAge: 8 * 3600000,
      },
    );
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
    res.cookie(
      "yz_csrf_" + (req.path.includes("/admin/") ? "admin" : "customer"),
      result.csrf,
      {
        httpOnly: false,
        sameSite: "strict",
        secure: this.security.config.NODE_ENV === "production",
        path: "/",
        maxAge: 8 * 3600000,
      },
    );
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
    res.clearCookie("yz_csrf_customer", { path: "/" });
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
  @Get("account/entitlements") async entitlements(@Req() req: Request) {
    const owner = await this.security.customer(req);
    return (
      await this.db.query(
        "SELECT id,sku,state,created_at FROM entitlements WHERE customer_id=$1 AND generation=$2 ORDER BY sku",
        [owner.id, owner.generation],
      )
    ).rows;
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
  ) {
    requireCondition(
      req.headers.origin === this.security.config.BROWSER_ORIGIN,
      "CSRF_REJECTED",
      403,
    );
    const b = z
      .strictObject({
        username: z.string().min(1).max(64),
        password: z.string().min(1).max(128),
      })
      .parse(body);
    await this.security.rate(
      "admin-primary-ip:" + req.socket.remoteAddress,
      10,
      300,
    );
    await this.security.rate("admin-primary:" + b.username, 5, 300);
    return this.flows.adminPrimary(b.username, b.password, actor(req));
  }
  private origin(req: Request) {
    requireCondition(
      req.headers.origin === this.security.config.BROWSER_ORIGIN,
      "CSRF_REJECTED",
      403,
    );
  }
  private sessionCookies(
    res: Response,
    admin: boolean,
    result: { session: string; csrf: string },
  ) {
    this.cookie(res, admin ? "yz_admin" : "yz_customer", result.session);
    res.cookie(admin ? "yz_csrf_admin" : "yz_csrf_customer", result.csrf, {
      httpOnly: false,
      sameSite: "strict",
      secure: this.security.config.NODE_ENV === "production",
      path: "/",
      maxAge: admin ? 3600000 : 8 * 3600000,
    });
    return { csrf_token: result.csrf };
  }
  @Post("admin/auth/sms/verify") async adminSms(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.origin(req);
    await this.security.rate(
      "otp-verify-ip:" + req.socket.remoteAddress,
      60,
      300,
    );
    const b = otpProofSchema.parse(body);
    return this.sessionCookies(
      res,
      true,
      await this.flows.adminVerify(b.challenge_id, b.code, actor(req)),
    );
  }
  @Post("auth/otp/request") async otpRequest(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.origin(req);
    await this.security.rate(
      "sms-request-ip:" + req.socket.remoteAddress,
      20,
      300,
    );
    const b = z
      .strictObject({
        username: z.string().min(1).max(64),
        mobile,
        purpose: z.enum(["LOGIN", "RESET"]),
      })
      .parse(body);
    return this.flows.requestLogin(b.username, b.mobile, b.purpose, actor(req));
  }
  @Post("auth/otp/verify") async otpLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.origin(req);
    await this.security.rate(
      "otp-verify-ip:" + req.socket.remoteAddress,
      60,
      300,
    );
    const b = otpProofSchema.parse(body);
    const r = await this.flows.verifyLogin(
      b.challenge_id,
      b.code,
      "LOGIN",
      actor(req),
    );
    requireCondition("session" in r && r.session, "OTP_INVALID", 401);
    return this.sessionCookies(
      res,
      false,
      r as { session: string; csrf: string },
    );
  }
  @Post("auth/password-reset/otp") async otpReset(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    this.origin(req);
    await this.security.rate(
      "otp-verify-ip:" + req.socket.remoteAddress,
      30,
      300,
    );
    const b = otpProofSchema.extend({ password }).parse(body);
    return this.flows.verifyLogin(
      b.challenge_id,
      b.code,
      "RESET",
      actor(req),
      b.password,
    );
  }
  @Get("account/security") async securityInfo(@Req() req: Request) {
    return this.flows.details(await this.security.customer(req));
  }
  @Post("account/security/otp") async securityOtp(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    await this.security.customer(req);
    await this.security.rate(
      "sms-request-ip:" + req.socket.remoteAddress,
      20,
      300,
    );
    const b = z
      .strictObject({
        purpose: z.enum(["PASSWORD", "MOBILE_OLD", "MOBILE_NEW"]),
        mobile: mobile.optional(),
        current: otpProofSchema.optional(),
        current_password: password.optional(),
      })
      .parse(body);
    return this.flows.requestSecurity(
      req,
      b.purpose,
      actor(req),
      b.mobile,
      b.current?.challenge_id,
      b.current?.code,
      b.current_password,
    );
  }
  @Post("account/security/password") async securityPassword(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = otpProofSchema.extend({ password }).parse(body);
    return this.flows.changeSecurity(
      req,
      b.challenge_id,
      b.code,
      "PASSWORD",
      actor(req),
      b.password,
    );
  }
  @Post("account/security/mobile") async securityMobile(
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = otpProofSchema
      .extend({ current: otpProofSchema.optional() })
      .parse(body);
    return this.flows.changeSecurity(
      req,
      b.challenge_id,
      b.code,
      "MOBILE_NEW",
      actor(req),
      undefined,
      b.current?.challenge_id,
      b.current?.code,
    );
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
    res.clearCookie("yz_csrf_admin", { path: "/" });
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
    private notes: Notes,
    private otp: Otp,
    private db: Database,
    private security: Security,
  ) {}
  @Get("auth/session") session(@Req() req: Request) {
    return this.db.transaction(async (c) => {
      const a = await this.security.admin(req, undefined, c);
      const permissions = (
        await c.query<{ permission: string }>(
          "SELECT DISTINCT p.permission FROM admin_user_roles u JOIN admin_role_permissions p ON p.role=u.role WHERE u.admin_id=$1 ORDER BY p.permission",
          [a.id],
        )
      ).rows.map((r) => r.permission);
      return { id: a.id, permissions };
    });
  }
  private async list(req: Request, permission: string, sql: string) {
    const q = z
      .strictObject({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).max(100000).default(0),
        search: z.string().max(128).default(""),
      })
      .parse(req.query);
    let phoneLookup: string | null = null;
    if (this.security.config.OTP_HMAC_KEY) {
      try {
        phoneLookup = this.otp.lookup(q.search);
      } catch {
        /* Non-phone queries remain literal text searches. */
      }
    }
    return this.db.transaction(async (c) => {
      await this.security.admin(req, permission, c);
      const rows = (
        await c.query(
          sql.includes("$4")
            ? sql
            : sql.replace(
                " WHERE ",
                " WHERE ($4::text IS NULL OR $4::text IS NOT NULL) AND ",
              ),
          [
            q.limit + 1,
            q.offset,
            "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
            phoneLookup,
          ],
        )
      ).rows;
      return {
        items: rows.slice(0, q.limit),
        next_offset: rows.length > q.limit ? q.offset + q.limit : null,
      };
    });
  }
  @Post("notes/:type/:id") async saveNote(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const b = z
      .strictObject({
        note: z.string().max(2000),
        expected_revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
      })
      .parse(body);
    return this.notes.save(
      req,
      noteTypes.parse(type),
      id,
      b.note,
      b.expected_revision,
    );
  }
  @Get("customers") customers(@Req() req: Request) {
    return this.list(
      req,
      "customers.read",
      `SELECT c.id,c.device_id,c.username,c.generation,c.state,c.claimed_at,CASE WHEN c.mobile_last4 IS NOT NULL THEN '09•••••'||c.mobile_last4 END mobile_masked,COALESCE(n.note,'') note,COALESCE(n.revision,0) note_revision FROM customers c LEFT JOIN entity_notes n ON n.entity_type='customers' AND n.entity_id=c.id::text WHERE c.username ILIKE $3 OR c.id::text ILIKE $3 OR c.device_id::text ILIKE $3 OR n.note ILIKE $3 OR c.mobile_lookup=$4 ORDER BY c.claimed_at DESC,c.id LIMIT $1 OFFSET $2`,
    );
  }
  @Get("devices") devices(@Req() req: Request) {
    return this.list(
      req,
      "devices.read",
      `SELECT d.id,d.username,d.generation,c.id customer_id,c.state customer_state,COALESCE(n.note,'') note,COALESCE(n.revision,0) note_revision,
  (SELECT count(*) FROM device_keys k WHERE k.device_id=d.id AND k.generation=d.generation AND k.status='ACTIVE') profiles,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',k.id,'status',k.status,'created_at',k.created_at)) FROM device_keys k WHERE k.device_id=d.id AND k.generation=d.generation),'[]') profile_details,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('sku',r.sku,'blocked',r.blocked,'revision',r.revision)) FROM device_product_restrictions r WHERE r.device_id=d.id),'[]') restrictions
  FROM devices d LEFT JOIN customers c ON c.device_id=d.id AND c.generation=d.generation AND c.state='ACTIVE' LEFT JOIN entity_notes n ON n.entity_type='devices' AND n.entity_id=d.id::text WHERE d.username ILIKE $3 OR d.id::text ILIKE $3 OR c.id::text ILIKE $3 OR c.mobile_lookup=$4 OR n.note ILIKE $3 OR EXISTS(SELECT 1 FROM device_keys k WHERE k.device_id=d.id AND k.id::text ILIKE $3) ORDER BY d.created_at DESC,d.id LIMIT $1 OFFSET $2`,
    );
  }
  @Get("licenses") licenses(@Req() req: Request) {
    return this.list(
      req,
      "licenses.read",
      `SELECT l.id,l.device_id,e.customer_id,e.generation,l.sku,l.state,l.license_revision,l.decision_version,e.state entitlement_state,d.username,COALESCE(n.note,'') note,COALESCE(n.revision,0) note_revision FROM licenses l JOIN entitlements e ON e.id=l.entitlement_id JOIN devices d ON d.id=l.device_id JOIN customers c ON c.id=e.customer_id LEFT JOIN entity_notes n ON n.entity_type='licenses' AND n.entity_id=l.id::text WHERE d.username ILIKE $3 OR l.id::text ILIKE $3 OR l.device_id::text ILIKE $3 OR l.sku ILIKE $3 OR e.customer_id::text ILIKE $3 OR c.mobile_lookup=$4 OR n.note ILIKE $3 ORDER BY l.issued_at DESC,l.id LIMIT $1 OFFSET $2`,
    );
  }
  @Get("trials") trials(@Req() req: Request) {
    return this.list(
      req,
      "trials.read",
      `SELECT t.device_id,t.sku,t.generation,t.used,t.allocation_epoch,d.username,COALESCE(n.note,'') note,COALESCE(n.revision,0) note_revision FROM trial_counters t JOIN devices d ON d.id=t.device_id LEFT JOIN customers c ON c.device_id=t.device_id AND c.generation=t.generation LEFT JOIN entity_notes n ON n.entity_type='trials' AND n.entity_id=t.device_id::text||'~'||t.sku||'~'||t.generation::text WHERE d.username ILIKE $3 OR t.device_id::text ILIKE $3 OR t.sku ILIKE $3 OR c.mobile_lookup=$4 OR n.note ILIKE $3 ORDER BY t.device_id,t.sku,t.generation LIMIT $1 OFFSET $2`,
    );
  }
  @Get("activation-codes") codes(@Req() req: Request) {
    return this.list(
      req,
      "activation_codes.read",
      `SELECT a.id,a.device_id,a.customer_id,a.generation,a.sku,a.status,a.expires_at,d.username,COALESCE(n.note,'') note,COALESCE(n.revision,0) note_revision FROM activation_codes a JOIN devices d ON d.id=a.device_id JOIN customers c ON c.id=a.customer_id LEFT JOIN entity_notes n ON n.entity_type='activation-codes' AND n.entity_id=a.id::text WHERE d.username ILIKE $3 OR a.id::text ILIKE $3 OR a.device_id::text ILIKE $3 OR a.sku ILIKE $3 OR c.mobile_lookup=$4 OR n.note ILIKE $3 ORDER BY a.created_at DESC,a.id LIMIT $1 OFFSET $2`,
    );
  }
  @Get("products") products(@Req() req: Request) {
    return this.list(
      req,
      "products.manage",
      `SELECT p.*,price.amount_irr::float8 price_irr,COALESCE(n.note,'') note,COALESCE(n.revision,0) note_revision FROM products p JOIN product_prices price ON price.sku=p.sku AND price.ended_at IS NULL LEFT JOIN entity_notes n ON n.entity_type='products' AND n.entity_id=p.sku WHERE ($4::text IS NULL OR $4::text IS NOT NULL) AND (p.sku ILIKE $3 OR p.title_fa ILIKE $3 OR n.note ILIKE $3) ORDER BY p.grade LIMIT $1 OFFSET $2`,
    );
  }
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
