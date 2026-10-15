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
const db = new Database(),
  secret = randomBytes(20).toString("hex"),
  id = randomUUID();
try {
  await db.transaction(async (c) => {
    await c.query(
      "INSERT INTO admins(id,username,password_hash,mfa_ciphertext) VALUES($1,$2,$3,$4)",
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
      ],
    );
    await c.query("INSERT INTO admin_user_roles VALUES($1,'owner')", [id]);
  });
  // Explicit one-time secret delivery to local issuer, not application logging.
  process.stdout.write(
    `Development Admin created. TOTP SHA1 secret (hex), shown once: ${secret}\n`,
  );
} finally {
  await db.onModuleDestroy();
}
