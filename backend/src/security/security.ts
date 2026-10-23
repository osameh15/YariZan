import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PoolClient } from "pg";
import { configuration } from "../config";
import { Database } from "../database/database";
import { requireCondition } from "../common/errors";
import { equal, keyed } from "./crypto";

export interface DeviceContext {
  device_id: string;
  key_id: string;
  customer_id: string;
  generation: number;
  fingerprint_digest: string;
  historical?: boolean;
}
export interface CustomerContext {
  id: string;
  device_id: string;
  generation: number;
  token_hash: string;
}
export interface AdminContext {
  id: string;
  token_hash: string;
}
@Injectable()
export class Security {
  readonly config = configuration();
  constructor(readonly db: Database) {}
  tokenHash(value: string) {
    return keyed(this.config.TOKEN_HMAC_KEY, "YariZan-Session-V2", value);
  }
  async authenticatedRate(authorization: string, instant = Date.now()) {
    if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization)) return;
    const r = await this.db.query<{ device_id: string; customer_id: string }>(
      `SELECT c.device_id,c.customer_id FROM device_credentials c WHERE c.token_hash=$1`,
      [this.tokenHash(authorization.slice(7))],
    );
    if (r.rows[0]) {
      await this.rate("machine:" + r.rows[0].device_id, 120, 60, instant);
      await this.rate("customer:" + r.rows[0].customer_id, 120, 60, instant);
    }
  }
  // Each bucket is stored as the epoch second its window ends, so expired rows can be purged.
  private window(seconds: number, instant: number) {
    return (Math.floor(instant / 1000 / seconds) + 1) * seconds;
  }
  private safeKey(key: string) {
    return keyed(this.config.TOKEN_HMAC_KEY, "YariZan-Rate-V2", key);
  }
  private async increment(key: string, bucket: number) {
    const r = await this.db.query<{ count: number }>(
      `INSERT INTO rate_buckets VALUES($1,$2,1)
      ON CONFLICT(key,bucket) DO UPDATE SET count=rate_buckets.count+1 RETURNING count`,
      [this.safeKey(key), bucket],
    );
    return r.rows[0].count;
  }
  async rate(key: string, limit: number, seconds = 60, instant = Date.now()) {
    const count = await this.increment(key, this.window(seconds, instant));
    requireCondition(count <= limit, "RATE_LIMITED", 429);
  }
  /** Current count of a window without consuming it. */
  async peek(key: string, seconds: number, instant = Date.now()) {
    const r = await this.db.query<{ count: number }>(
      "SELECT count FROM rate_buckets WHERE key=$1 AND bucket=$2",
      [this.safeKey(key), this.window(seconds, instant)],
    );
    return r.rows[0]?.count ?? 0;
  }
  async bump(key: string, seconds: number, instant = Date.now()) {
    return this.increment(key, this.window(seconds, instant));
  }
  /** True only for the first use of a key before its expiry (atomic). */
  async once(key: string, expiresAtEpochSeconds: number) {
    return (await this.increment(key, expiresAtEpochSeconds)) === 1;
  }
  bearer(req: Request) {
    const h = req.headers.authorization;
    requireCondition(
      h && /^Bearer [A-Za-z0-9_-]{43}$/.test(h),
      "ENROLLMENT_REQUIRED",
      401,
    );
    return h.slice(7);
  }
  async device(
    c: PoolClient,
    bearer: string,
    allowHistorical = false,
  ): Promise<DeviceContext> {
    const r = await c.query<
      DeviceContext & {
        status: string;
        state: string;
        current_generation: number;
        revoked_at: Date | null;
        expires_at: Date;
        key_generation: number;
      }
    >(
      `SELECT t.device_id,k.id key_id,t.customer_id,t.generation,d.fingerprint_digest,
      k.status,k.generation key_generation,c.state,d.generation current_generation,t.revoked_at,t.expires_at
      FROM device_credentials t JOIN device_keys k ON k.id=t.key_id JOIN devices d ON d.id=t.device_id
      JOIN customers c ON c.id=t.customer_id WHERE t.token_hash=$1 FOR UPDATE OF d`,
      [this.tokenHash(bearer)],
    );
    const row = r.rows[0];
    requireCondition(
      row && row.expires_at.getTime() > Date.now(),
      "ENROLLMENT_REQUIRED",
      401,
    );
    // Old reset keys can read only their own signed tombstones until their credential expires.
    row.historical =
      !!row.revoked_at ||
      row.status !== "ACTIVE" ||
      row.state !== "ACTIVE" ||
      row.generation !== row.current_generation ||
      row.generation !== row.key_generation;
    if (!allowHistorical)
      requireCondition(!row.historical, "ACCOUNT_RESTRICTED", 403);
    else
      requireCondition(row.status !== "REPLACED", "ENROLLMENT_REQUIRED", 401);
    return row;
  }
  async customer(req: Request, c?: PoolClient): Promise<CustomerContext> {
    const raw = (req.cookies as Record<string, string> | undefined)
      ?.yz_customer;
    requireCondition(
      raw && /^[A-Za-z0-9_-]{43}$/.test(raw),
      "UNAUTHENTICATED",
      401,
    );
    const sql = `SELECT c.id,c.device_id,c.generation,s.token_hash,s.csrf_hash FROM customer_sessions s
      JOIN customers c ON c.id=s.customer_id JOIN devices d ON d.id=c.device_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND c.state='ACTIVE' AND c.generation=d.generation`;
    const r = c
      ? await c.query<CustomerContext & { csrf_hash: string }>(sql, [
          this.tokenHash(raw),
        ])
      : await this.db.query<CustomerContext & { csrf_hash: string }>(sql, [
          this.tokenHash(raw),
        ]);
    requireCondition(r.rows[0], "UNAUTHENTICATED", 401);
    if (!["GET", "HEAD"].includes(req.method))
      this.csrf(req, r.rows[0].csrf_hash);
    return r.rows[0];
  }
  csrf(req: Request, csrfHash: string) {
    const csrf = req.headers["x-csrf-token"];
    requireCondition(
      req.headers.origin === this.config.BROWSER_ORIGIN &&
        typeof csrf === "string" &&
        equal(this.tokenHash(csrf), csrfHash),
      "CSRF_REJECTED",
      403,
    );
  }
  async admin(
    req: Request,
    permission: string | undefined,
    c: PoolClient,
  ): Promise<AdminContext> {
    const raw = (req.cookies as Record<string, string> | undefined)?.yz_admin;
    requireCondition(
      raw && /^[A-Za-z0-9_-]{43}$/.test(raw),
      "UNAUTHENTICATED",
      401,
    );
    const r = await c.query<AdminContext & { csrf_hash: string; mfa_at: Date }>(
      `SELECT a.id,s.token_hash,s.csrf_hash,s.mfa_at FROM admin_sessions s
      JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND s.mfa_method='SMS' AND NOT a.disabled FOR UPDATE OF a`,
      [this.tokenHash(raw)],
    );
    requireCondition(r.rows[0], "UNAUTHENTICATED", 401);
    this.csrf(req, r.rows[0].csrf_hash);
    if (!permission) return r.rows[0];
    requireCondition(
      Date.now() - r.rows[0].mfa_at.getTime() < 5 * 60 * 1000,
      "MFA_REQUIRED",
      403,
    );
    const p = await c.query(
      `SELECT 1 FROM admin_user_roles u JOIN admin_role_permissions p ON p.role=u.role WHERE u.admin_id=$1 AND p.permission=$2`,
      [r.rows[0].id, permission],
    );
    requireCondition(p.rowCount, "FORBIDDEN", 403);
    return r.rows[0];
  }
  async product(
    c: PoolClient,
    device: DeviceContext,
    sku: string,
    availability: "trial" | "activation" | "none" = "none",
  ) {
    const r = await c.query<{
      sku: string;
      grade: number;
      trial_enabled: boolean;
      activation_enabled: boolean;
      publication_status: string;
    }>("SELECT * FROM products WHERE sku=$1 FOR SHARE", [sku]);
    requireCondition(r.rows[0], "PRODUCT_NOT_AVAILABLE", 404);
    await c.query(
      `INSERT INTO device_product_restrictions(device_id,sku,reason) VALUES($1,$2,'initial') ON CONFLICT DO NOTHING`,
      [device.device_id, sku],
    );
    const b = await c.query<{ blocked: boolean }>(
      "SELECT blocked FROM device_product_restrictions WHERE device_id=$1 AND sku=$2 FOR UPDATE",
      [device.device_id, sku],
    );
    requireCondition(!b.rows[0].blocked, "PRODUCT_BLOCKED", 403);
    if (availability !== "none")
      requireCondition(
        r.rows[0][
          availability === "trial" ? "trial_enabled" : "activation_enabled"
        ] && r.rows[0].publication_status === "published",
        "PRODUCT_NOT_AVAILABLE",
        403,
      );
    return r.rows[0];
  }
}
