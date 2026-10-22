import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { readdirSync } from "node:fs";
import {
  configuration,
  closedProductionGates,
  migrationConfiguration,
  productionGates,
} from "../src/config";
import {
  migrationFilePattern,
  SCHEMA_MIGRATION_COUNT,
} from "../src/database/schema-version";
import {
  canonical,
  Signing,
  DevelopmentKeyManager,
  profiles,
  devicePublicKey,
} from "../src/signing/signing";
import { strictJson } from "../src/common/strict-json";
import {
  activationCode,
  normalizeCode,
  seal,
  unseal,
  totp,
} from "../src/security/crypto";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test";
for (const [key, value] of [
  ["CODE_HMAC_KEY", "1"],
  ["TOKEN_HMAC_KEY", "2"],
  ["MFA_ENCRYPTION_KEY", "3"],
])
  process.env[key] ??= value.repeat(64);
test("Committed deterministic license message bytes match canonical profile", () => {
  const v = JSON.parse(
    readFileSync("test/vectors/license-message.json", "utf8"),
  ) as {
    payload: Record<string, unknown>;
    message: string;
    message_hex: string;
  };
  assert.equal(profiles.license.domain + canonical(v.payload), v.message);
  assert.equal(
    Buffer.from(v.message).toString("hex").toUpperCase(),
    v.message_hex,
  );
});

test("Production gate cannot be enabled by environment flag", () =>
  assert.throws(
    () =>
      configuration({
        ...process.env,
        NODE_ENV: "production",
        PRODUCTION_READY: "true",
      }),
    /PRODUCTION_GATE_CLOSED/,
  ));

test("Every production gate is closed in source and named in the refusal", () => {
  assert.ok(productionGates.length >= 6);
  assert.equal(closedProductionGates().length, productionGates.length);
  for (const env of [
    { PRODUCTION_READY: "true" },
    { PRODUCTION_GATES: "open" },
    { G1_SIGNING_CUSTODY: "open" },
    { SMS_PROVIDER: "disabled", COMMERCE_MODE: "disabled" },
  ])
    assert.throws(
      () => configuration({ ...process.env, NODE_ENV: "production", ...env }),
      (error: Error) =>
        productionGates.every((gate) => error.message.includes(gate.id)) &&
        error.message.startsWith("PRODUCTION_GATE_CLOSED: "),
    );
});
test("Release migration count matches the reviewed migration directory", () => {
  assert.equal(
    readdirSync("migrations").filter((f) => migrationFilePattern.test(f))
      .length,
    SCHEMA_MIGRATION_COUNT,
  );
  assert.equal(SCHEMA_MIGRATION_COUNT, 13);
});
test("Migration configuration requires a separate production migration login", () => {
  const runtime = "postgresql://yarizan_api:x@db:5432/yarizan";
  const owner = "postgresql://yarizan_migrator:y@db:5432/yarizan";
  assert.throws(
    () =>
      migrationConfiguration({ NODE_ENV: "production", DATABASE_URL: runtime }),
    /MIGRATION_DATABASE_URL_REQUIRED/,
  );
  assert.throws(
    () =>
      migrationConfiguration({
        NODE_ENV: "production",
        DATABASE_URL: runtime,
        MIGRATION_DATABASE_URL: runtime,
      }),
    /INDEPENDENT_DATABASE_CREDENTIALS_REQUIRED/,
  );
  assert.throws(
    () =>
      migrationConfiguration({
        NODE_ENV: "production",
        MIGRATION_DATABASE_URL: "postgresql://m:y@remote.invalid/live",
      }),
    /DISPOSABLE_LOCAL_DATABASE_REQUIRED/,
  );
  assert.throws(() => migrationConfiguration({}), /NODE_ENV_REQUIRED/);
  assert.throws(
    () => migrationConfiguration({ NODE_ENV: "staging", DATABASE_URL: owner }),
    /NODE_ENV_INVALID/,
  );
  assert.equal(
    migrationConfiguration({
      NODE_ENV: "production",
      DATABASE_URL: runtime,
      MIGRATION_DATABASE_URL: owner,
    }).url,
    owner,
  );
  // No HMAC, encryption or provider keys are needed to migrate.
  assert.equal(
    migrationConfiguration({ NODE_ENV: "test", DATABASE_URL: owner }).url,
    owner,
  );
});
test("Runtime environment must be explicit and exact", () => {
  for (const value of [undefined, ""])
    assert.throws(
      () => configuration({ ...process.env, NODE_ENV: value }),
      /NODE_ENV_REQUIRED/,
    );
  for (const value of ["staging", "PRODUCTION", " development", "test "])
    assert.throws(
      () => configuration({ ...process.env, NODE_ENV: value }),
      /NODE_ENV_INVALID/,
    );
  for (const value of ["development", "test"])
    assert.equal(
      configuration({ ...process.env, NODE_ENV: value }).NODE_ENV,
      value,
    );
});
test("Remote database refused", () =>
  assert.throws(
    () =>
      configuration({
        ...process.env,
        DATABASE_URL: "postgresql://someone:secret@remote.invalid/live",
      }),
    /DISPOSABLE_LOCAL_DATABASE_REQUIRED/,
  ));
test("Missing signing-related secrets fail startup", () =>
  assert.throws(
    () => configuration({ ...process.env, CODE_HMAC_KEY: "" }),
    /CONFIGURATION_INVALID/,
  ));
test("Independent secret keys required", () =>
  assert.throws(
    () =>
      configuration({
        ...process.env,
        TOKEN_HMAC_KEY: process.env.CODE_HMAC_KEY,
      }),
    /INDEPENDENT_SECRETS_REQUIRED/,
  ));
for (const value of [
  '{"x":1,"x":2}',
  '{"x":1e2}',
  '{"x":1.0}',
  '{"x":9007199254740992}',
  '{"x":"\\ud800"}',
  '{"x":true} false',
  JSON.stringify({ x: "x".repeat(32768) }),
])
  test("Strict JSON rejects " + value.slice(0, 25), () =>
    assert.throws(() => strictJson(value)),
  );
test("UTF16 sorted canonical Unicode/control bytes", () =>
  assert.equal(
    canonical(
      strictJson(
        '{"z":"یاریزان\\u000f\\n😀\u2028","a":1,"arr":[true,null,"/\\\\\\\""]}',
      ),
    ),
    '{"a":1,"arr":[true,null,"/\\\\\\\""],"z":"یاریزان\\u000f\\n😀\u2028"}',
  ));
test("Depth bounded", () =>
  assert.throws(() => strictJson("[".repeat(10) + "0" + "]".repeat(10))));
test("No negative zero canonical ambiguity", () =>
  assert.equal(canonical(strictJson('{"n":-0}')), '{"n":0}'));
test("160-bit activation codes use exact Crockford groups", () => {
  const codes = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const code = activationCode();
    assert.match(
      code,
      /^YZ2-(?:[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}-){7}[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/,
    );
    assert.equal(normalizeCode(code.toLowerCase()), code);
    codes.add(code);
  }
  assert.equal(codes.size, 1000);
});
for (const code of [
  "YZ2-" + "I".repeat(32),
  "YZ2-" + "O".repeat(32),
  "YZ2-" + "U".repeat(32),
  "YZ2-" + "А".repeat(32),
  "legacy-code",
  "x".repeat(65),
])
  test("Invalid code rejected " + code.slice(0, 12), () =>
    assert.throws(() => normalizeCode(code)),
  );
test("MFA RFC6238 vector SHA1 at 59 seconds", () =>
  assert.equal(
    totp(Buffer.from("12345678901234567890").toString("hex"), 1),
    "287082",
  ));
test("MFA encrypted at rest and authenticated", () => {
  const key = "1".repeat(64),
    c = seal("synthetic-mfa-secret", key);
  assert.equal(unseal(c, key), "synthetic-mfa-secret");
  assert.throws(() => unseal(c, "2".repeat(64)));
});
test("Signer uses exact P256/P1363 domain", () => {
  const keys = new DevelopmentKeyManager(),
    s = new Signing(keys);
  const a = s.artifact("license", {
    license_id: "10000000-0000-4000-8000-000000000001",
    customer_id: "20000000-0000-4000-8000-000000000001",
    device_id: "30000000-0000-4000-8000-000000000001",
    sku: "YARIZAN-G1",
    grade: 1,
    device_fingerprint_version: 2,
    device_fingerprint_digest: "A".repeat(64),
    expires_at: null,
    license_revision: 1,
  });
  assert.equal(Buffer.from(a.signature, "base64url").length, 64);
  assert.equal(
    verify(
      "sha256",
      Buffer.from(profiles.license.domain + canonical(a.payload)),
      { key: keys.publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(a.signature, "base64url"),
    ),
    true,
  );
  assert.equal(
    verify(
      "sha256",
      Buffer.from(profiles.trial.domain + canonical(a.payload)),
      { key: keys.publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(a.signature, "base64url"),
    ),
    false,
  );
});
test("Public-key curve and SPKI normalization strict", () => {
  const p = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
  assert.throws(() =>
    devicePublicKey(
      p.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
    ),
  );
  const k = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const d = k.publicKey.export({ type: "spki", format: "der" });
  assert.throws(() =>
    devicePublicKey(Buffer.concat([d, Buffer.from([0])]).toString("base64url")),
  );
  assert.equal(
    sign("sha256", Buffer.from("probe"), {
      key: k.privateKey,
      dsaEncoding: "ieee-p1363",
    }).length,
    64,
  );
});
