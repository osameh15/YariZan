import { Injectable } from "@nestjs/common";
import { hashPassword, verifyPassword } from "../security/passwords";
import { randomUUID } from "node:crypto";
import { Database } from "../database/database";
import { Security } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { token, totp, unseal } from "../security/crypto";

@Injectable()
export class Accounts {
  private readonly dummy = hashPassword(
    "synthetic-enumeration-defense-password",
  );
  constructor(
    private db: Database,
    private security: Security,
    private audit: Audit,
  ) {}
  async login(username: string, password: string, actor: Actor) {
    const row = (
      await this.db.query<{ id: string; password_hash: string | null }>(
        "SELECT id,password_hash FROM customers WHERE username=$1 AND state='ACTIVE'",
        [username],
      )
    ).rows[0];
    const valid = await verifyPassword(
      row?.password_hash ?? (await this.dummy),
      password,
    );
    requireCondition(
      row && row.password_hash && valid,
      "INVALID_CREDENTIALS",
      401,
    );
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
      const session = token(),
        csrf = token();
      await c.query(
        `INSERT INTO customer_sessions(token_hash,customer_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')`,
        [
          this.security.tokenHash(session),
          row.id,
          this.security.tokenHash(csrf),
        ],
      );
      await this.audit.append(
        c,
        { ...actor, type: "CUSTOMER", id: row.id },
        "customer.login",
        row.id,
      );
      return { session, csrf };
    });
  }
  async rotate(tokenHash: string, customerId: string, actor: Actor) {
    return this.db.transaction(async (c) => {
      const current = await c.query(
        "SELECT 1 FROM customers WHERE id=$1 AND state='ACTIVE' FOR UPDATE",
        [customerId],
      );
      requireCondition(current.rowCount, "UNAUTHENTICATED", 401);
      const r = await c.query(
        `UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING customer_id`,
        [tokenHash],
      );
      requireCondition(r.rowCount, "UNAUTHENTICATED", 401);
      const session = token(),
        csrf = token();
      await c.query(
        `INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '8 hours',null)`,
        [
          this.security.tokenHash(session),
          customerId,
          this.security.tokenHash(csrf),
        ],
      );
      await this.audit.append(c, actor, "customer.session_rotated", customerId);
      return { session, csrf };
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
        "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1",
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
  async adminLogin(
    username: string,
    password: string,
    code: string,
    actor: Actor,
  ) {
    const row = (
      await this.db.query<{
        id: string;
        password_hash: string;
        mfa_ciphertext: string;
      }>("SELECT * FROM admins WHERE username=$1 AND NOT disabled", [username])
    ).rows[0];
    const valid = await verifyPassword(
      row?.password_hash ?? (await this.dummy),
      password,
    );
    requireCondition(row && valid, "INVALID_CREDENTIALS", 401);
    return this.db.transaction(async (c) => {
      const admin = (
        await c.query<{ last_mfa_step: string; disabled: boolean }>(
          "SELECT last_mfa_step,disabled FROM admins WHERE id=$1 FOR UPDATE",
          [row.id],
        )
      ).rows[0];
      requireCondition(!admin.disabled, "INVALID_CREDENTIALS", 401);
      const secret = unseal(
        row.mfa_ciphertext,
        this.security.config.MFA_ENCRYPTION_KEY,
      );
      const step = Math.floor(Date.now() / 30000);
      const matched = [step - 1, step, step + 1].find(
        (s) => s > Number(admin.last_mfa_step) && totp(secret, s) === code,
      );
      requireCondition(matched !== undefined, "MFA_REQUIRED", 401);
      await c.query("UPDATE admins SET last_mfa_step=$2 WHERE id=$1", [
        row.id,
        matched,
      ]);
      const session = token(),
        csrf = token();
      await c.query(
        `INSERT INTO admin_sessions VALUES($1,$2,$3,now(),now()+interval '1 hour',null)`,
        [
          this.security.tokenHash(session),
          row.id,
          this.security.tokenHash(csrf),
        ],
      );
      await this.audit.append(
        c,
        { ...actor, type: "ADMIN", id: row.id },
        "admin.login",
        row.id,
      );
      return { session, csrf };
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
      "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1",
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
