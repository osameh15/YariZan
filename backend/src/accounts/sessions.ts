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
) {
  const session = token(),
    csrf = token();
  await c.query(
    "INSERT INTO customer_sessions(token_hash,customer_id,csrf_hash,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",
    [security.tokenHash(session), customerId, security.tokenHash(csrf)],
  );
  return { session, csrf };
}

export function sessionCookies(
  res: Response,
  security: Security,
  result: { session: string; csrf: string },
  admin = false,
) {
  const options = {
    sameSite: "strict" as const,
    secure: security.config.NODE_ENV === "production",
    maxAge: admin ? 3600000 : 8 * 3600000,
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
