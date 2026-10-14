import { z } from "zod";

export function configuration(env: NodeJS.ProcessEnv = process.env) {
  const parsed = z
    .object({
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      DATABASE_URL: z.url(),
      PORT: z.coerce.number().int().min(1024).max(65535).default(3100),
      BROWSER_ORIGIN: z.url().default("http://localhost:3100"),
      CODE_HMAC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      TOKEN_HMAC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      MFA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    })
    .safeParse(env);
  if (!parsed.success)
    throw new Error(
      "CONFIGURATION_INVALID: required environment keys missing or malformed",
    );
  if (parsed.data.NODE_ENV === "production") {
    throw new Error(
      "PRODUCTION_GATE_CLOSED: reviewed first-claim assurance, external signing custody and desktop credential integration required",
    );
  }
  const db = new URL(parsed.data.DATABASE_URL);
  if (db.protocol !== "postgresql:" && db.protocol !== "postgres:")
    throw new Error("POSTGRESQL_REQUIRED");
  if (!["localhost", "127.0.0.1", "db"].includes(db.hostname))
    throw new Error("DISPOSABLE_LOCAL_DATABASE_REQUIRED");
  if (
    new Set([
      parsed.data.CODE_HMAC_KEY,
      parsed.data.TOKEN_HMAC_KEY,
      parsed.data.MFA_ENCRYPTION_KEY,
    ]).size !== 3
  )
    throw new Error("INDEPENDENT_SECRETS_REQUIRED");
  return parsed.data;
}
export type Configuration = ReturnType<typeof configuration>;
