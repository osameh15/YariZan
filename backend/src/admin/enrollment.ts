import { Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { Audit, Actor } from "../audit/audit";
import { requireCondition } from "../common/errors";
import { Database } from "../database/database";
import { permissions } from "../database/seed";
import { Otp, OtpRow, normalizeMobile } from "../accounts/otp";
import { hashPassword, verifyPassword } from "../security/passwords";
import { Security } from "../security/security";
import { hash, seal, unseal } from "../security/crypto";

/**
 * Reviewed operator-side Production Admin enrollment.
 *
 * - `provision` creates a PENDING, disabled Admin with an Argon2id password hash and an encrypted
 *   phone. It holds no role and cannot log in. It never overwrites an existing Admin: the same
 *   identity is an idempotent no-op, any conflicting username or phone is refused.
 * - `begin` verifies the password of a pending Admin and sends the Admin MFA pattern (180 seconds).
 * - `complete` verifies that code, activates the Admin, assigns the existing `owner` role and writes
 *   the audit trail. It never creates a session: the Admin must still log in with password + SMS MFA.
 * Real phone numbers, passwords and codes are only ever read from the operator's terminal.
 */
export const ownerEnrollmentLimit = 2;
export const usernamePattern = /^[a-z][a-z0-9._-]{4,31}$/;
export type EnrollmentState = "PENDING" | "ACTIVE";
export interface ProvisionInput {
  username: string;
  password: string;
  mobile: string;
}
export function validateIdentity(input: ProvisionInput) {
  requireCondition(
    usernamePattern.test(input.username),
    "ADMIN_USERNAME_INVALID",
  );
  const mobile = normalizeMobile(input.mobile);
  const digits = (value: string) => value.replace(/\D/g, "");
  // A phone number must never double as a public identity.
  requireCondition(
    !digits(input.username).includes(digits(mobile).slice(-7)) &&
      digits(input.username).length < 7,
    "ADMIN_USERNAME_MUST_NOT_BE_A_PHONE",
  );
  requireCondition(
    input.password.length >= 16 &&
      input.password.length <= 128 &&
      /[a-z]/.test(input.password) &&
      /[A-Z]/.test(input.password) &&
      /[0-9]/.test(input.password) &&
      /[^A-Za-z0-9]/.test(input.password) &&
      !input.password.toLowerCase().includes(input.username),
    "ADMIN_PASSWORD_WEAK",
  );
  return mobile;
}

@Injectable()
export class AdminEnrollment {
  private readonly dummy = hashPassword("YariZan-Enrollment-Dummy-1!");
  constructor(
    private db: Database,
    private security: Security,
    private otp: Otp,
    private audit: Audit,
  ) {}

  async provision(input: ProvisionInput, actor: Actor) {
    const mobile = validateIdentity(input);
    const lookup = this.otp.lookup(mobile);
    return this.db.transaction(async (c) => {
      await c.query(
        "SELECT pg_advisory_xact_lock(hashtext('admin-enrollment'))",
      );
      const byName = (
        await c.query<{
          id: string;
          mobile_lookup: string | null;
          enrollment_state: EnrollmentState;
        }>(
          "SELECT id,mobile_lookup,enrollment_state FROM admins WHERE username=$1",
          [input.username],
        )
      ).rows[0];
      const byPhone = (
        await c.query<{ id: string; username: string }>(
          "SELECT id,username FROM admins WHERE mobile_lookup=$1",
          [lookup],
        )
      ).rows[0];
      if (byName) {
        // The same identity is idempotent: nothing is reset, rewritten or re-sent.
        requireCondition(
          byName.mobile_lookup === lookup,
          "ENROLLMENT_CONFLICT",
          409,
        );
        return {
          admin_id: byName.id,
          state: byName.enrollment_state,
          created: false,
        };
      }
      requireCondition(!byPhone, "ENROLLMENT_CONFLICT", 409);
      const enrolled = (
        await c.query<{ n: string }>(
          "SELECT count(*) AS n FROM admins WHERE mobile_lookup IS NOT NULL",
        )
      ).rows[0].n;
      requireCondition(
        Number(enrolled) < ownerEnrollmentLimit,
        "ENROLLMENT_LIMIT",
        409,
      );
      const id = randomUUID();
      await c.query(
        `INSERT INTO admins(id,username,password_hash,mfa_ciphertext,mobile_ciphertext,mobile_lookup,mobile_last4,disabled,enrollment_state)
        VALUES($1,$2,$3,$4,$5,$6,$7,true,'PENDING')`,
        [
          id,
          input.username,
          await hashPassword(input.password),
          // Legacy column only: the application has no TOTP login path, so this value is never used.
          seal(
            randomBytes(20).toString("hex"),
            this.security.config.MFA_ENCRYPTION_KEY,
          ),
          this.otp.encrypt(mobile),
          lookup,
          mobile.slice(-4),
        ],
      );
      await this.audit.append(c, actor, "admin.enrollment_created", id, {
        state: "PENDING",
      });
      return { admin_id: id, state: "PENDING" as const, created: true };
    });
  }

  async begin(username: string, password: string, actor: Actor) {
    await this.security.rate("admin-enroll:" + username, 5, 900);
    const row = (
      await this.db.query<{
        id: string;
        password_hash: string;
        mobile_ciphertext: string;
      }>(
        "SELECT id,password_hash,mobile_ciphertext FROM admins WHERE username=$1 AND enrollment_state='PENDING'",
        [username],
      )
    ).rows[0];
    const valid = await verifyPassword(
      row?.password_hash ?? (await this.dummy),
      password,
    );
    if (!row || !valid) {
      await this.db.transaction((c) =>
        this.audit.append(
          c,
          actor,
          "admin.enrollment_failed",
          "authentication",
        ),
      );
      requireCondition(false, "INVALID_CREDENTIALS", 401);
    }
    this.otp.available();
    return this.otp.issue(
      "ADMIN",
      unseal(
        row.mobile_ciphertext,
        this.security.config.MOBILE_ENCRYPTION_KEY!,
      ),
      actor,
      { principal_id: row.id, principal_stamp: hash(row.password_hash) },
    );
  }

  async complete(challengeId: string, code: string, actor: Actor) {
    await this.otp.admit(challengeId, "ADMIN", code);
    return this.db.transaction(async (c) => {
      const challenge = (
        await c.query<OtpRow>("SELECT * FROM otp_challenges WHERE id=$1", [
          challengeId,
        ])
      ).rows[0];
      const admin = (
        await c.query<{
          id: string;
          username: string;
          password_hash: string;
          mobile_ciphertext: string;
        }>(
          "SELECT id,username,password_hash,mobile_ciphertext FROM admins WHERE id=$1 AND enrollment_state='PENDING' FOR UPDATE",
          [challenge?.principal_id],
        )
      ).rows[0];
      // The code must belong to this pending Admin's own current password and phone.
      requireCondition(
        admin &&
          hash(admin.password_hash) === challenge.principal_stamp &&
          this.otp.lookup(
            unseal(
              admin.mobile_ciphertext,
              this.security.config.MOBILE_ENCRYPTION_KEY!,
            ),
          ) === challenge.mobile_lookup,
        "OTP_INVALID",
        401,
      );
      await this.otp.consume(c, challengeId, "ADMIN", code, actor);
      const self: Actor = { ...actor, type: "ADMIN", id: admin.id };
      await this.audit.append(c, self, "admin.enrollment_verified", admin.id);
      await c.query(
        "UPDATE admins SET disabled=false,enrollment_state='ACTIVE',enrolled_at=now() WHERE id=$1",
        [admin.id],
      );
      await this.audit.append(c, actor, "admin.activated", admin.id);
      await c.query(
        "INSERT INTO admin_user_roles(admin_id,role) VALUES($1,'owner')",
        [admin.id],
      );
      await this.audit.append(c, actor, "admin.role_assigned", admin.id, {
        role: "owner",
      });
      return { admin_id: admin.id, state: "ACTIVE" as const, role: "owner" };
    });
  }

  /** Sanitized readiness report: no phone, hash, secret or code. */
  async report() {
    const total = permissions.length;
    const rows = (
      await this.db.query<{
        id: string;
        username: string;
        enrollment_state: EnrollmentState;
        disabled: boolean;
        roles: string[];
        owner_permissions: string;
      }>(
        `SELECT a.id,a.username,a.enrollment_state,a.disabled,
          COALESCE(array_agg(DISTINCT ur.role) FILTER (WHERE ur.role IS NOT NULL),'{}') AS roles,
          (SELECT count(DISTINCT rp.permission) FROM admin_user_roles u JOIN admin_role_permissions rp ON rp.role=u.role WHERE u.admin_id=a.id) AS owner_permissions
        FROM admins a LEFT JOIN admin_user_roles ur ON ur.admin_id=a.id
        WHERE a.mobile_lookup IS NOT NULL
        GROUP BY a.id ORDER BY a.created_at`,
      )
    ).rows;
    return {
      admins: rows.map((r) => ({
        admin_id: r.id,
        username: r.username,
        state: r.enrollment_state,
        can_log_in: !r.disabled && r.enrollment_state === "ACTIVE",
        roles: r.roles,
        permissions: Number(r.owner_permissions),
        permissions_expected: total,
        complete_owner:
          r.roles.includes("owner") && Number(r.owner_permissions) === total,
      })),
      owner_limit: ownerEnrollmentLimit,
    };
  }
}
