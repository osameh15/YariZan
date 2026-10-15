import { Injectable } from "@nestjs/common";
import { Request } from "express";
import { PoolClient } from "pg";
import { Database } from "../database/database";
import { Security, CustomerContext } from "../security/security";
import { Audit, Actor } from "../audit/audit";
import { hashPassword, verifyPassword } from "../security/passwords";
import { hash, token, unseal } from "../security/crypto";
import { requireCondition } from "../common/errors";
import { Otp, OtpRow, normalizeMobile } from "./otp";
interface Customer {
  id: string;
  generation: number;
  state: string;
  mobile_ciphertext: string | null;
  mobile_lookup: string | null;
  mobile_last4: string | null;
  password_hash: string | null;
}
@Injectable()
export class AuthFlows {
  private dummy = hashPassword("synthetic-mobile-enumeration-defense");
  constructor(
    private db: Database,
    private security: Security,
    private otp: Otp,
    private audit: Audit,
  ) {}
  private async session(c: PoolClient, id: string, admin = false) {
    const session = token(),
      csrf = token();
    if (admin)
      await c.query(
        "INSERT INTO admin_sessions(token_hash,admin_id,csrf_hash,mfa_at,expires_at,revoked_at,mfa_method) VALUES($1,$2,$3,now(),now()+interval '1 hour',null,'SMS')",
        [this.security.tokenHash(session), id, this.security.tokenHash(csrf)],
      );
    else
      await c.query(
        "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '8 hours',null)",
        [this.security.tokenHash(session), id, this.security.tokenHash(csrf)],
      );
    return { session, csrf };
  }
  async requestLogin(
    username: string,
    mobile: string,
    purpose: "LOGIN" | "RESET",
    actor: Actor,
  ) {
    const lookup = this.otp.lookup(mobile),
      r = (
        await this.db.query<Customer>(
          "SELECT * FROM customers WHERE username=$1 AND state='ACTIVE' AND mobile_lookup=$2",
          [username, lookup],
        )
      ).rows[0];
    return this.otp.issue(
      purpose,
      mobile,
      actor,
      r
        ? {
            principal_id: r.id,
            generation: r.generation,
            principal_stamp: hash((r.password_hash ?? "") + r.mobile_lookup),
          }
        : {},
      !!r,
    );
  }
  async verifyLogin(
    id: string,
    code: string,
    purpose: "LOGIN" | "RESET",
    actor: Actor,
    newPassword?: string,
  ) {
    const admitted = await this.otp.admit(id, purpose, code);
    requireCondition(admitted.principal_id, "OTP_INVALID", 401);
    const encoded =
      purpose === "RESET" ? await hashPassword(newPassword!) : undefined;
    return this.db.transaction(async (c) => {
      const s = (
        await c.query<OtpRow>("SELECT * FROM otp_challenges WHERE id=$1", [id])
      ).rows[0];
      requireCondition(s?.principal_id, "OTP_INVALID", 401);
      const r = (
        await c.query<Customer>(
          "SELECT c.* FROM customers c JOIN devices d ON d.id=c.device_id WHERE c.id=$1 AND c.state='ACTIVE' AND c.generation=d.generation FOR UPDATE OF c",
          [s.principal_id],
        )
      ).rows[0];
      requireCondition(
        r &&
          r.generation === s.generation &&
          hash((r.password_hash ?? "") + r.mobile_lookup) ===
            s.principal_stamp &&
          r.mobile_lookup === s.mobile_lookup,
        "OTP_INVALID",
        401,
      );
      await this.otp.consume(c, id, purpose, code, actor);
      if (encoded) {
        await c.query("UPDATE customers SET password_hash=$2 WHERE id=$1", [
          r.id,
          encoded,
        ]);
        await c.query(
          "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1",
          [r.id],
        );
        await this.audit.append(c, actor, "password.reset_mobile", r.id);
        return { password_changed: true };
      }
      const session = await this.session(c, r.id);
      await this.audit.append(
        c,
        { ...actor, type: "CUSTOMER", id: r.id },
        "customer.login_otp",
        r.id,
      );
      return session;
    });
  }
  async adminPrimary(username: string, password: string, actor: Actor) {
    const r = (
      await this.db.query<{
        id: string;
        password_hash: string;
        mobile_ciphertext: string | null;
      }>(
        "SELECT id,password_hash,mobile_ciphertext FROM admins WHERE username=$1 AND NOT disabled",
        [username],
      )
    ).rows[0];
    const valid = await verifyPassword(
      r?.password_hash ?? (await this.dummy),
      password,
    );
    if (!r || !valid) {
      await this.db.transaction((c) =>
        this.audit.append(c, actor, "admin.login_failed", "authentication"),
      );
      requireCondition(false, "INVALID_CREDENTIALS", 401);
    }
    this.otp.available();
    requireCondition(r.mobile_ciphertext, "ADMIN_SMS_NOT_ENROLLED", 403);
    return this.otp.issue(
      "ADMIN",
      unseal(r.mobile_ciphertext, this.security.config.MOBILE_ENCRYPTION_KEY!),
      actor,
      { principal_id: r.id, principal_stamp: hash(r.password_hash) },
    );
  }
  async adminVerify(id: string, code: string, actor: Actor) {
    await this.otp.admit(id, "ADMIN", code);
    return this.db.transaction(async (c) => {
      const s = (
        await c.query<OtpRow>("SELECT * FROM otp_challenges WHERE id=$1", [id])
      ).rows[0];
      const r = (
        await c.query<{
          id: string;
          password_hash: string;
          mobile_ciphertext: string;
        }>("SELECT * FROM admins WHERE id=$1 AND NOT disabled FOR UPDATE", [
          s.principal_id,
        ])
      ).rows[0];
      requireCondition(
        r &&
          hash(r.password_hash) === s.principal_stamp &&
          this.otp.lookup(
            unseal(
              r.mobile_ciphertext,
              this.security.config.MOBILE_ENCRYPTION_KEY!,
            ),
          ) === s.mobile_lookup,
        "OTP_INVALID",
        401,
      );
      await this.otp.consume(c, id, "ADMIN", code, actor);
      const session = await this.session(c, r.id, true);
      await this.audit.append(
        c,
        { ...actor, type: "ADMIN", id: r.id },
        "admin.login_sms",
        r.id,
      );
      return session;
    });
  }
  async details(context: CustomerContext) {
    const r = (
      await this.db.query<Customer>("SELECT * FROM customers WHERE id=$1", [
        context.id,
      ])
    ).rows[0];
    return {
      has_password: !!r.password_hash,
      mobile_masked: r.mobile_last4 ? "09•••••" + r.mobile_last4 : null,
      mobile_verified: !!r.mobile_last4,
    };
  }
  async requestSecurity(
    req: Request,
    purpose: "PASSWORD" | "MOBILE_OLD" | "MOBILE_NEW",
    actor: Actor,
    mobile?: string,
    currentId?: string,
    currentCode?: string,
    currentPassword?: string,
  ) {
    this.otp.available();
    await this.security.rate(
      "sms-account:" + (await this.security.customer(req)).id,
      6,
      3600,
    );
    const context = await this.security.customer(req),
      r = (
        await this.db.query<Customer>(
          "SELECT * FROM customers WHERE id=$1 AND state='ACTIVE'",
          [context.id],
        )
      ).rows[0];
    const binding = {
      principal_id: context.id,
      generation: context.generation,
      session_hash: context.token_hash,
      principal_stamp: hash((r.password_hash ?? "") + (r.mobile_lookup ?? "")),
    };
    if (purpose !== "MOBILE_NEW") {
      requireCondition(r.mobile_ciphertext, "MOBILE_REQUIRED", 409);
      return this.otp.issue(
        purpose,
        unseal(
          r.mobile_ciphertext,
          this.security.config.MOBILE_ENCRYPTION_KEY!,
        ),
        actor,
        binding,
      );
    }
    requireCondition(mobile, "MOBILE_INVALID");
    normalizeMobile(mobile);
    if (r.mobile_lookup) {
      requireCondition(currentId && currentCode, "OTP_REQUIRED");
      await this.otp.admit(currentId, "MOBILE_OLD", currentCode);
      const old = (
        await this.db.query<OtpRow>(
          "SELECT * FROM otp_challenges WHERE id=$1",
          [currentId],
        )
      ).rows[0];
      requireCondition(
        old.principal_id === context.id &&
          old.session_hash === context.token_hash &&
          old.mobile_lookup === r.mobile_lookup,
        "OTP_INVALID",
        401,
      );
    } else {
      requireCondition(r.password_hash && currentPassword, "PASSWORD_REQUIRED");
      requireCondition(
        await verifyPassword(r.password_hash, currentPassword),
        "INVALID_CREDENTIALS",
        401,
      );
    }
    return this.otp.issue("MOBILE_NEW", mobile, actor, binding);
  }
  async changeSecurity(
    req: Request,
    id: string,
    code: string,
    purpose: "PASSWORD" | "MOBILE_NEW",
    actor: Actor,
    password?: string,
    oldId?: string,
    oldCode?: string,
  ) {
    const context = await this.security.customer(req);
    const admitted = await this.otp.admit(id, purpose, code);
    requireCondition(
      admitted.principal_id === context.id &&
        admitted.session_hash === context.token_hash &&
        admitted.generation === context.generation,
      "OTP_INVALID",
      401,
    );
    if (oldId && oldCode) await this.otp.admit(oldId, "MOBILE_OLD", oldCode);
    const encoded =
      purpose === "PASSWORD" ? await hashPassword(password!) : undefined;
    return this.db.transaction(async (c) => {
      const user = await this.security.customer(req, c);
      const r = (
        await c.query<Customer>(
          "SELECT * FROM customers WHERE id=$1 AND state='ACTIVE' FOR UPDATE",
          [user.id],
        )
      ).rows[0];
      requireCondition(
        r && r.generation === context.generation,
        "UNAUTHENTICATED",
        401,
      );
      const stillActive = await c.query(
        "SELECT 1 FROM customer_sessions WHERE token_hash=$1 AND customer_id=$2 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE",
        [user.token_hash, user.id],
      );
      requireCondition(stillActive.rowCount, "UNAUTHENTICATED", 401);
      const stamp = hash((r.password_hash ?? "") + (r.mobile_lookup ?? ""));
      // Lock OTPs in sorted order for two-number changes to avoid cross-request deadlocks.
      await c.query(
        "SELECT id FROM otp_challenges WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [[id, ...(oldId ? [oldId] : [])]],
      );
      const proof = await this.otp.consume(c, id, purpose, code, actor);
      requireCondition(
        proof.principal_id === user.id &&
          proof.session_hash === user.token_hash &&
          proof.generation === user.generation &&
          proof.principal_stamp === stamp,
        "OTP_INVALID",
        401,
      );
      if (encoded) {
        requireCondition(
          proof.mobile_lookup === r.mobile_lookup,
          "OTP_INVALID",
          401,
        );
        await c.query("UPDATE customers SET password_hash=$2 WHERE id=$1", [
          r.id,
          encoded,
        ]);
      } else {
        if (r.mobile_lookup) {
          requireCondition(oldId && oldCode, "OTP_REQUIRED");
          const old = await this.otp.consume(
            c,
            oldId,
            "MOBILE_OLD",
            oldCode,
            actor,
          );
          requireCondition(
            old.principal_id === user.id &&
              old.session_hash === user.token_hash &&
              old.mobile_lookup === r.mobile_lookup &&
              old.principal_stamp === stamp,
            "OTP_INVALID",
            401,
          );
        }
        const mobile = unseal(
          proof.mobile_ciphertext,
          this.security.config.MOBILE_ENCRYPTION_KEY!,
        );
        await c.query(
          "UPDATE customers SET mobile_ciphertext=$2,mobile_lookup=$3,mobile_last4=$4,mobile_verified_at=now(),mobile_setup_required=true WHERE id=$1",
          [
            r.id,
            proof.mobile_ciphertext,
            proof.mobile_lookup,
            mobile.slice(-4),
          ],
        );
      }
      await c.query(
        "UPDATE customer_sessions SET revoked_at=now() WHERE customer_id=$1",
        [r.id],
      );
      await this.audit.append(
        c,
        { ...actor, type: "CUSTOMER", id: r.id },
        encoded
          ? r.password_hash
            ? "password.changed"
            : "password.set"
          : "mobile.changed",
        r.id,
      );
      return { changed: true, reauthentication_required: true };
    });
  }
}
