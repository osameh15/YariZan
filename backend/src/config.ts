import { z } from "zod";

export class ConfigurationError extends Error {}

export function configuration(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === undefined || env.NODE_ENV === "")
    throw new ConfigurationError(
      "NODE_ENV_REQUIRED: explicitly select development, test or production",
    );
  if (!["development", "test", "production"].includes(env.NODE_ENV))
    throw new ConfigurationError(
      "NODE_ENV_INVALID: expected development, test or production",
    );
  const parsed = z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]),
      DATABASE_URL: z.url(),
      PORT: z.coerce.number().int().min(1024).max(65535).default(3100),
      BROWSER_ORIGIN: z.url().default("http://localhost:3100"),
      CODE_HMAC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      TOKEN_HMAC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      MFA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    })
    .safeParse(env);
  if (!parsed.success)
    throw new ConfigurationError(
      "CONFIGURATION_INVALID: required environment keys missing or malformed",
    );
  if (parsed.data.NODE_ENV === "production") {
    throw new ConfigurationError(
      "PRODUCTION_GATE_CLOSED: reviewed first-claim assurance, external signing custody and desktop credential integration required",
    );
  }
  const db = new URL(parsed.data.DATABASE_URL);
  if (db.protocol !== "postgresql:" && db.protocol !== "postgres:")
    throw new ConfigurationError("POSTGRESQL_REQUIRED");
  if (!["localhost", "127.0.0.1", "db"].includes(db.hostname))
    throw new ConfigurationError("DISPOSABLE_LOCAL_DATABASE_REQUIRED");
  if (
    new Set([
      parsed.data.CODE_HMAC_KEY,
      parsed.data.TOKEN_HMAC_KEY,
      parsed.data.MFA_ENCRYPTION_KEY,
    ]).size !== 3
  )
    throw new ConfigurationError("INDEPENDENT_SECRETS_REQUIRED");
  return parsed.data;
}
export type Configuration = ReturnType<typeof configuration>;
