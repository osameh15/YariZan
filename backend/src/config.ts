import { z } from "zod";

export class ConfigurationError extends Error {}

// Every condition that must be independently reviewed before the API may start with
// NODE_ENV=production. Each gate is closed in source. There is deliberately no environment
// variable that opens a gate: opening one requires a reviewed code change with its own tests.
export const productionGates = [
  {
    id: "G1_FIRST_CLAIM_ASSURANCE",
    reason: "Physical ownership/first-claim assurance and dispute policy",
    open: false,
  },
  {
    id: "G1_SIGNING_CUSTODY",
    reason:
      "External commercial signing custody; development keys live in /app/.local",
    open: false,
  },
  {
    id: "G4_DESKTOP_CREDENTIALS",
    reason:
      "Production desktop roots and credential integration on physical Windows",
    open: false,
  },
  {
    id: "G6_ADMIN_SMS_MFA",
    reason:
      "Admin MFA needs live SMS with reviewed egress; no fallback login exists",
    open: false,
  },
  {
    id: "G5_TRUSTED_RATE_LIMITS",
    reason: "IP-keyed limits collapse behind the CDN/Traefik proxy chain",
    open: false,
  },
  {
    id: "G8_SECRET_CUSTODY",
    reason: "Durable key custody and recovery for HMAC/encryption keys",
    open: false,
  },
] as const;
export function closedProductionGates() {
  return productionGates.filter((gate) => !gate.open);
}

export function configuration(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === undefined || env.NODE_ENV === "")
    throw new ConfigurationError(
      "NODE_ENV_REQUIRED: explicitly select development, test or production",
    );
  if (!["development", "test", "production"].includes(env.NODE_ENV))
    throw new ConfigurationError(
      "NODE_ENV_INVALID: expected development, test or production",
    );
  const runtimeEnv = { ...env };
  for (const name of [
    "MOBILE_ENCRYPTION_KEY",
    "OTP_HMAC_KEY",
    "MELIPAYAMAK_API_TOKEN",
    "ZARINPAL_MERCHANT_ID",
    "ZARINPAL_CALLBACK_URL",
    "LOCAL_TEST_PRICE_G1_IRR",
    "SMS_FAKE_OUTBOX",
  ])
    if (runtimeEnv[name] === "") delete runtimeEnv[name];
  const parsed = z
    .object({
      COMMERCE_MODE: z
        .enum(["disabled", "fake", "zarinpal_sandbox", "zarinpal"])
        .default("disabled"),
      PURCHASE_SMS_TEMPLATE: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,64}$/)
        .default("purchase-confirmation-unconfigured"),
      NODE_ENV: z.enum(["development", "test", "production"]),
      DATABASE_URL: z.url(),
      PORT: z.coerce.number().int().min(1024).max(65535).default(3100),
      BROWSER_ORIGIN: z.url().default("http://localhost:3100"),
      CODE_HMAC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      TOKEN_HMAC_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      SMS_PROVIDER: z
        .enum(["disabled", "fake", "melipayamak"])
        .default("disabled"),
      MOBILE_ENCRYPTION_KEY: z
        .string()
        .regex(/^[a-fA-F0-9]{64}$/)
        .optional(),
      OTP_HMAC_KEY: z
        .string()
        .regex(/^[a-fA-F0-9]{64}$/)
        .optional(),
      MELIPAYAMAK_API_TOKEN: z
        .string()
        .regex(/^[A-Za-z0-9._~-]{8,256}$/)
        .optional(),
      // Private payment identity. Validated for shape only; COMMERCE_MODE=zarinpal stays refused
      // until the payment go/no-go gate is recorded, so nothing consumes it at runtime yet.
      ZARINPAL_MERCHANT_ID: z.uuid().optional(),
      // Local sandbox only: where the official ZarinPal sandbox returns the browser.
      ZARINPAL_CALLBACK_URL: z.url().optional(),
      // Local acceptance only: a clearly labelled test price for Grade 1 (integer IRR).
      LOCAL_TEST_PRICE_G1_IRR: z.coerce
        .number()
        .int()
        .min(10000)
        .max(100000000)
        .optional(),
      SMS_ALLOW_LIVE: z.enum(["true", "false"]).default("false"),
      SMS_FAKE_OUTBOX: z.string().optional(),
      MFA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
    })
    .safeParse(runtimeEnv);
  if (!parsed.success)
    throw new ConfigurationError(
      "CONFIGURATION_INVALID: required environment keys missing or malformed",
    );
  if (parsed.data.NODE_ENV === "production")
    throw new ConfigurationError(
      "PRODUCTION_GATE_CLOSED: " +
        closedProductionGates()
          .map((gate) => gate.id)
          .join(","),
    );
  if (parsed.data.COMMERCE_MODE === "zarinpal")
    throw new ConfigurationError("ZARINPAL_LIVE_GATE_CLOSED");
  // The local sandbox integration: the official ZarinPal sandbox host only, never a live merchant.
  // Production never reaches this point (the gate above refuses it); this check also refuses any
  // other environment so the mode has no possible production fallback.
  if (parsed.data.COMMERCE_MODE === "zarinpal_sandbox") {
    if (!["development", "test"].includes(parsed.data.NODE_ENV))
      throw new ConfigurationError("ZARINPAL_SANDBOX_LOCAL_ONLY");
    if (!parsed.data.ZARINPAL_MERCHANT_ID || !parsed.data.ZARINPAL_CALLBACK_URL)
      throw new ConfigurationError("ZARINPAL_SANDBOX_CONFIGURATION_REQUIRED");
    const callback = new URL(parsed.data.ZARINPAL_CALLBACK_URL);
    const loopback = ["localhost", "127.0.0.1"].includes(callback.hostname);
    if (
      !(
        callback.protocol === "https:" ||
        (callback.protocol === "http:" && loopback)
      ) ||
      callback.username ||
      callback.password ||
      callback.search ||
      callback.hash ||
      callback.pathname !== "/payment/return"
    )
      throw new ConfigurationError("ZARINPAL_CALLBACK_URL_INVALID");
  }
  if (
    parsed.data.LOCAL_TEST_PRICE_G1_IRR !== undefined &&
    (!["development", "test"].includes(parsed.data.NODE_ENV) ||
      !["fake", "zarinpal_sandbox"].includes(parsed.data.COMMERCE_MODE))
  )
    throw new ConfigurationError("LOCAL_TEST_PRICE_REFUSED");
  if (parsed.data.SMS_PROVIDER !== "disabled") {
    if (!parsed.data.MOBILE_ENCRYPTION_KEY || !parsed.data.OTP_HMAC_KEY)
      throw new ConfigurationError("SMS_SECRETS_REQUIRED");
    if (
      new Set([
        parsed.data.MOBILE_ENCRYPTION_KEY,
        parsed.data.OTP_HMAC_KEY,
        parsed.data.CODE_HMAC_KEY,
        parsed.data.TOKEN_HMAC_KEY,
        parsed.data.MFA_ENCRYPTION_KEY,
      ]).size !== 5
    )
      throw new ConfigurationError("INDEPENDENT_SECRETS_REQUIRED");
    if (
      parsed.data.SMS_PROVIDER === "melipayamak" &&
      (!parsed.data.MELIPAYAMAK_API_TOKEN ||
        parsed.data.SMS_ALLOW_LIVE !== "true")
    )
      throw new ConfigurationError("SMS_PROVIDER_CONFIGURATION_REQUIRED");
  }
  if (
    parsed.data.SMS_FAKE_OUTBOX &&
    !/^\.local\/[a-z0-9-]+\.jsonl$/.test(parsed.data.SMS_FAKE_OUTBOX)
  )
    throw new ConfigurationError("LOCAL_SMS_FIXTURE_PATH_REQUIRED");
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

// One-off migration and production bootstrap use their own, smaller configuration: no HMAC or
// encryption keys, and in production a dedicated migration login (never the runtime login).
export function migrationConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (!["development", "test", "production"].includes(env.NODE_ENV ?? ""))
    throw new ConfigurationError(
      env.NODE_ENV ? "NODE_ENV_INVALID" : "NODE_ENV_REQUIRED",
    );
  const production = env.NODE_ENV === "production";
  const value = production
    ? env.MIGRATION_DATABASE_URL
    : (env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL);
  if (!value)
    throw new ConfigurationError(
      production
        ? "MIGRATION_DATABASE_URL_REQUIRED: production migrations use the migration login"
        : "DATABASE_URL_REQUIRED",
    );
  if (production && env.DATABASE_URL && env.DATABASE_URL === value)
    throw new ConfigurationError(
      "INDEPENDENT_DATABASE_CREDENTIALS_REQUIRED: migration and runtime logins must differ",
    );
  let db: URL;
  try {
    db = new URL(value);
  } catch {
    throw new ConfigurationError("CONFIGURATION_INVALID");
  }
  if (db.protocol !== "postgresql:" && db.protocol !== "postgres:")
    throw new ConfigurationError("POSTGRESQL_REQUIRED");
  if (!["localhost", "127.0.0.1", "db"].includes(db.hostname))
    throw new ConfigurationError("DISPOSABLE_LOCAL_DATABASE_REQUIRED");
  return {
    NODE_ENV: env.NODE_ENV as "development" | "test" | "production",
    url: value,
  };
}
