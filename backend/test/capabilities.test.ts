import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { METHOD_METADATA } from "@nestjs/common/constants";
import {
  capabilities,
  capabilityIds,
  closedGatesFor,
  closedProductionGates,
  configuration,
  enabledCapabilities,
  highEntropyHex,
  productionChecks,
  type CapabilityId,
} from "../src/config";
import * as api from "../src/api/controllers";
import { CommerceController } from "../src/commerce/controller";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test";
for (const [key, value] of [
  ["CODE_HMAC_KEY", "1"],
  ["TOKEN_HMAC_KEY", "2"],
  ["MFA_ENCRYPTION_KEY", "3"],
])
  process.env[key] ??= value.repeat(64);

const key = () => randomBytes(32).toString("hex");
const allApproved = Object.fromEntries(
  capabilityIds.map((id) => [id, { ...capabilities[id], approved: true }]),
) as typeof capabilities;
const open = () => true;
const production = (
  overrides: Record<string, string | undefined> = {},
  enabled: CapabilityId[] = ["PRODUCTION_CORE"],
) =>
  productionChecks(
    {
      COMMERCE_MODE: "disabled",
      SMS_PROVIDER: "disabled",
      BROWSER_ORIGIN: "https://yarizan.oarnova.games",
      DATABASE_URL: "postgresql://yarizan_runtime:secret@db:5432/yarizan",
      CODE_HMAC_KEY: key(),
      TOKEN_HMAC_KEY: key(),
      MFA_ENCRYPTION_KEY: key(),
      ...overrides,
    } as Parameters<typeof productionChecks>[0],
    new Set(enabled),
  );

test("2.0.0: every capability is approved in source; licensing and provisioning stay behind their gates", () => {
  assert.deepEqual(
    capabilityIds.filter((id) => capabilities[id].approved),
    [...capabilityIds],
  );
  // Approval alone serves nothing: closed gates still refuse licensing and provisioning.
  assert.deepEqual(closedGatesFor("TRIALS_AND_LICENSES"), [
    "G1_SIGNING_CUSTODY",
  ]);
  assert.deepEqual(closedGatesFor("DESKTOP_PROVISIONING"), [
    "G4_DESKTOP_CREDENTIALS",
  ]);
  for (const id of ["CUSTOMER_AUTH", "ADMIN_AUTH", "LIVE_COMMERCE"] as const)
    assert.deepEqual(closedGatesFor(id), [], id);
  assert.ok(
    capabilities.TRIALS_AND_LICENSES.gates.includes("G1_SIGNING_CUSTODY"),
  );
  assert.ok(capabilities.ADMIN_AUTH.gates.includes("G6_ADMIN_SMS_MFA"));
  assert.ok(
    capabilities.CUSTOMER_AUTH.gates.includes("G5_TRUSTED_RATE_LIMITS"),
  );
});

test("G8 is open (recorded evidence): PRODUCTION_CORE starts; each further capability needs its own prerequisites", () => {
  assert.deepEqual(closedProductionGates(), []);
  const production = {
    NODE_ENV: "production",
    BROWSER_ORIGIN: "https://yarizan.oarnova.games",
    DATABASE_URL: "postgresql://yarizan_api:runtime-secret@db:5432/yarizan",
    CODE_HMAC_KEY: key(),
    TOKEN_HMAC_KEY: key(),
    MFA_ENCRYPTION_KEY: key(),
    MOBILE_ENCRYPTION_KEY: key(),
    OTP_HMAC_KEY: key(),
  };
  const started = configuration({
    ...production,
    ENABLED_CAPABILITIES: "PRODUCTION_CORE",
  });
  assert.deepEqual([...started.enabledCapabilities], ["PRODUCTION_CORE"]);
  assert.equal(started.COMMERCE_MODE, "disabled");
  assert.equal(started.SMS_PROVIDER, "disabled");
  // The operator must still name the capabilities.
  assert.throws(
    () => configuration(production),
    /ENABLED_CAPABILITIES_REQUIRED/,
  );
  const withCaps = (caps: string, extra: Record<string, string> = {}) =>
    configuration({ ...production, ENABLED_CAPABILITIES: caps, ...extra });
  // Licensing and provisioning stay refused while their gates are closed.
  assert.throws(
    () => withCaps("PRODUCTION_CORE,TRIALS_AND_LICENSES"),
    /CAPABILITY_GATE_CLOSED: TRIALS_AND_LICENSES: G1_SIGNING_CUSTODY/,
  );
  assert.throws(
    () => withCaps("PRODUCTION_CORE,DESKTOP_PROVISIONING"),
    /CAPABILITY_GATE_CLOSED: DESKTOP_PROVISIONING: G4_DESKTOP_CREDENTIALS/,
  );
  // Sign-in sends one-time codes: never without the live SMS provider.
  for (const id of ["CUSTOMER_AUTH", "ADMIN_AUTH"])
    assert.throws(
      () => withCaps("PRODUCTION_CORE," + id),
      /SMS_PROVIDER_REQUIRED/,
    );
  const live = {
    SMS_PROVIDER: "melipayamak",
    SMS_ALLOW_LIVE: "true",
    MELIPAYAMAK_API_TOKEN: "synthetic-token-0123456789",
  };
  assert.deepEqual(
    [
      ...withCaps("PRODUCTION_CORE,CUSTOMER_AUTH,ADMIN_AUTH", live)
        .enabledCapabilities,
    ],
    ["PRODUCTION_CORE", "CUSTOMER_AUTH", "ADMIN_AUTH"],
  );
  assert.throws(
    () =>
      withCaps("PRODUCTION_CORE,CUSTOMER_AUTH", {
        ...live,
        SMS_ALLOW_LIVE: "false",
      }),
    /SMS_PROVIDER_CONFIGURATION_REQUIRED/,
  );
  // Live commerce alone with commerce disabled starts and moves no money.
  assert.equal(
    withCaps("PRODUCTION_CORE,LIVE_COMMERCE").COMMERCE_MODE,
    "disabled",
  );
  // Opening G8 relaxes none of the production rules.
  for (const [overrides, code] of [
    [{ COMMERCE_MODE: "fake" }, "COMMERCE_TEST_MODE_REFUSED"],
    [{ SMS_PROVIDER: "fake" }, "SMS_TEST_PROVIDER_REFUSED"],
    [{ BROWSER_ORIGIN: "http://localhost:3100" }, "PRODUCTION_ORIGIN_REQUIRED"],
    [
      { DATABASE_URL: "postgresql://postgres:x@db:5432/yarizan" },
      "PRODUCTION_RUNTIME_DATABASE_LOGIN_REQUIRED",
    ],
    [{ CODE_HMAC_KEY: "1".repeat(64) }, "PRODUCTION_SECRET_REQUIRED"],
  ] as const)
    assert.throws(
      () =>
        configuration({
          ...production,
          ENABLED_CAPABILITIES: "PRODUCTION_CORE",
          ...overrides,
        }),
      new RegExp(code),
    );
});

test("Production capability list: required, core first, known, approved and with open gates", () => {
  const resolve = (value: string | undefined, registry = allApproved) =>
    enabledCapabilities(value, true, registry, open);
  assert.throws(() => resolve(undefined), /ENABLED_CAPABILITIES_REQUIRED/);
  assert.throws(() => resolve("CUSTOMER_AUTH"), /CAPABILITY_REQUIRED/);
  assert.throws(() => resolve("PRODUCTION_CORE,FAKE"), /CAPABILITY_UNKNOWN/);
  assert.throws(
    () =>
      resolve("PRODUCTION_CORE,LIVE_COMMERCE", {
        ...capabilities,
        LIVE_COMMERCE: { ...capabilities.LIVE_COMMERCE, approved: false },
      }),
    /CAPABILITY_NOT_APPROVED: LIVE_COMMERCE/,
  );
  assert.throws(
    () =>
      enabledCapabilities(
        "PRODUCTION_CORE,ADMIN_AUTH",
        true,
        allApproved,
        (gate) => gate !== "G6_ADMIN_SMS_MFA",
      ),
    /CAPABILITY_GATE_CLOSED: ADMIN_AUTH: G6_ADMIN_SMS_MFA/,
  );
  assert.deepEqual(
    [...resolve("PRODUCTION_CORE,ADMIN_AUTH")],
    ["PRODUCTION_CORE", "ADMIN_AUTH"],
  );
  // Development and test default to every capability and may be narrowed.
  assert.equal(
    enabledCapabilities(undefined, false).size,
    capabilityIds.length,
  );
  assert.deepEqual(
    [...enabledCapabilities("PRODUCTION_CORE", false)],
    ["PRODUCTION_CORE"],
  );
  assert.throws(
    () =>
      configuration({
        ...process.env,
        ENABLED_CAPABILITIES: "production_core",
      }),
    /CONFIGURATION_INVALID/,
  );
});

test("Production refuses test fixtures, unenabled side effects, weak secrets and wrong logins", () => {
  assert.doesNotThrow(() => production());
  for (const [overrides, enabled, code] of [
    [
      { COMMERCE_MODE: "fake" },
      ["PRODUCTION_CORE", "LIVE_COMMERCE"],
      /COMMERCE_TEST_MODE_REFUSED/,
    ],
    [
      { COMMERCE_MODE: "zarinpal_sandbox" },
      undefined,
      /COMMERCE_TEST_MODE_REFUSED/,
    ],
    [{ COMMERCE_MODE: "zarinpal" }, undefined, /COMMERCE_MODE_REFUSED/],
    [
      { SMS_PROVIDER: "fake" },
      ["PRODUCTION_CORE", "ADMIN_AUTH"],
      /SMS_TEST_PROVIDER_REFUSED/,
    ],
    [
      { SMS_FAKE_OUTBOX: ".local/sms.jsonl" },
      undefined,
      /SMS_TEST_PROVIDER_REFUSED/,
    ],
    [{ SMS_PROVIDER: "melipayamak" }, undefined, /SMS_PROVIDER_REFUSED/],
    [
      { LICENSE_SIGNING_KEY_FILE: "/run/secrets/license.pem" },
      undefined,
      /LICENSE_SIGNING_REFUSED/,
    ],
    [
      { BROWSER_ORIGIN: "http://yarizan.oarnova.games" },
      undefined,
      /PRODUCTION_ORIGIN_REQUIRED/,
    ],
    [
      { BROWSER_ORIGIN: "https://localhost" },
      undefined,
      /PRODUCTION_ORIGIN_REQUIRED/,
    ],
    [
      { DATABASE_URL: "postgresql://postgres:x@db:5432/yarizan" },
      undefined,
      /PRODUCTION_RUNTIME_DATABASE_LOGIN_REQUIRED/,
    ],
    [
      { DATABASE_URL: "postgresql://yarizan_runtime:x@127.0.0.1:5432/yarizan" },
      undefined,
      /PRODUCTION_RUNTIME_DATABASE_LOGIN_REQUIRED/,
    ],
    [
      { CODE_HMAC_KEY: "1".repeat(64) },
      undefined,
      /PRODUCTION_SECRET_REQUIRED/,
    ],
    [
      { TOKEN_HMAC_KEY: "ab".repeat(32) },
      undefined,
      /PRODUCTION_SECRET_REQUIRED/,
    ],
    [
      { OTP_HMAC_KEY: "a1".repeat(32) },
      undefined,
      /PRODUCTION_SECRET_REQUIRED/,
    ],
  ] as [Record<string, string>, CapabilityId[] | undefined, RegExp][])
    assert.throws(() => production(overrides, enabled), code);
  assert.ok(highEntropyHex(key()));
});

test("Every route declares its capabilities; nothing is served by default", () => {
  const controllers = [
    ...Object.values(api).filter(
      (value): value is (typeof api)["HealthController"] =>
        typeof value === "function" && value.name.endsWith("Controller"),
    ),
    CommerceController,
  ];
  let routes = 0;
  for (const Type of controllers) {
    const declared = Reflect.getMetadata("yarizan:capabilities", Type) as
      CapabilityId[] | undefined;
    for (const name of Object.getOwnPropertyNames(Type.prototype)) {
      const handler = (Type.prototype as unknown as Record<string, unknown>)[
        name
      ];
      if (typeof handler !== "function") continue;
      if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
      routes++;
      const ids =
        (Reflect.getMetadata("yarizan:capabilities", handler) as
          CapabilityId[] | undefined) ?? declared;
      assert.ok(ids?.length, `${Type.name}.${name} declares no capability`);
      for (const id of ids) assert.ok(capabilityIds.includes(id));
    }
  }
  assert.ok(routes > 80, `only ${routes} routes inspected`);
});
