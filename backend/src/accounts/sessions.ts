import { PoolClient } from "pg";
import { Response } from "express";
import { Security } from "../security/security";
import { token } from "../security/crypto";
import { Principal, TRUST_COOKIE } from "../security/abuse";

/** Device trust from a verified sign-in: keeps this browser out of targeted lockout (G5). */
export function trustCookie(
  res: Response,
  security: Security,
  kind: Principal,
  value: string,
) {
  res.cookie(TRUST_COOKIE[kind], value, {
    httpOnly: true,
    sameSite: "strict",
    secure: security.config.NODE_ENV === "production",
    path: "/api/v2",
    maxAge: 180 * 86400000,
  });
}

export async function customerSession(
  c: PoolClient,
  security: Security,
  customerId: string,
  scope?: {
    expires_at: Date;
    auth_customer_id: string;
    auth_generation: number;
    auth_stamp: string;
    auth_mobile_lookup: string;
  },
) {
  const session = token(),
    csrf = token();
  const row = await c.query<{ expires_at: Date }>(
    `INSERT INTO customer_sessions(token_hash,customer_id,csrf_hash,expires_at,auth_customer_id,auth_generation,auth_stamp,auth_mobile_lookup)
     VALUES($1,$2,$3,COALESCE($4::timestamptz,now()+interval '8 hours'),$5,$6,$7,$8) RETURNING expires_at`,
    [
      security.tokenHash(session),
      customerId,
      security.tokenHash(csrf),
      scope?.expires_at ?? null,
      scope?.auth_customer_id ?? null,
      scope?.auth_generation ?? null,
      scope?.auth_stamp ?? null,
      scope?.auth_mobile_lookup ?? null,
    ],
  );
  return { session, csrf, expires_at: row.rows[0]!.expires_at };
}

export function sessionCookies(
  res: Response,
  security: Security,
  result: { session: string; csrf: string; expires_at?: Date },
  admin = false,
) {
  const options = {
    sameSite: "strict" as const,
    secure: security.config.NODE_ENV === "production",
    maxAge: admin
      ? 3600000
      : Math.max(
          0,
          Math.min(
            8 * 3600000,
            result.expires_at
              ? result.expires_at.getTime() - Date.now()
              : 8 * 3600000,
          ),
        ),
  };
  res.cookie(admin ? "yz_admin" : "yz_customer", result.session, {
    ...options,
    httpOnly: true,
    path: "/api/v2",
  });
  res.cookie(admin ? "yz_csrf_admin" : "yz_csrf_customer", result.csrf, {
    ...options,
    httpOnly: false,
    path: "/",
  });
  res.setHeader("Cache-Control", "no-store");
  return { csrf_token: result.csrf };
}
