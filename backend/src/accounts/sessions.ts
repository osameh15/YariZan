import { PoolClient } from "pg";
import { Response } from "express";
import { Security } from "../security/security";
import { token } from "../security/crypto";

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
