import { z } from "zod";

export class ConfigurationError extends Error {}

// Every condition that must be independently reviewed before a production capability may serve
// traffic. Each gate is closed in source. There is deliberately no environment variable that opens
// a gate: opening one requires a reviewed code change with its own tests and evidence.
export const productionGates = [
  {
    id: "G1_FIRST_CLAIM_ASSURANCE",
    reason: "Physical ownership/first-claim assurance and dispute policy",
    // Opened for the 2.0.0 release on the owner's approval of the first-claim dispute policy
    // (docs/YARIZAN-FIRST-CLAIM-DISPUTE-POLICY.md) and recorded residual risk:
    // docs/evidence/release-2.0.0-owner-acceptance.md.
    open: true,
  },
  {
    id: "G1_SIGNING_CUSTODY",
    reason:
      "External commercial signing custody; development keys live in /app/.local",
    // Ceremony done (docs/evidence/license-key-ceremony-yarizan-license-2026-01.json). Stays closed
    // until backup B has a verified copy in independent storage and the root approval is merged.
    open: false,
  },
  {
    id: "G4_DESKTOP_CREDENTIALS",
    reason:
      "Production desktop roots and credential integration on physical Windows",
    // Opens together with G1_SIGNING_CUSTODY: the Windows build embeds only the approved root.
    open: false,
  },
  {
    id: "G6_ADMIN_SMS_MFA",
    reason:
      "Admin MFA needs live SMS with reviewed egress; no fallback login exists",
    // Password plus live SMS MFA stays mandatory; production refuses Admin or customer sign-in
    // without the live provider (productionChecks). Owner acceptance: docs/evidence/release-2.0.0-owner-acceptance.md.
    open: true,
  },
  {
    id: "G5_TRUSTED_RATE_LIMITS",
    reason: "IP-keyed limits collapse behind the CDN/Traefik proxy chain",
    // Option B (no network identity, docs/YARIZAN-G5-ANTI-ABUSE.md) is implemented and tested; the
    // owner waived the staging acceptance campaign and accepted the residual risk: docs/evidence/release-2.0.0-owner-acceptance.md.
    open: true,
  },
  {
    id: "G8_SECRET_CUSTODY",
    reason: "Durable key custody and recovery for HMAC/encryption keys",
    // Opened on the recorded custody ceremony and two passing restore drills of the first
    // production backup: docs/evidence/g8-secret-custody-2026-10-23.json.
    open: true,
  },
] as const;
export type GateId = (typeof productionGates)[number]["id"];

// Live ZarinPal payments (real money). Opened by the owner's commercial go for 2.0.0
// (docs/evidence/release-2.0.0-owner-acceptance.md). It only permits COMMERCE_MODE=zarinpal; the
// mode still needs LIVE_COMMERCE, production, the merchant ID and the exact production callback.
export const ZARINPAL_LIVE_GATE_OPEN = true;

// Independently reviewed production capabilities. A capability serves production traffic only when
// (1) it is approved here, in source, by a reviewed change that records its evidence, (2) every gate
// it depends on is open in source, (3) the operator lists it in ENABLED_CAPABILITIES and (4) its own
// runtime prerequisites validate. Listing an unknown or unapproved capability refuses startup. Each
// route and sensitive service checks its capabilities on every call (src/security/capabilities.ts),
// so a disabled capability is rejected explicitly and never falls back to synthetic behaviour.
// Development and test enable every capability unless ENABLED_CAPABILITIES narrows them.
export const capabilityIds = [
  "PRODUCTION_CORE",
  "CUSTOMER_AUTH",
  "ADMIN_AUTH",
  "DESKTOP_PROVISIONING",
  "TRIALS_AND_LICENSES",
  "LIVE_COMMERCE",
] as const;
export type CapabilityId = (typeof capabilityIds)[number];
export const capabilities: Record<
  CapabilityId,
  { approved: boolean; gates: GateId[]; requirement: string }
> = {
  // Evidence enforced here: a dedicated runtime login on the internal "db" host, an HTTPS browser
  // origin, independent high-entropy keys and no development fixtures; /ready verifies migration
  // count and hashes. Opening G8 additionally needs server-generated secrets with recorded offline
  // custody and a successful isolated restore drill (infrastructure preflight).
  PRODUCTION_CORE: {
    approved: true,
    gates: ["G8_SECRET_CUSTODY"],
    requirement:
      "PostgreSQL, validated secrets, migrations, health, backup and restore",
  },
  CUSTOMER_AUTH: {
    approved: true,
    gates: ["G5_TRUSTED_RATE_LIMITS", "G1_FIRST_CLAIM_ASSURANCE"],
    requirement:
      "Trusted client identity for rate limits and live customer OTP SMS through the reviewed egress",
  },
  ADMIN_AUTH: {
    approved: true,
    gates: ["G5_TRUSTED_RATE_LIMITS", "G6_ADMIN_SMS_MFA"],
    requirement:
      "Password plus live SMS MFA through the reviewed egress and two privately enrolled owners",
  },
  DESKTOP_PROVISIONING: {
    approved: true,
    gates: ["G4_DESKTOP_CREDENTIALS", "G5_TRUSTED_RATE_LIMITS"],
    requirement:
      "Production desktop roots and credential acceptance on physical Windows (W1-W14)",
  },
  TRIALS_AND_LICENSES: {
    approved: true,
    gates: ["G1_SIGNING_CUSTODY"],
    requirement:
      "Production license-signing ceremony with the approved root registered in the Windows app",
  },
  LIVE_COMMERCE: {
    approved: true,
    gates: [],
    requirement:
      "Restricted payment egress, reconciliation and refund procedures and the owner's real-money go",
  },
};
const sourceGateOpen = (id: GateId) =>
  productionGates.some((gate) => gate.id === id && gate.open);
export function closedGatesFor(
  id: CapabilityId,
  registry = capabilities,
  gateOpen = sourceGateOpen,
) {
  return registry[id].gates.filter((gate) => !gateOpen(gate));
}
/** Gates that still keep the whole API from starting in production: those of PRODUCTION_CORE. */
export function closedProductionGates() {
  return closedGatesFor("PRODUCTION_CORE");
}
// Production keys must be generated on the server: a repeated or patterned value (for example the
// CI fixtures "1111..." or "abab...") is refused.
export function highEntropyHex(value: string) {
  return new Set(value.toLowerCase()).size >= 10 && !/(.)\1{5}/.test(value);
}
/**
 * Resolves ENABLED_CAPABILITIES. The registry and gate state default to the reviewed source values;
 * tests pass their own to exercise the production rules while the real gates stay closed.
 */
export function enabledCapabilities(
  value: string | undefined,
  production: boolean,
  registry = capabilities,
  gateOpen = sourceGateOpen,
) {
  if (value === undefined) {
    if (production)
      throw new ConfigurationError(
        "ENABLED_CAPABILITIES_REQUIRED: list the approved production capabilities",
      );
    return new Set<CapabilityId>(capabilityIds);
  }
  const enabled = new Set<CapabilityId>();
  for (const id of value.split(",")) {
    if (!(capabilityIds as readonly string[]).includes(id))
      throw new ConfigurationError("CAPABILITY_UNKNOWN");
    enabled.add(id as CapabilityId);
  }
  if (production) {
    if (!enabled.has("PRODUCTION_CORE"))
      throw new ConfigurationError("CAPABILITY_REQUIRED: PRODUCTION_CORE");
    for (const id of enabled) {
      if (!registry[id].approved)
        throw new ConfigurationError("CAPABILITY_NOT_APPROVED: " + id);
      const closed = closedGatesFor(id, registry, gateOpen);
      if (closed.length)
        throw new ConfigurationError(
          (id === "PRODUCTION_CORE"
            ? "PRODUCTION_GATE_CLOSED: "
            : "CAPABILITY_GATE_CLOSED: " + id + ": ") + closed.join(","),
        );
    }
  }
  return enabled;
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
    "LICENSE_SIGNING_KEY_FILE",
    "LICENSE_SIGNING_KID",
    "LICENSE_SIGNING_KEY_SHA256",
    "ENABLED_CAPABILITIES",
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
      // Production license-signing key (G1 signing custody): a root-owned PKCS#8 file mounted
      // read-only, its reviewed kid and its approved SPKI SHA-256. All three or none.
      LICENSE_SIGNING_KEY_FILE: z
        .string()
        .regex(/^\/[A-Za-z0-9/_.-]{1,200}$/)
        .optional(),
      LICENSE_SIGNING_KID: z
        .string()
        .regex(/^yarizan-license-[a-z0-9-]{1,40}$/)
        .optional(),
      LICENSE_SIGNING_KEY_SHA256: z
        .string()
        .regex(/^[0-9A-F]{64}$/)
        .optional(),
      SMS_ALLOW_LIVE: z.enum(["true", "false"]).default("false"),
      SMS_FAKE_OUTBOX: z.string().optional(),
      MFA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
      ENABLED_CAPABILITIES: z
        .string()
        .regex(/^[A-Z_]{1,40}(,[A-Z_]{1,40}){0,9}$/)
        .optional(),
    })
    .safeParse(runtimeEnv);
  if (!parsed.success)
    throw new ConfigurationError(
      "CONFIGURATION_INVALID: required environment keys missing or malformed",
    );
  const signing = [
    parsed.data.LICENSE_SIGNING_KEY_FILE,
    parsed.data.LICENSE_SIGNING_KID,
    parsed.data.LICENSE_SIGNING_KEY_SHA256,
  ].filter(Boolean).length;
  if (signing !== 0 && signing !== 3)
    throw new ConfigurationError("LICENSE_SIGNING_CONFIGURATION_INCOMPLETE");
  if (
    parsed.data.LICENSE_SIGNING_KID &&
    /test|fixture|disposable|development|demo/i.test(
      parsed.data.LICENSE_SIGNING_KID,
    )
  )
    throw new ConfigurationError("LICENSE_SIGNING_KID_NOT_PRODUCTION");
  const production = parsed.data.NODE_ENV === "production";
  // Production stays refused while a gate of PRODUCTION_CORE is closed, whatever is enabled.
  if (production && closedProductionGates().length)
    throw new ConfigurationError(
      "PRODUCTION_GATE_CLOSED: " + closedProductionGates().join(","),
    );
  const enabled = enabledCapabilities(
    parsed.data.ENABLED_CAPABILITIES,
    production,
  );
  if (production) productionChecks(parsed.data, enabled);
  // Live payments: production only, behind the source gate, with the merchant and exactly the
  // production return URL. Every other environment uses the fake provider or the local sandbox.
  if (parsed.data.COMMERCE_MODE === "zarinpal") {
    if (!ZARINPAL_LIVE_GATE_OPEN)
      throw new ConfigurationError("ZARINPAL_LIVE_GATE_CLOSED");
    if (!production)
      throw new ConfigurationError("ZARINPAL_LIVE_PRODUCTION_ONLY");
    if (!parsed.data.ZARINPAL_MERCHANT_ID)
      throw new ConfigurationError("ZARINPAL_LIVE_CONFIGURATION_REQUIRED");
    if (
      parsed.data.ZARINPAL_CALLBACK_URL !==
      new URL("/payment/return", parsed.data.BROWSER_ORIGIN).href
    )
      throw new ConfigurationError("ZARINPAL_CALLBACK_URL_INVALID");
  }
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
  return {
    ...parsed.data,
    enabledCapabilities: enabled as ReadonlySet<CapabilityId>,
  };
}

// Production-only rules. A capability that is not enabled must also have no live side effect
// configured, so a disabled feature can never reach a provider, a signing key or a fixture.
export function productionChecks(
  c: {
    COMMERCE_MODE: string;
    SMS_PROVIDER: string;
    SMS_FAKE_OUTBOX?: string;
    BROWSER_ORIGIN: string;
    DATABASE_URL: string;
    CODE_HMAC_KEY: string;
    TOKEN_HMAC_KEY: string;
    MFA_ENCRYPTION_KEY: string;
    MOBILE_ENCRYPTION_KEY?: string;
    OTP_HMAC_KEY?: string;
    LICENSE_SIGNING_KEY_FILE?: string;
  },
  enabled: ReadonlySet<CapabilityId>,
) {
  if (c.COMMERCE_MODE === "fake" || c.COMMERCE_MODE === "zarinpal_sandbox")
    throw new ConfigurationError("COMMERCE_TEST_MODE_REFUSED");
  if (c.COMMERCE_MODE !== "disabled" && !enabled.has("LIVE_COMMERCE"))
    throw new ConfigurationError("COMMERCE_MODE_REFUSED");
  if (c.SMS_PROVIDER === "fake" || c.SMS_FAKE_OUTBOX)
    throw new ConfigurationError("SMS_TEST_PROVIDER_REFUSED");
  if (
    c.SMS_PROVIDER !== "disabled" &&
    !enabled.has("CUSTOMER_AUTH") &&
    !enabled.has("ADMIN_AUTH")
  )
    throw new ConfigurationError("SMS_PROVIDER_REFUSED");
  // Sign-in sends one-time codes: production needs the live provider, never a disabled one.
  if (
    (enabled.has("CUSTOMER_AUTH") || enabled.has("ADMIN_AUTH")) &&
    c.SMS_PROVIDER !== "melipayamak"
  )
    throw new ConfigurationError("SMS_PROVIDER_REQUIRED");
  if (c.LICENSE_SIGNING_KEY_FILE && !enabled.has("TRIALS_AND_LICENSES"))
    throw new ConfigurationError("LICENSE_SIGNING_REFUSED");
  const origin = new URL(c.BROWSER_ORIGIN);
  if (
    origin.protocol !== "https:" ||
    ["localhost", "127.0.0.1"].includes(origin.hostname)
  )
    throw new ConfigurationError("PRODUCTION_ORIGIN_REQUIRED");
  const db = new URL(c.DATABASE_URL);
  if (db.hostname !== "db" || !db.username || db.username === "postgres")
    throw new ConfigurationError("PRODUCTION_RUNTIME_DATABASE_LOGIN_REQUIRED");
  for (const key of [
    c.CODE_HMAC_KEY,
    c.TOKEN_HMAC_KEY,
    c.MFA_ENCRYPTION_KEY,
    c.MOBILE_ENCRYPTION_KEY,
    c.OTP_HMAC_KEY,
  ])
    if (key !== undefined && !highEntropyHex(key))
      throw new ConfigurationError("PRODUCTION_SECRET_REQUIRED");
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
