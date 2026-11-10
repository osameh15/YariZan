import { queueLoginNotice } from "./login-notice";
import { Injectable } from "@nestjs/common";
import { hashPassword, verifyPassword } from "../security/passwords";
import { randomUUID } from "node:crypto";
import { Database } from "../database/database";
import { Security, CustomerContext } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { hash, token } from "../security/crypto";
import { Abuse } from "../security/abuse";
import { customerSession } from "./sessions";

@Injectable()
export class Accounts {
  private readonly dummy = hashPassword(
    "synthetic-enumeration-defense-password",
  );
  constructor(
    private db: Database,
    private security: Security,
    private audit: Audit,
    private abuse: Abuse,
  ) {}
  /**
   * Password sign-in. Only failures are counted (G5): per username for unknown browsers and per
   * trust token for a browser that signed in before, so a flood against a username never slows a
   * known browser of that account. The check runs before the password hash, so floods stay cheap.
   */
  async login(
    username: string,
    password: string,
    actor: Actor,
    trustFor: (
      principalId: string | undefined,
      stamp: string,
    ) => string | null = () => null,
  ) {
    const row = (
      await this.db.query<{ id: string; password_hash: string | null }>(
        "SELECT id,password_hash FROM customers WHERE username=$1 AND state='ACTIVE'",
        [username],
      )
    ).rows[0];
    const stamp = hash(row?.password_hash ?? "");
    const trust = trustFor(row?.id, stamp);
    await this.abuse.assertNotThrottled("customer", username, trust);
    const valid = await verifyPassword(
      row?.password_hash ?? (await this.dummy),
      password,
    );
    if (!(row && row.password_hash && valid)) {
      await this.abuse.recordFailure("customer", username, trust);
      await this.db.transaction((c) =>
        this.audit.append(c, actor, "customer.login_failed", "authentication"),
      );
      requireCondition(false, "INVALID_CREDENTIALS", 401);
    }
    return this.db.transaction(async (c) => {
      const current = await c.query<{ password_hash: string | null }>(
        "SELECT password_hash FROM customers WHERE id=$1 AND state='ACTIVE' FOR UPDATE",
        [row.id],
      );
      requireCondition(
        current.rows[0]?.password_hash === row.password_hash,
        "INVALID_CREDENTIALS",
        401,
      );
      const session = await customerSession(c, this.security, row.id);
      await this.audit.append(
        c,
        { ...actor, type: "CUSTOMER", id: row.id },
        "customer.login",
        row.id,
      );
      await queueLoginNotice(c, "customer", row.id);
      return {
        ...session,
        trust: this.abuse.trustToken("customer", row.id, stamp),
      };
    });
  }
  async rotate(tokenHash: string, customerId: string, actor: Actor) {
    return this.db.transaction(async (c) => {
      const current = await c.query(
        "SELECT 1 FROM customers WHERE id=$1 AND state='ACTIVE' FOR UPDATE",
        [customerId],
      );
      requireCondition(current.rowCount, "UNAUTHENTICATED", 401);
      const prior = await this.security.customerSession(tokenHash, c);
      const r = await c.query(
        `UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=$1 AND customer_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() RETURNING customer_id`,
        [tokenHash, customerId],
      );
      requireCondition(r.rowCount, "UNAUTHENTICATED", 401);
      const session = await customerSession(
        c,
        this.security,
        customerId,
        prior.auth_customer_id
          ? {
              expires_at: prior.expires_at,
              auth_customer_id: prior.auth_customer_id,
              auth_generation: prior.auth_generation!,
              auth_stamp: prior.auth_stamp!,
              auth_mobile_lookup: prior.auth_mobile_lookup!,
            }
          : undefined,
      );
      await this.audit.append(c, actor, "customer.session_rotated", customerId);
      return session;
    });
  }
  /** Change browser context only; device credentials, orders and licenses never move. */
  async switchDevice(u: CustomerContext, username: string, actor: Actor) {
    await this.security.rate("device-switch:" + u.id, 20, 60);
    return this.db.transaction(async (c) => {
      const initial = await this.security.customerSession(u.token_hash, c);
      const candidate = (
        await c.query<{ id: string }>(
          "SELECT id FROM customers WHERE username=$1 AND state='ACTIVE'",
          [username],
        )
      ).rows[0];
      requireCondition(
        candidate && candidate.id !== u.id,
        "TARGET_DEVICE_INVALID",
        422,
      );
      const ids = [
        ...new Set([u.id, candidate.id, initial.auth_customer_id ?? u.id]),
      ].sort();
      // Stable device/customer lock ordering serializes switches with device resets and password changes.
      await c.query(
        `SELECT d.id FROM devices d WHERE d.id IN
        (SELECT device_id FROM customers WHERE id=ANY($1::uuid[])) ORDER BY d.id FOR SHARE`,
        [ids],
      );
      const locked = await c.query<{
        id: string;
        device_id: string;
        generation: number;
        state: string;
        mobile_verified_at: Date | null;
        mobile_lookup: string | null;
        device_label: string | null;
      }>(
        "SELECT * FROM customers WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [ids],
      );
      await c.query(
        "SELECT token_hash FROM customer_sessions WHERE token_hash=$1 FOR UPDATE",
        [u.token_hash],
      );
      const current = await this.security.customerSession(u.token_hash, c);
      requireCondition(
        current.id === u.id &&
          current.device_id === u.device_id &&
          current.generation === u.generation,
        "UNAUTHENTICATED",
        401,
      );
      const target = locked.rows.find((r) => r.id === candidate.id)!;
      requireCondition(
        current.mobile_verified_at &&
          current.mobile_lookup &&
          target.state === "ACTIVE" &&
          target.mobile_verified_at &&
          target.mobile_lookup === current.mobile_lookup &&
          (
            await c.query(
              "SELECT 1 FROM devices WHERE id=$1 AND generation=$2",
              [target.device_id, target.generation],
            )
          ).rowCount,
        "TARGET_DEVICE_INVALID",
        422,
      );
      const scope = {
        expires_at: current.expires_at,
        auth_customer_id: current.auth_customer_id ?? current.id,
        auth_generation: current.auth_generation ?? current.generation,
        auth_stamp:
          current.auth_stamp ??
          hash((current.password_hash ?? "") + "\n" + current.mobile_lookup),
        auth_mobile_lookup:
          current.auth_mobile_lookup ?? current.mobile_lookup!,
      };
      const retired = await c.query(
        `UPDATE customer_sessions SET revoked_at=clock_timestamp()
        WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()`,
        [u.token_hash],
      );
      requireCondition(retired.rowCount, "UNAUTHENTICATED", 401);
      const next = await customerSession(c, this.security, target.id, scope);
      await this.audit.append(c, actor, "customer.device_switched", target.id, {
        from_device_id: current.device_id,
        to_device_id: target.device_id,
      });
      return { ...next, username, label: target.device_label };
    });
  }
  async logout(tokenHash: string, actor: Actor) {
    await this.db.transaction(async (c) => {
      await c.query(
        "UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=$1",
        [tokenHash],
      );
      await this.audit.append(
        c,
        actor,
        "customer.logout",
        actor.id ?? "session",
      );
    });
    return { revoked: true };
  }
  async completeReset(grant: string, password: string, actor: Actor) {
    const admission = await this.db.query(
      `SELECT 1 FROM password_resets r JOIN customers c ON c.id=r.customer_id WHERE r.token_hash=$1 AND r.used_at IS NULL AND r.expires_at>now() AND c.state='ACTIVE'`,
      [this.security.tokenHash(grant)],
    );
    requireCondition(admission.rowCount, "RESET_INVALID", 410);
    const encoded = await hashPassword(password);
    return this.db.transaction(async (c) => {
      const r = await c.query<{ id: string; customer_id: string }>(
        `SELECT r.id,r.customer_id FROM password_resets r JOIN customers c ON c.id=r.customer_id WHERE token_hash=$1
        AND used_at IS NULL AND expires_at>now() AND c.state='ACTIVE' FOR UPDATE OF r,c`,
        [this.security.tokenHash(grant)],
      );
      requireCondition(r.rows[0], "RESET_INVALID", 410);
      const p = r.rows[0];
      await c.query("UPDATE password_resets SET used_at=now() WHERE id=$1", [
        p.id,
      ]);
      await c.query("UPDATE customers SET password_hash=$2 WHERE id=$1", [
        p.customer_id,
        encoded,
      ]);
      await c.query(
        "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1 OR auth_customer_id=$1",
        [p.customer_id],
      );
      await this.audit.append(
        c,
        actor,
        "password.reset_completed",
        p.customer_id,
      );
      return { password_changed: true };
    });
  }
  async issueReset(
    c: import("pg").PoolClient,
    customerId: string,
    evidence: string,
    actor: Actor,
  ) {
    requireCondition(
      (
        await c.query(
          "SELECT 1 FROM customers WHERE id=$1 AND state='ACTIVE' FOR UPDATE",
          [customerId],
        )
      ).rowCount,
      "NOT_FOUND",
      404,
    );
    await c.query("UPDATE customers SET password_hash=NULL WHERE id=$1", [
      customerId,
    ]);
    await c.query(
      "UPDATE password_resets SET used_at=now() WHERE customer_id=$1 AND used_at IS NULL",
      [customerId],
    );
    await c.query(
      "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1 OR auth_customer_id=$1",
      [customerId],
    );
    const grant = token();
    await c.query(
      `INSERT INTO password_resets(id,customer_id,token_hash,evidence_ref,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')`,
      [randomUUID(), customerId, this.security.tokenHash(grant), evidence],
    );
    await this.audit.append(c, actor, "password.reset_issued", customerId);
    return { reset_grant: grant };
  }
}
