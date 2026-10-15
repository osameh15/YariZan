import { randomUUID, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { Database } from "../dist/src/database/database.js";
import { seal } from "../dist/src/security/crypto.js";

if (!["development", "test"].includes(process.env.NODE_ENV))
  throw new Error("Development provisioning only");
const username = process.env.ADMIN_USERNAME,
  password = process.env.ADMIN_PASSWORD;
if (!username || !password || password.length < 16)
  throw new Error("Set ADMIN_USERNAME and a strong ADMIN_PASSWORD temporarily");
const mobile = process.env.ADMIN_MOBILE;
if (
  !mobile ||
  !/^09[0-9]{9}$/.test(mobile) ||
  !process.env.MOBILE_ENCRYPTION_KEY
)
  throw new Error(
    "Set verified ADMIN_MOBILE and MOBILE_ENCRYPTION_KEY through an independently verified operator procedure",
  );
const db = new Database(),
  secret = randomBytes(20).toString("hex"),
  id = randomUUID();
try {
  await db.transaction(async (c) => {
    await c.query(
      "INSERT INTO admins(id,username,password_hash,mfa_ciphertext,mobile_ciphertext,mobile_last4) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        username,
        await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        }),
        seal(secret, process.env.MFA_ENCRYPTION_KEY),
        seal(mobile, process.env.MOBILE_ENCRYPTION_KEY),
        mobile.slice(-4),
      ],
    );
    await c.query("INSERT INTO admin_user_roles VALUES($1,'owner')", [id]);
  });
  process.stdout.write(
    "Development Admin created with SMS MFA. No TOTP fallback or secret output.\n",
  );
} finally {
  await db.onApplicationShutdown();
}
