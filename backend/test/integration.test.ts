import "reflect-metadata";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  randomUUID,
  randomBytes,
  generateKeyPairSync,
  KeyObject,
  sign,
} from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { Outbox } from "../src/outbox/outbox";
import { Audit } from "../src/audit/audit";
import { Admin } from "../src/admin/admin";
import { Trials } from "../src/trials/trials";
import { PasswordHashing } from "../src/security/passwords";
import { ApiError } from "../src/common/errors";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { hash as passwordHash } from "argon2";
import { createApp } from "../src/main";
import { Database } from "../src/database/database";
import { migrate } from "../src/database/migrate";
import { seed } from "../src/database/seed";
import { Signing, Envelope, canonical, profiles } from "../src/signing/signing";
import { Security } from "../src/security/security";
import { seal, totp, hash } from "../src/security/crypto";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test";
for (const [key, value] of [
  ["CODE_HMAC_KEY", "1"],
  ["TOKEN_HMAC_KEY", "2"],
  ["MFA_ENCRYPTION_KEY", "3"],
])
  process.env[key] ??= value.repeat(64);
const origin = "http://localhost:3100";
process.env.BROWSER_ORIGIN = origin;
let app: Awaited<ReturnType<typeof createApp>>,
  db: Database,
  security: Security,
  signing: Signing,
  base: string;
type Browser = { cookie: string; csrf: string };
type Enrolled = {
  device_id: string;
  customer_id: string;
  username: string;
  enrollment: Envelope;
  credential: string;
};
type Candidate = {
  privateKey: KeyObject;
  publicKey: string;
  fingerprint: string;
};
type ErrorBody = { error: { code: string } };
type Trial = { grant: Envelope; remaining: number; server_time: string };
const candidate = (fingerprint = hash(randomBytes(32))): Candidate => {
  const p = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    privateKey: p.privateKey,
    publicKey: p.publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64url"),
    fingerprint,
  };
};
const mutation = (expected_revision = 1) => ({
  request_id: randomUUID(),
  reason: "Synthetic independently reviewed test operation",
  expected_revision,
  evidence_ref: "synthetic-ownership-verification-001",
});
async function request<T = Record<string, unknown>>(
  route: string,
  body?: unknown,
  auth?: Browser | string,
  method = body === undefined ? "GET" : "POST",
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Origin: origin,
  };
  if (typeof auth === "string") headers.Authorization = "Bearer " + auth;
  else if (auth) {
    headers.Cookie = auth.cookie;
    headers["X-CSRF-Token"] = auth.csrf;
  }
  const r = await fetch(base + route, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json()) as T, headers: r.headers };
}
async function ok<T = Record<string, unknown>>(
  route: string,
  body?: unknown,
  auth?: Browser | string,
  method?: string,
) {
  const r = await request<T>(route, body, auth, method);
  assert.ok(r.status < 300, `${route}: ${r.status} ${JSON.stringify(r.body)}`);
  return r;
}
async function denied(
  route: string,
  body: unknown,
  code: string,
  auth?: Browser | string,
  method?: string,
) {
  const r = await request<ErrorBody>(route, body, auth, method);
  assert.ok(r.status >= 400, route);
  assert.equal(r.body.error.code, code);
  return r;
}
async function proof(
  key: Candidate,
  purpose: "PAIR" | "AUTH" | "CONFIRM",
  pairing_id?: string,
) {
  const fields = {
    fingerprint_version: 2 as const,
    fingerprint_digest: key.fingerprint,
    device_public_key: key.publicKey,
  };
  const c = (
    await ok<{ challenge_id: string; nonce: string }>("/devices/challenges", {
      ...fields,
      purpose,
      ...(pairing_id ? { pairing_id } : {}),
    })
  ).body;
  const transcript = {
    ...fields,
    challenge_id: c.challenge_id,
    nonce: c.nonce,
  };
  return {
    ...fields,
    challenge_id: c.challenge_id,
    challenge_signature: sign(
      "sha256",
      Buffer.from("YariZan-Device-Challenge-V2\n" + canonical(transcript)),
      { key: key.privateKey, dsaEncoding: "ieee-p1363" },
    ).toString("base64url"),
  };
}
async function paired(key: Candidate) {
  const p = (
    await ok<{ pairing_id: string; pairing_secret: string }>(
      "/device-pairings",
      await proof(key, "PAIR"),
    )
  ).body;
  return {
    pairing_id: p.pairing_id,
    pairing_secret: p.pairing_secret,
    password: "Synthetic!Password12345",
  };
}
async function enroll(key: Candidate, owner?: Browser) {
  const p = await paired(key);
  await ok("/auth/claim", p, owner);
  return (
    await ok<Enrolled>(
      `/device-pairings/${p.pairing_id}/pickup`,
      await proof(key, "CONFIRM", p.pairing_id),
    )
  ).body;
}
async function login(
  e: Enrolled,
  password = "Synthetic!Password12345",
): Promise<Browser> {
  const r = await ok<{ csrf_token: string }>("/auth/login", {
    username: e.username,
    password,
  });
  return {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    csrf: r.body.csrf_token,
  };
}
async function adminLogin(role = "owner"): Promise<Browser> {
  const secret = randomBytes(20).toString("hex"),
    id = randomUUID(),
    username = "test-admin-" + id;
  await db.query(
    "INSERT INTO admins(id,username,password_hash,mfa_ciphertext) VALUES($1,$2,$3,$4)",
    [
      id,
      username,
      await passwordHash("Synthetic!Admin123456", {
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
      seal(secret, process.env.MFA_ENCRYPTION_KEY!),
    ],
  );
  await db.query("INSERT INTO admin_user_roles VALUES($1,$2)", [id, role]);
  const r = await ok<{ csrf_token: string }>("/admin/auth/login", {
    username,
    password: "Synthetic!Admin123456",
    mfa_code: totp(secret, Math.floor(Date.now() / 30000)),
  });
  return {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    csrf: r.body.csrf_token,
  };
}
let primary: Enrolled,
  primaryKey: Candidate,
  owner: Browser,
  admin: Browser,
  firstTrial: Trial,
  paid: Envelope,
  active: Envelope,
  revoked: Envelope;
before(async () => {
  const u = new URL(process.env.DATABASE_URL!);
  assert.equal(
    u.pathname,
    "/yarizan_phase2_test",
    "Tests only touch explicitly named disposable database",
  );
  const p = new Pool({ connectionString: new URL("/postgres", u).toString() });
  const found = await p.query(
    "SELECT 1 FROM pg_database WHERE datname='yarizan_phase2_test'",
  );
  if (!found.rowCount) await p.query("CREATE DATABASE yarizan_phase2_test");
  await p.end();
  db = new Database();
  await db.query("DROP SCHEMA public CASCADE");
  await db.query("CREATE SCHEMA public");
  await migrate(db);
  await seed(db);
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as { port: number };
  base = `http://127.0.0.1:${address.port}/api/v2`;
  security = app.get(Security);
  signing = app.get(Signing);
  primaryKey = candidate();
  primary = await enroll(primaryKey);
  owner = await login(primary);
  admin = await adminLogin();
});
after(async () => {
  await app?.close();
  await db?.onModuleDestroy();
});

test("Actual PostgreSQL 17 and six exact products/prices", async () => {
  assert.match(
    (await db.query("SELECT version()")).rows[0].version,
    /PostgreSQL 17/,
  );
  const r = (await ok<Record<string, unknown>[]>("/products")).body;
  assert.equal(r.length, 6);
  assert.ok(r.every((p) => p.price_irr === 12990000));
  assert.equal(r[0].sale_enabled, true);
  assert.ok(
    r
      .slice(1)
      .every(
        (p) => !p.sale_enabled && !p.activation_enabled && !p.trial_enabled,
      ),
  );
});
test("Seeds idempotent and preserve edited catalog", async () => {
  await seed(db);
  assert.equal(
    (await db.query("SELECT count(*) FROM products")).rows[0].count,
    "6",
  );
});
test("Migration replay and hash drift detection", async () => {
  await migrate(db);
  const old = (
    await db.query<{ hash: string }>(
      "SELECT hash FROM schema_migrations WHERE name='001_core.sql'",
    )
  ).rows[0].hash;
  await db.query(
    "UPDATE schema_migrations SET hash='tampered' WHERE name='001_core.sql'",
  );
  await assert.rejects(migrate(db), /MIGRATION_HASH_DRIFT/);
  await db.query(
    "UPDATE schema_migrations SET hash=$1 WHERE name='001_core.sql'",
    [old],
  );
});
test("Enrollment binds exact UUID/key/fingerprint", () => {
  assert.equal(primary.enrollment.payload.device_id, primary.device_id);
  assert.equal(
    primary.enrollment.payload.device_key_digest,
    hash(Buffer.from(primaryKey.publicKey, "base64url")),
  );
  assert.equal(
    primary.enrollment.payload.device_fingerprint_digest,
    primaryKey.fingerprint,
  );
});
test("Wrong signature cannot create pairing", async () => {
  const p = await proof(candidate(), "PAIR");
  p.challenge_signature = randomBytes(64).toString("base64url");
  await denied("/device-pairings", p, "INVALID_PROOF");
});
test("Wrong public key cannot use challenge", async () => {
  const p = await proof(candidate(), "PAIR");
  p.device_public_key = candidate().publicKey;
  await denied("/device-pairings", p, "INVALID_PROOF");
});
test("Challenge replay rejected", async () => {
  const p = await proof(candidate(), "PAIR");
  await ok("/device-pairings", p);
  await denied("/device-pairings", p, "CHALLENGE_INVALID");
});
test("Expired challenge rejected", async () => {
  const p = await proof(candidate(), "PAIR");
  await db.query(
    "UPDATE device_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
    [p.challenge_id],
  );
  await denied("/device-pairings", p, "CHALLENGE_INVALID");
});
test("First claim requires both browser and desktop confirmation", async () => {
  const p = (
    await ok<{ pairing_id: string }>(
      "/device-pairings",
      await proof(candidate(), "PAIR"),
    )
  ).body;
  await denied(
    "/auth/claim",
    {
      pairing_id: p.pairing_id,
      pairing_secret: randomBytes(32).toString("base64url"),
      password: "Synthetic!Password12345",
    },
    "PAIRING_INVALID",
  );
});
test("Claim grant replay rejected", async () => {
  const b = await paired(candidate());
  await ok("/auth/claim", b);
  await denied("/auth/claim", b, "PAIRING_INVALID");
});
test("Concurrent competing first claims create one active owner", async () => {
  const fingerprint = hash(randomBytes(32));
  const a = await paired(candidate(fingerprint));
  const b = await paired(candidate(fingerprint));
  const r = await Promise.all([
    request<ErrorBody>("/auth/claim", a),
    request<ErrorBody>("/auth/claim", b),
  ]);
  assert.equal(r.filter((x) => x.status < 300).length, 1);
  assert.equal(r.filter((x) => x.status === 403).length, 1);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM customers c JOIN devices d ON d.id=c.device_id WHERE d.fingerprint_digest=$1 AND c.state='ACTIVE'",
        [fingerprint],
      )
    ).rows[0].count,
    "1",
  );
});
test("Spoofed known fingerprint cannot enroll without owner approval", async () => {
  await denied(
    "/auth/claim",
    await paired(candidate(primaryKey.fingerprint)),
    "PROFILE_NOT_AUTHORIZED",
  );
});
test("Wrong customer cannot approve another machine profile", async () => {
  const other = await enroll(candidate());
  const browser = await login(other);
  const p = (
    await ok<{ pairing_id: string; pairing_secret: string }>(
      "/device-pairings",
      await proof(candidate(primaryKey.fingerprint), "PAIR"),
    )
  ).body;
  await denied(
    `/device-pairings/${p.pairing_id}/confirm`,
    { pairing_secret: p.pairing_secret },
    "PROFILE_NOT_AUTHORIZED",
    browser,
  );
});
let additional: Enrolled;
test("Authorized Windows profile shares machine/customer/generation", async () => {
  additional = await enroll(candidate(primaryKey.fingerprint), owner);
  assert.equal(additional.device_id, primary.device_id);
  assert.equal(additional.customer_id, primary.customer_id);
  assert.notEqual(
    additional.enrollment.payload.profile_enrollment_id,
    primary.enrollment.payload.profile_enrollment_id,
  );
});
test("Valid proof rotates short-lived enrolled bearer", async () => {
  const r = (
    await ok<{ device_id: string; credential: string }>(
      "/devices/authenticate",
      await proof(primaryKey, "AUTH"),
    )
  ).body;
  assert.equal(r.device_id, primary.device_id);
  assert.equal(r.credential.length, 43);
});
test("Forged bearer rejected", async () => {
  await denied(
    "/desktop/trials/YARIZAN-G1/status",
    undefined,
    "ENROLLMENT_REQUIRED",
    randomBytes(32).toString("base64url"),
  );
});
test("Wrong password and unknown username have same public error", async () => {
  await denied(
    "/auth/login",
    { username: primary.username, password: "wrong" },
    "INVALID_CREDENTIALS",
  );
  await denied(
    "/auth/login",
    { username: "YZ-unknown", password: "wrong" },
    "INVALID_CREDENTIALS",
  );
});
test("CSRF missing token rejected", async () => {
  await denied("/auth/session/rotate", {}, "CSRF_REJECTED", {
    ...owner,
    csrf: "",
  });
});
test("Session rotation invalidates old session", async () => {
  const browser = await login(primary);
  const r = await ok<{ csrf_token: string }>(
    "/auth/session/rotate",
    {},
    browser,
  );
  await denied("/account", undefined, "UNAUTHENTICATED", browser);
  const next = {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    csrf: r.body.csrf_token,
  };
  await ok("/account", undefined, next);
  await ok("/auth/logout", {}, next);
  await denied("/account", undefined, "UNAUTHENTICATED", next);
});
test("Login per-account rate limit", async () => {
  for (let i = 0; i < 8; i++)
    await denied(
      "/auth/login",
      { username: "rate-test-user", password: "wrong" },
      "INVALID_CREDENTIALS",
    );
  await denied(
    "/auth/login",
    { username: "rate-test-user", password: "wrong" },
    "RATE_LIMITED",
  );
});
test("Status reads consume no entries", async () => {
  for (let i = 0; i < 3; i++)
    assert.equal(
      (
        await ok(
          "/desktop/trials/YARIZAN-G1/status",
          undefined,
          primary.credential,
        )
      ).body.remaining,
      2,
    );
  assert.equal(
    (await db.query("SELECT count(*) FROM trial_starts")).rows[0].count,
    "0",
  );
});
let firstRequest: {
  device_id: string;
  client_nonce: string;
  client_process_session_id: string;
};
test("First trial consumes exactly one and no expiry field", async () => {
  firstRequest = {
    device_id: primary.device_id,
    client_nonce: hash(randomBytes(32)),
    client_process_session_id: randomUUID(),
  };
  firstTrial = (
    await ok<Trial>(
      "/desktop/trials/YARIZAN-G1/start",
      firstRequest,
      primary.credential,
    )
  ).body;
  assert.equal(firstTrial.remaining, 1);
  assert.ok(!("expires_at" in firstTrial.grant.payload));
});
test("Identical nonce returns byte-identical signed result across profile", async () => {
  const retry = (
    await ok<Trial>(
      "/desktop/trials/YARIZAN-G1/start",
      firstRequest,
      additional.credential,
    )
  ).body;
  assert.deepEqual(retry, firstTrial);
});
test("Changed process under same nonce rejected", async () => {
  await denied(
    "/desktop/trials/YARIZAN-G1/start",
    { ...firstRequest, client_process_session_id: randomUUID() },
    "IDEMPOTENCY_MISMATCH",
    primary.credential,
  );
});
test("Second profile spends shared last entry; third refused", async () => {
  const b = {
    ...firstRequest,
    client_nonce: hash(randomBytes(32)),
    client_process_session_id: randomUUID(),
  };
  assert.equal(
    (
      await ok<Trial>(
        "/desktop/trials/YARIZAN-G1/start",
        b,
        additional.credential,
      )
    ).body.remaining,
    0,
  );
  await denied(
    "/desktop/trials/YARIZAN-G1/start",
    { ...b, client_nonce: hash(randomBytes(32)) },
    "TRIAL_EXHAUSTED",
    primary.credential,
  );
  assert.equal(
    (
      await ok(
        "/desktop/trials/YARIZAN-G1/status",
        undefined,
        primary.credential,
      )
    ).body.remaining,
    0,
  );
});
test("20 parallel PostgreSQL trial starts never exceed two", async () => {
  const e = await enroll(candidate());
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      request<ErrorBody>(
        "/desktop/trials/YARIZAN-G1/start",
        {
          device_id: e.device_id,
          client_nonce: hash(randomBytes(32)),
          client_process_session_id: randomUUID(),
        },
        e.credential,
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status < 300).length, 2);
  assert.ok(
    results
      .filter((r) => r.status >= 400)
      .every((r) => r.body.error.code === "TRIAL_EXHAUSTED"),
  );
  assert.equal(
    (
      await db.query("SELECT used FROM trial_counters WHERE device_id=$1", [
        e.device_id,
      ])
    ).rows[0].used,
    2,
  );
});
test("20 parallel identical nonce requests return one persisted result", async () => {
  const e = await enroll(candidate()),
    b = {
      device_id: e.device_id,
      client_nonce: hash(randomBytes(32)),
      client_process_session_id: randomUUID(),
    };
  const r = await Promise.all(
    Array.from({ length: 20 }, () =>
      ok<Trial>("/desktop/trials/YARIZAN-G1/start", b, e.credential),
    ),
  );
  assert.ok(
    r.every((x) => JSON.stringify(x.body) === JSON.stringify(r[0].body)),
  );
  assert.equal(
    (
      await db.query("SELECT count(*) FROM trial_starts WHERE device_id=$1", [
        e.device_id,
      ])
    ).rows[0].count,
    "1",
  );
});
test("Coming Soon trial and entitlement protected", async () => {
  await denied(
    "/desktop/trials/YARIZAN-G2/status",
    undefined,
    "PRODUCT_NOT_AVAILABLE",
    primary.credential,
  );
  await denied(
    "/admin/licenses/issue",
    { ...mutation(), device_id: primary.device_id, sku: "YARIZAN-G2" },
    "PRODUCT_NOT_AVAILABLE",
    admin,
  );
});
test("Admin enables G2; independent budget, integer IRR price and seed preserves changes", async () => {
  await ok(
    "/admin/products/YARIZAN-G2",
    {
      ...mutation(),
      price_irr: 13000000,
      publication_status: "published",
      sale_enabled: true,
      trial_enabled: true,
      activation_enabled: true,
    },
    admin,
    "PATCH",
  );
  await seed(db);
  assert.equal((await ok("/products/YARIZAN-G2")).body.price_irr, 13000000);
  assert.equal(
    (
      await ok(
        "/desktop/trials/YARIZAN-G2/status",
        undefined,
        primary.credential,
      )
    ).body.remaining,
    2,
  );
});
test("Admin manual entitlement issues product/device perpetual license", async () => {
  paid = (
    await ok<Envelope>(
      "/admin/licenses/issue",
      { ...mutation(), device_id: primary.device_id, sku: "YARIZAN-G1" },
      admin,
    )
  ).body;
  assert.equal(paid.payload.expires_at, null);
  assert.equal(paid.payload.device_id, primary.device_id);
  assert.equal(paid.payload.sku, "YARIZAN-G1");
});
test("Duplicate pickup and additional profile return original perpetual artifact", async () => {
  const a = (
    await ok<Envelope>(
      "/desktop/licenses/pickup",
      { sku: "YARIZAN-G1" },
      primary.credential,
    )
  ).body;
  const b = (
    await ok<Envelope>(
      "/desktop/licenses/pickup",
      { sku: "YARIZAN-G1" },
      additional.credential,
    )
  ).body;
  assert.deepEqual(a, paid);
  assert.deepEqual(b, paid);
  assert.equal(
    (
      await db.query("SELECT count(*) FROM licenses WHERE device_id=$1", [
        primary.device_id,
      ])
    ).rows[0].count,
    "1",
  );
});
test("No G1 entitlement for G2", async () => {
  await denied(
    "/desktop/licenses/pickup",
    { sku: "YARIZAN-G2" },
    "ENTITLEMENT_REQUIRED",
    primary.credential,
  );
});
test("Existing entitlement survives new activation/sales disable", async () => {
  await ok(
    "/admin/products/YARIZAN-G1",
    {
      ...mutation(),
      price_irr: 12990000,
      publication_status: "published",
      sale_enabled: false,
      trial_enabled: true,
      activation_enabled: false,
    },
    admin,
    "PATCH",
  );
  assert.deepEqual(
    (
      await ok<Envelope>(
        "/desktop/licenses/pickup",
        { sku: "YARIZAN-G1" },
        primary.credential,
      )
    ).body,
    paid,
  );
  await ok(
    "/admin/products/YARIZAN-G1",
    {
      ...mutation(2),
      price_irr: 12990000,
      publication_status: "published",
      sale_enabled: true,
      trial_enabled: true,
      activation_enabled: true,
    },
    admin,
    "PATCH",
  );
});
test("Sync ACTIVE signed decision, foreign license hidden", async () => {
  active = (
    await ok<Envelope>(
      "/desktop/licenses/sync",
      { license_id: paid.payload.license_id, sku: "YARIZAN-G1" },
      primary.credential,
    )
  ).body;
  assert.equal(active.payload.status, "ACTIVE");
  const stranger = await enroll(candidate());
  await denied(
    "/desktop/licenses/sync",
    { license_id: paid.payload.license_id, sku: "YARIZAN-G1" },
    "LICENSE_NOT_FOUND",
    stranger.credential,
  );
});
test("Revocation monotonic and stale Admin revision refused", async () => {
  revoked = (
    await ok<Envelope>(
      `/admin/licenses/${paid.payload.license_id}/revoke`,
      mutation(),
      admin,
    )
  ).body;
  assert.equal(revoked.payload.status, "REVOKED");
  assert.equal(revoked.payload.decision_version, 2);
  await denied(
    `/admin/licenses/${paid.payload.license_id}/revoke`,
    mutation(),
    "STALE_REVISION",
    admin,
  );
  assert.deepEqual(
    (
      await ok<Envelope>(
        "/desktop/licenses/sync",
        { license_id: paid.payload.license_id, sku: "YARIZAN-G1" },
        primary.credential,
      )
    ).body,
    revoked,
  );
});
test("Ownership-reviewed same-ID recovery does not reset trial", async () => {
  const recovered = (
    await ok<Envelope>(
      `/admin/licenses/${paid.payload.license_id}/reissue`,
      mutation(2),
      admin,
    )
  ).body;
  assert.equal(recovered.payload.license_id, paid.payload.license_id);
  assert.equal(recovered.payload.decision_version, 3);
  assert.equal(recovered.payload.status, "ACTIVE");
  assert.equal(
    (
      await ok(
        "/desktop/trials/YARIZAN-G1/status",
        undefined,
        primary.credential,
      )
    ).body.remaining,
    0,
  );
});
test("Arbitrary cross-ID recovery endpoint remains absent", async () => {
  await denied(
    "/desktop/licenses/recover",
    {},
    "NOT_FOUND",
    primary.credential,
  );
});

async function issueCode(e: Enrolled, sku = "YARIZAN-G1") {
  return (
    await ok<{ activation_code: string; code_id: string }>(
      "/admin/activation-codes",
      {
        ...mutation(),
        device_id: e.device_id,
        sku,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      admin,
    )
  ).body;
}
test("Code verifier stored with version; plaintext absent from DB/audit", async () => {
  const e = await enroll(candidate()),
    code = await issueCode(e);
  const row = (
    await db.query("SELECT * FROM activation_codes WHERE id=$1", [code.code_id])
  ).rows[0];
  assert.equal(row.key_version, "v1");
  assert.match(row.verifier, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes(code.activation_code));
  assert.ok(
    !JSON.stringify((await db.query("SELECT * FROM audit_logs")).rows).includes(
      code.activation_code,
    ),
  );
  assert.ok(
    !JSON.stringify(
      (await db.query("SELECT * FROM admin_operations")).rows,
    ).includes(code.activation_code),
  );
});
test("Identical issuance retry never retrieves plaintext twice", async () => {
  const e = await enroll(candidate()),
    b = {
      ...mutation(),
      device_id: e.device_id,
      sku: "YARIZAN-G1",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };
  const first = (await ok("/admin/activation-codes", b, admin)).body;
  const retry = (await ok("/admin/activation-codes", b, admin)).body;
  assert.equal(retry.code_id, first.code_id);
  assert.equal(retry.activation_code, undefined);
  assert.equal(retry.secret_already_delivered, true);
});
test("20 parallel code redemptions consume once; identical retry original", async () => {
  const e = await enroll(candidate()),
    code = await issueCode(e),
    b = {
      device_id: e.device_id,
      sku: "YARIZAN-G1",
      activation_code: code.activation_code,
      request_id: randomUUID(),
    };
  const r = await Promise.all(
    Array.from({ length: 20 }, () =>
      request<Envelope & ErrorBody>(
        "/desktop/activation-codes/redeem",
        { ...b, request_id: randomUUID() },
        e.credential,
      ),
    ),
  );
  assert.equal(r.filter((x) => x.status < 300).length, 1);
  assert.ok(
    r
      .filter((x) => x.status >= 400)
      .every((x) => x.body.error.code === "ACTIVATION_CODE_USED"),
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM activation_redemptions WHERE code_id=$1",
        [code.code_id],
      )
    ).rows[0].count,
    "1",
  );
});
test("Identical successful code request returns original; modified request rejected", async () => {
  const e = await enroll(candidate()),
    code = await issueCode(e),
    b = {
      device_id: e.device_id,
      sku: "YARIZAN-G1",
      activation_code: code.activation_code,
      request_id: randomUUID(),
    };
  const a = (
    await ok<Envelope>("/desktop/activation-codes/redeem", b, e.credential)
  ).body;
  assert.deepEqual(
    (await ok<Envelope>("/desktop/activation-codes/redeem", b, e.credential))
      .body,
    a,
  );
  await denied(
    "/desktop/activation-codes/redeem",
    { ...b, activation_code: "YZ2-" + Array(8).fill("AAAA").join("-") },
    "IDEMPOTENCY_MISMATCH",
    e.credential,
  );
});
test("Wrong SKU/device denied before consumption", async () => {
  const e = await enroll(candidate()),
    code = await issueCode(e),
    b = {
      device_id: e.device_id,
      sku: "YARIZAN-G2",
      activation_code: code.activation_code,
      request_id: randomUUID(),
    };
  await denied(
    "/desktop/activation-codes/redeem",
    b,
    "ACTIVATION_CODE_INVALID",
    e.credential,
  );
  await denied(
    "/desktop/activation-codes/redeem",
    { ...b, sku: "YARIZAN-G1", device_id: primary.device_id },
    "DEVICE_MISMATCH",
    e.credential,
  );
});
test("Expired and cancelled codes rejected", async () => {
  const e = await enroll(candidate()),
    expired = await issueCode(e);
  await db.query(
    "UPDATE activation_codes SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.code_id],
  );
  const b = {
    device_id: e.device_id,
    sku: "YARIZAN-G1",
    request_id: randomUUID(),
    activation_code: expired.activation_code,
  };
  await denied(
    "/desktop/activation-codes/redeem",
    b,
    "ACTIVATION_CODE_EXPIRED",
    e.credential,
  );
  const cancelled = await issueCode(e);
  await ok(
    `/admin/activation-codes/${cancelled.code_id}/cancel`,
    mutation(),
    admin,
  );
  await denied(
    "/desktop/activation-codes/redeem",
    {
      ...b,
      request_id: randomUUID(),
      activation_code: cancelled.activation_code,
    },
    "ACTIVATION_CODE_CANCELLED",
    e.credential,
  );
});
test("Revoked cached license cannot be bypassed with a code", async () => {
  const e = await enroll(candidate()),
    code = await issueCode(e);
  const l = (
    await ok<Envelope>(
      "/admin/licenses/issue",
      { ...mutation(), device_id: e.device_id, sku: "YARIZAN-G1" },
      admin,
    )
  ).body;
  await ok(`/admin/licenses/${l.payload.license_id}/revoke`, mutation(), admin);
  await denied(
    "/desktop/activation-codes/redeem",
    {
      device_id: e.device_id,
      sku: "YARIZAN-G1",
      request_id: randomUUID(),
      activation_code: code.activation_code,
    },
    "RECOVERY_REQUIRED",
    e.credential,
  );
});
test("SKU ban survives customer reset/re-enrollment; other grade remains available", async () => {
  const key = candidate(),
    e = await enroll(key),
    code = await issueCode(e);
  const license = (
    await ok<Envelope>(
      "/admin/licenses/issue",
      { ...mutation(), device_id: e.device_id, sku: "YARIZAN-G1" },
      admin,
    )
  ).body;
  await ok(
    `/admin/devices/${e.device_id}/products/YARIZAN-G1/block`,
    mutation(),
    admin,
  );
  await denied(
    "/desktop/trials/YARIZAN-G1/status",
    undefined,
    "PRODUCT_BLOCKED",
    e.credential,
  );
  await denied(
    "/desktop/activation-codes/redeem",
    {
      device_id: e.device_id,
      sku: "YARIZAN-G1",
      request_id: randomUUID(),
      activation_code: code.activation_code,
    },
    "PRODUCT_BLOCKED",
    e.credential,
  );
  await ok(`/admin/customers/${e.customer_id}/reset`, mutation(), admin);
  await denied(
    "/desktop/trials/YARIZAN-G2/status",
    undefined,
    "ACCOUNT_RESTRICTED",
    e.credential,
  );
  const tombstone = (
    await ok<Envelope>(
      "/desktop/licenses/sync",
      { license_id: license.payload.license_id, sku: "YARIZAN-G1" },
      e.credential,
    )
  ).body;
  assert.equal(tombstone.payload.status, "REVOKED");
  const next = await enroll(key);
  assert.equal(next.device_id, e.device_id);
  assert.equal(next.username, e.username);
  assert.notEqual(next.customer_id, e.customer_id);
  assert.equal(
    (
      await db.query("SELECT generation FROM devices WHERE id=$1", [
        e.device_id,
      ])
    ).rows[0].generation,
    2,
  );
  await denied(
    "/desktop/trials/YARIZAN-G1/status",
    undefined,
    "PRODUCT_BLOCKED",
    next.credential,
  );
  assert.equal(
    (await ok("/desktop/trials/YARIZAN-G2/status", undefined, next.credential))
      .body.remaining,
    2,
  );
  await ok(
    `/admin/devices/${e.device_id}/products/YARIZAN-G1/unblock`,
    mutation(2),
    admin,
  );
  await denied(
    "/desktop/licenses/pickup",
    { sku: "YARIZAN-G1" },
    "ENTITLEMENT_REQUIRED",
    next.credential,
  );
  await denied(
    "/desktop/activation-codes/redeem",
    {
      device_id: e.device_id,
      sku: "YARIZAN-G1",
      request_id: randomUUID(),
      activation_code: code.activation_code,
    },
    "ACTIVATION_CODE_INVALID",
    next.credential,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM customers WHERE device_id=$1 AND state='RESET'",
        [e.device_id],
      )
    ).rows[0].count,
    "1",
  );
});
test("Fresh generation trial budget only after authorized reset", async () => {
  const key = candidate(),
    e = await enroll(key);
  await ok(
    "/desktop/trials/YARIZAN-G1/start",
    {
      device_id: e.device_id,
      client_nonce: hash(randomBytes(32)),
      client_process_session_id: randomUUID(),
    },
    e.credential,
  );
  await ok(`/admin/customers/${e.customer_id}/reset`, mutation(), admin);
  const n = await enroll(key);
  assert.equal(
    (await ok("/desktop/trials/YARIZAN-G1/status", undefined, n.credential))
      .body.remaining,
    2,
  );
  assert.equal(
    (
      await db.query(
        "SELECT used FROM trial_counters WHERE device_id=$1 AND generation=1",
        [e.device_id],
      )
    ).rows[0].used,
    1,
  );
});
test("Support cannot issue entitlement or reset account", async () => {
  const support = await adminLogin("support");
  await denied(
    "/admin/licenses/issue",
    { ...mutation(), device_id: primary.device_id, sku: "YARIZAN-G1" },
    "FORBIDDEN",
    support,
  );
  await denied(
    `/admin/customers/${primary.customer_id}/reset`,
    mutation(),
    "FORBIDDEN",
    support,
  );
});
test("Admin wrong MFA, reused MFA and expired recent authentication denied", async () => {
  const id = randomUUID(),
    secret = randomBytes(20).toString("hex"),
    username = "mfa-" + id;
  await db.query(
    "INSERT INTO admins(id,username,password_hash,mfa_ciphertext) VALUES($1,$2,$3,$4)",
    [
      id,
      username,
      await passwordHash("Synthetic!Admin123456"),
      seal(secret, process.env.MFA_ENCRYPTION_KEY!),
    ],
  );
  const b = {
    username,
    password: "Synthetic!Admin123456",
    mfa_code: "not-six-digits",
  };
  await denied("/admin/auth/login", b, "INVALID_REQUEST");
  const code = totp(secret, Math.floor(Date.now() / 30000));
  await ok("/admin/auth/login", { ...b, mfa_code: code });
  await denied("/admin/auth/login", { ...b, mfa_code: code }, "MFA_REQUIRED");
  const old = await adminLogin();
  await db.query(
    "UPDATE admin_sessions SET mfa_at=now()-interval '6 minutes' WHERE token_hash=$1",
    [security.tokenHash(old.cookie.split("=")[1])],
  );
  await denied(
    "/admin/licenses/issue",
    { ...mutation(), device_id: primary.device_id, sku: "YARIZAN-G1" },
    "MFA_REQUIRED",
    old,
  );
});
test("Support reset requires independent evidence and is one-time; old sessions revoked", async () => {
  const e = await enroll(candidate()),
    session = await login(e),
    support = await adminLogin("support");
  const input = mutation();
  const { evidence_ref: omitted, ...missing } = input;
  assert.ok(omitted);
  await denied(
    `/admin/customers/${e.customer_id}/password-reset`,
    missing,
    "OWNERSHIP_EVIDENCE_REQUIRED",
    support,
  );
  const reset = (
    await ok<{ reset_grant: string }>(
      `/admin/customers/${e.customer_id}/password-reset`,
      input,
      support,
    )
  ).body;
  await denied("/account", undefined, "UNAUTHENTICATED", session);
  await ok("/auth/password-reset/complete", {
    reset_grant: reset.reset_grant,
    password: "Changed!Password12345",
  });
  await denied(
    "/auth/password-reset/complete",
    { reset_grant: reset.reset_grant, password: "Changed!Password12345" },
    "RESET_INVALID",
  );
  await denied(
    "/auth/login",
    { username: e.username, password: "Synthetic!Password12345" },
    "INVALID_CREDENTIALS",
  );
  await login(e, "Changed!Password12345");
});
test("Immutable audit and trial history enforced by PostgreSQL triggers", async () => {
  await assert.rejects(
    db.query("UPDATE audit_logs SET action='erased'"),
    /Immutable history/,
  );
  await assert.rejects(
    db.query("DELETE FROM trial_starts"),
    /Immutable history/,
  );
  await assert.rejects(
    db.query("UPDATE trial_counters SET used=3"),
    /check constraint/,
  );
  await assert.rejects(
    db.query("DELETE FROM devices WHERE id=$1", [primary.device_id]),
    /foreign key constraint/,
  );
});
test("Admin trial reset retains immutable grants and does not reset other products", async () => {
  await ok(
    `/admin/trials/${primary.device_id}/YARIZAN-G1/reset`,
    mutation(),
    admin,
  );
  assert.equal(
    (
      await ok(
        "/desktop/trials/YARIZAN-G1/status",
        undefined,
        primary.credential,
      )
    ).body.remaining,
    2,
  );
  assert.equal(
    (
      await db.query("SELECT count(*) FROM trial_starts WHERE device_id=$1", [
        primary.device_id,
      ])
    ).rows[0].count,
    "2",
  );
});
test("No heartbeat endpoint, malformed/duplicate/oversize requests rejected without secret echo", async () => {
  await denied(
    "/desktop/trials/heartbeat",
    {},
    "NOT_FOUND",
    primary.credential,
  );
  for (const raw of [
    '{"sku":"YARIZAN-G1","sku":"YARIZAN-G2"}',
    JSON.stringify({ activation_code: "x".repeat(40000) }),
  ]) {
    const r = await fetch(base + "/desktop/licenses/pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
    });
    assert.equal(r.status, 400);
    assert.equal(((await r.json()) as ErrorBody).error.code, "INVALID_REQUEST");
  }
});
test("Audit search and reports authorized, outbox persisted", async () => {
  const r = (
    await ok<Record<string, unknown>[]>(
      "/admin/audit?limit=5",
      undefined,
      admin,
    )
  ).body;
  assert.equal(r.length, 5);
  assert.ok(!("password_hash" in r[0]));
  assert.ok(
    Number((await ok("/admin/reports", undefined, admin)).body.outbox_pending) >
      0,
  );
});
test("Real .NET verifier validates backend artifacts and rejects negative signatures/claims", async () => {
  const vector =
    '{ "z":"یاریزان\\u000f\\n😀\u2028", "a":1, "arr":[true,null,"/\\\\\\\""] }';
  const invalid: Envelope[] = [];
  const altered = structuredClone(paid);
  altered.payload.grade = 2;
  invalid.push(altered);
  const encoding = structuredClone(paid);
  encoding.signature += "=";
  invalid.push(encoding);
  const badSig = structuredClone(paid);
  badSig.signature = randomBytes(64).toString("base64url");
  invalid.push(badSig);
  const wrongDomain = structuredClone(paid);
  wrongDomain.signature = signing.keys
    .sign(Buffer.from(profiles.trial.domain + canonical(paid.payload)))
    .toString("base64url");
  invalid.push(wrongDomain);
  for (const changes of [
    { license_revision: 0 },
    { expires_at: new Date().toISOString() },
    { device_id: randomUUID() },
    { device_fingerprint_digest: "B".repeat(64) },
    { sku: "YARIZAN-G2", grade: 2 },
  ]) {
    const a = structuredClone(paid);
    Object.assign(a.payload, changes);
    a.signature = signing.keys
      .sign(Buffer.from(profiles.license.domain + canonical(a.payload)))
      .toString("base64url");
    invalid.push(a);
  }
  const invalidEnrollment = structuredClone(primary.enrollment);
  invalidEnrollment.payload.device_key_digest = "B".repeat(64);
  invalidEnrollment.signature = signing.keys
    .sign(
      Buffer.from(
        profiles.enrollment.domain + canonical(invalidEnrollment.payload),
      ),
    )
    .toString("base64url");
  const reference = JSON.parse(
    await readFile("test/vectors/license-message.json", "utf8"),
  ) as { payload: Record<string, unknown>; message_hex: string };
  const fixture = {
    referencePayload: reference.payload,
    referenceMessageHex: reference.message_hex,
    kid: signing.keys.kid,
    publicKey: signing.keys.publicKey,
    fingerprint: primaryKey.fingerprint,
    keyDigest: hash(Buffer.from(primaryKey.publicKey, "base64url")),
    deviceId: primary.device_id,
    enrollment: primary.enrollment,
    license: paid,
    trial: firstTrial,
    active,
    revoked,
    invalid,
    invalidEnrollment,
    vector,
    canonical: canonical(JSON.parse(vector)),
    messageHex: Buffer.from(profiles.license.domain + canonical(paid.payload))
      .toString("hex")
      .toUpperCase(),
  };
  const dir = await mkdtemp(path.join(tmpdir(), "yarizan-backend-interop-"));
  try {
    const file = path.join(dir, "synthetic.json");
    await writeFile(file, JSON.stringify(fixture));
    const result = spawnSync(
      "dotnet",
      [
        "run",
        "--project",
        "../tests/BackendInterop",
        "-c",
        "Release",
        "--",
        file,
      ],
      { encoding: "utf8", timeout: 120000 },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /DOTNET_INTEROP 24 passed, 0 failed/);
    console.log(result.stdout.trim());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Real .NET DesktopV2Client and access controller operate against Nest API", async () => {
  const key = candidate(),
    e = await enroll(key);
  await ok(
    "/admin/licenses/issue",
    { ...mutation(), device_id: e.device_id, sku: "YARIZAN-G1" },
    admin,
  );
  const fixture = {
    apiBase: base.replace("/api/v2", "/"),
    deviceId: e.device_id,
    credential: e.credential,
    fingerprint: key.fingerprint,
    keyDigest: hash(Buffer.from(key.publicKey, "base64url")),
    enrollment: e.enrollment,
    kid: signing.keys.kid,
    publicKey: signing.keys.publicKey,
  };
  const dir = await mkdtemp(path.join(tmpdir(), "yarizan-dotnet-api-"));
  try {
    const file = path.join(dir, "synthetic.json");
    await writeFile(file, JSON.stringify(fixture));
    const result = await promisify(execFile)(
      "dotnet",
      [
        "run",
        "--project",
        "../tests/BackendInterop",
        "-c",
        "Release",
        "--",
        file,
      ],
      { timeout: 120000 },
    );
    assert.match(result.stdout, /DOTNET_API 10 passed, 0 failed/);
    console.log(result.stdout.trim());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Signing failure rolls back trial consumption and activation code; logs redact secrets", async () => {
  const e = await enroll(candidate()),
    code = await issueCode(e),
    signMethod = signing.keys.sign,
    originalLog = console.error,
    logs: string[] = [];
  signing.keys.sign = () => {
    throw new Error(code.activation_code);
  };
  console.error = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };
  try {
    const r = await request(
      "/desktop/trials/YARIZAN-G1/start",
      {
        device_id: e.device_id,
        client_nonce: hash(randomBytes(32)),
        client_process_session_id: randomUUID(),
      },
      e.credential,
    );
    assert.equal(r.status, 503);
    const result = await request(
      "/desktop/activation-codes/redeem",
      {
        device_id: e.device_id,
        sku: "YARIZAN-G1",
        activation_code: code.activation_code,
        request_id: randomUUID(),
      },
      e.credential,
    );
    assert.equal(result.status, 503);
  } finally {
    signing.keys.sign = signMethod;
    console.error = originalLog;
  }
  assert.equal(
    (
      await db.query("SELECT count(*) FROM trial_starts WHERE device_id=$1", [
        e.device_id,
      ])
    ).rows[0].count,
    "0",
  );
  assert.equal(
    (
      await db.query("SELECT status FROM activation_codes WHERE id=$1", [
        code.code_id,
      ])
    ).rows[0].status,
    "ISSUED",
  );
  assert.equal(
    (
      await db.query("SELECT count(*) FROM entitlements WHERE device_id=$1", [
        e.device_id,
      ])
    ).rows[0].count,
    "0",
  );
  assert.ok(logs.length > 0 && !logs.join("").includes(code.activation_code));
});
test("Expired and explicitly revoked online credentials denied", async () => {
  const e = await enroll(candidate());
  await db.query(
    "UPDATE device_credentials SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
    [security.tokenHash(e.credential)],
  );
  await denied(
    "/desktop/trials/YARIZAN-G1/status",
    undefined,
    "ENROLLMENT_REQUIRED",
    e.credential,
  );
});
test("Reset-pending account cannot login with old password or enumeration dummy", async () => {
  const e = await enroll(candidate());
  await ok(
    `/admin/customers/${e.customer_id}/password-reset`,
    mutation(),
    admin,
  );
  for (const password of [
    "Synthetic!Password12345",
    "synthetic-enumeration-defense-password",
  ])
    await denied(
      "/auth/login",
      { username: e.username, password },
      "INVALID_CREDENTIALS",
    );
});
test("Parallel outbox workers claim disjoint batches; failure leaves event retryable", async () => {
  const outbox = app.get(Outbox),
    seen = new Set<string>();
  const result = await Promise.all([
    outbox.dispatch(async (event) => {
      assert.ok(!seen.has(event.id));
      seen.add(event.id);
    }, 10),
    outbox.dispatch(async (event) => {
      assert.ok(!seen.has(event.id));
      seen.add(event.id);
    }, 10),
  ]);
  assert.equal(
    result.reduce((sum, r) => sum + r.sent, 0),
    20,
  );
  const failed = await outbox.dispatch(async () => {
    throw new Error("synthetic consumer unavailable");
  }, 1);
  assert.equal(failed.sent, 0);
  assert.equal(failed.attempted, 1);
});
test("Runtime role cannot edit audit, migration metadata or schema", async () => {
  await db.query(await readFile("tools/runtime-role.sql", "utf8"));
  const c = await db.pool.connect();
  try {
    await c.query("SET ROLE yarizan_runtime");
    await assert.rejects(
      c.query("UPDATE audit_logs SET action='tampered'"),
      /permission denied/,
    );
    await assert.rejects(
      c.query("UPDATE schema_migrations SET hash='tampered'"),
      /permission denied/,
    );
    await assert.rejects(
      c.query("ALTER TABLE products ADD COLUMN bad integer"),
      /must be owner/,
    );
  } finally {
    await c.query("RESET ROLE");
    c.release();
  }
});

test("Admin logout works without unrelated privilege or fresh MFA", async () => {
  const support = await adminLogin("support");
  await db.query(
    "UPDATE admin_sessions SET mfa_at=now()-interval '6 minutes' WHERE token_hash=$1",
    [security.tokenHash(support.cookie.split("=")[1])],
  );
  await ok("/admin/auth/logout", {}, support);
  await denied("/admin/reports", undefined, "UNAUTHENTICATED", support);
});
test("Machine rate limits survive credential rotation and additional profiles", async () => {
  const key = candidate(),
    e = await enroll(key),
    browser = await login(e),
    profile = await enroll(candidate(key.fingerprint), browser);
  const results = await Promise.allSettled(
    Array.from({ length: 125 }, () =>
      security.authenticatedRate("Bearer " + e.credential, 1740000000000),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 120);
  assert.equal(results.filter((r) => r.status === "rejected").length, 5);
  await assert.rejects(
    security.authenticatedRate("Bearer " + profile.credential, 1740000000000),
    (error: unknown) =>
      error instanceof ApiError && error.code === "RATE_LIMITED",
  );
});

test("Reset/reapproved key cannot promote old revoked bearer into new generation", async () => {
  const key = candidate(),
    e = await enroll(key);
  const old = (
    await ok<Envelope>(
      "/admin/licenses/issue",
      { ...mutation(), device_id: e.device_id, sku: "YARIZAN-G1" },
      admin,
    )
  ).body;
  await ok(`/admin/customers/${e.customer_id}/reset`, mutation(), admin);
  const next = await enroll(key);
  const fresh = (
    await ok<Envelope>(
      "/admin/licenses/issue",
      { ...mutation(2), device_id: e.device_id, sku: "YARIZAN-G1" },
      admin,
    )
  ).body;
  await denied(
    "/desktop/licenses/sync",
    { license_id: fresh.payload.license_id, sku: "YARIZAN-G1" },
    "ACCOUNT_RESTRICTED",
    e.credential,
  );
  assert.equal(
    (
      await ok<Envelope>(
        "/desktop/licenses/sync",
        { license_id: old.payload.license_id, sku: "YARIZAN-G1" },
        e.credential,
      )
    ).body.payload.status,
    "REVOKED",
  );
  assert.equal(
    (
      await ok<Envelope>(
        "/desktop/licenses/sync",
        { license_id: fresh.payload.license_id, sku: "YARIZAN-G1" },
        next.credential,
      )
    ).body.payload.status,
    "ACTIVE",
  );
  const stored = (
    await db.query(
      "SELECT customer_id,generation FROM device_credentials WHERE token_hash=$1",
      [security.tokenHash(e.credential)],
    )
  ).rows[0];
  assert.equal(stored.customer_id, e.customer_id);
  assert.equal(stored.generation, 1);
  await assert.rejects(
    db.query("UPDATE device_credentials SET generation=2 WHERE token_hash=$1", [
      security.tokenHash(e.credential),
    ]),
    /Credential authority cannot change/,
  );
  await ok(
    `/admin/licenses/${fresh.payload.license_id}/revoke`,
    mutation(),
    admin,
  );
  await denied(
    "/desktop/licenses/sync",
    { license_id: fresh.payload.license_id, sku: "YARIZAN-G1" },
    "ACCOUNT_RESTRICTED",
    e.credential,
  );
});

function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForSignal(signal: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      signal,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Test synchronization timed out")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const trialInput = (device_id: string) => ({
  device_id,
  client_nonce: hash(randomBytes(32)),
  client_process_session_id: randomUUID(),
});
const startRoute = "/desktop/trials/YARIZAN-G1/start";
const resetRoute = (e: Enrolled) =>
  `/admin/trials/${e.device_id}/YARIZAN-G1/reset`;

test("Allocation reset retires old nonces, preserves history, shares profiles and isolates grades", async () => {
  const key = candidate(),
    e = await enroll(key),
    profile = await enroll(candidate(key.fingerprint), await login(e));
  const old = trialInput(e.device_id);
  const oldResult = (await ok<Trial>(startRoute, old, e.credential)).body;
  await ok(
    "/desktop/trials/YARIZAN-G2/start",
    trialInput(e.device_id),
    e.credential,
  );
  const reset = mutation();
  const result = (await ok(resetRoute(e), reset, admin)).body;
  assert.equal(result.allocation_epoch, 2);
  assert.deepEqual((await ok(resetRoute(e), reset, admin)).body, result);
  await denied(startRoute, old, "TRIAL_ALLOCATION_CHANGED", profile.credential);
  assert.equal(
    (await ok("/desktop/trials/YARIZAN-G1/status", undefined, e.credential))
      .body.remaining,
    2,
  );
  assert.equal(
    (await ok("/desktop/trials/YARIZAN-G2/status", undefined, e.credential))
      .body.remaining,
    1,
  );
  const next = trialInput(e.device_id);
  const nextResult = (await ok<Trial>(startRoute, next, profile.credential))
    .body;
  assert.deepEqual(
    (await ok<Trial>(startRoute, next, e.credential)).body,
    nextResult,
  );
  await denied(
    startRoute,
    { ...next, client_process_session_id: randomUUID() },
    "IDEMPOTENCY_MISMATCH",
    e.credential,
  );
  await ok(startRoute, trialInput(e.device_id), e.credential);
  await denied(
    startRoute,
    trialInput(e.device_id),
    "TRIAL_EXHAUSTED",
    profile.credential,
  );
  assert.deepEqual(
    (await ok<Trial>(startRoute, next, e.credential)).body,
    nextResult,
  );
  const records = await db.query(
    "SELECT allocation_epoch,response FROM trial_starts WHERE device_id=$1 AND sku='YARIZAN-G1' ORDER BY allocation_epoch",
    [e.device_id],
  );
  assert.deepEqual(
    records.rows.map((r) => r.allocation_epoch),
    ["1", "2", "2"],
  );
  assert.deepEqual(records.rows[0].response, oldResult);
  await assert.rejects(
    db.query("UPDATE trial_starts SET allocation_epoch=2 WHERE device_id=$1", [
      e.device_id,
    ]),
    /Immutable history/,
  );
  const counters = await db.query(
    "SELECT sku,used,allocation_epoch FROM trial_counters WHERE device_id=$1 ORDER BY sku",
    [e.device_id],
  );
  assert.deepEqual(counters.rows, [
    { sku: "YARIZAN-G1", used: 2, allocation_epoch: "2" },
    { sku: "YARIZAN-G2", used: 1, allocation_epoch: "1" },
  ]);
});

test("Reset before first start and customer generation reset allocate independent epochs", async () => {
  const key = candidate(),
    e = await enroll(key);
  assert.equal(
    (await ok(resetRoute(e), mutation(), admin)).body.allocation_epoch,
    2,
  );
  await ok(startRoute, trialInput(e.device_id), e.credential);
  await ok(`/admin/customers/${e.customer_id}/reset`, mutation(), admin);
  const fresh = await enroll(key);
  await denied(
    startRoute,
    trialInput(e.device_id),
    "ACCOUNT_RESTRICTED",
    e.credential,
  );
  await ok(startRoute, trialInput(e.device_id), fresh.credential);
  await ok(startRoute, trialInput(e.device_id), fresh.credential);
  await denied(
    startRoute,
    trialInput(e.device_id),
    "TRIAL_EXHAUSTED",
    fresh.credential,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT generation,used,allocation_epoch FROM trial_counters WHERE device_id=$1 ORDER BY generation",
        [e.device_id],
      )
    ).rows,
    [
      { generation: 1, used: 1, allocation_epoch: "2" },
      { generation: 2, used: 2, allocation_epoch: "1" },
    ],
  );
});

test("PostgreSQL serializes an in-flight trial before reset without restoring its nonce", async () => {
  const e = await enroll(candidate()),
    old = trialInput(e.device_id);
  const audit = app.get(Audit),
    service = app.get(Admin),
    original = audit.append.bind(audit),
    originalDevice = service.device.bind(service);
  const held = barrier(),
    release = barrier(),
    resetEntered = barrier();
  audit.append = async (...args: Parameters<Audit["append"]>) => {
    await original(...args);
    if (args[2] === "trial.started" && args[3] === e.device_id) {
      held.resolve();
      await release.promise;
    }
  };
  service.device = (...args: Parameters<Admin["device"]>) => {
    const work = originalDevice(...args);
    if (args[1] === e.device_id) resetEntered.resolve();
    return work;
  };
  try {
    const start = request<Trial>(startRoute, old, e.credential);
    await waitForSignal(held.promise);
    const reset = request(resetRoute(e), mutation(), admin);
    await waitForSignal(resetEntered.promise);
    release.resolve();
    assert.equal((await start).status, 201);
    assert.equal((await reset).status, 201);
  } finally {
    release.resolve();
    audit.append = original;
    service.device = originalDevice;
  }
  await denied(startRoute, old, "TRIAL_ALLOCATION_CHANGED", e.credential);
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      request<ErrorBody>(startRoute, trialInput(e.device_id), e.credential),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 2);
  assert.equal(
    results.filter((r) => r.body.error?.code === "TRIAL_EXHAUSTED").length,
    18,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT used,allocation_epoch FROM trial_counters WHERE device_id=$1",
        [e.device_id],
      )
    ).rows,
    [{ used: 2, allocation_epoch: "2" }],
  );
});

test("Trials queued behind reset use its new epoch; old retry cannot return retired grant", async () => {
  const e = await enroll(candidate()),
    old = trialInput(e.device_id);
  await ok(startRoute, old, e.credential);
  const audit = app.get(Audit),
    trials = app.get(Trials),
    original = audit.append.bind(audit),
    originalStart = trials.start.bind(trials);
  const held = barrier(),
    release = barrier(),
    queued = barrier();
  let entered = 0;
  audit.append = async (...args: Parameters<Audit["append"]>) => {
    await original(...args);
    if (args[2] === "trial.reset" && args[3] === e.device_id) {
      held.resolve();
      await release.promise;
    }
  };
  trials.start = (...args: Parameters<Trials["start"]>) => {
    const work = originalStart(...args);
    if (args[2].device_id === e.device_id && ++entered === 4) queued.resolve();
    return work;
  };
  try {
    const reset = request(resetRoute(e), mutation(), admin);
    await waitForSignal(held.promise);
    const retry = request<ErrorBody>(startRoute, old, e.credential);
    const fresh = Array.from({ length: 3 }, () =>
      request<ErrorBody>(startRoute, trialInput(e.device_id), e.credential),
    );
    await waitForSignal(queued.promise);
    release.resolve();
    assert.equal((await reset).status, 201);
    assert.equal((await retry).body.error.code, "TRIAL_ALLOCATION_CHANGED");
    const results = await Promise.all(fresh);
    assert.equal(results.filter((r) => r.status === 201).length, 2);
    assert.equal(
      results.filter((r) => r.body.error?.code === "TRIAL_EXHAUSTED").length,
      1,
    );
  } finally {
    release.resolve();
    audit.append = original;
    trials.start = originalStart;
  }
});

test("Invalid and expired browser pairings invoke no password hashing", async () => {
  const valid = await paired(candidate()),
    expired = await paired(candidate()),
    consumed = await paired(candidate());
  await ok("/auth/claim", consumed);
  await db.query(
    "UPDATE pairings SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.pairing_id],
  );
  const hashing = app.get(PasswordHashing),
    original = hashing.hash;
  let calls = 0;
  hashing.hash = () => {
    calls++;
    throw new Error("Unexpected hashing");
  };
  try {
    for (const body of [
      { ...valid, pairing_id: randomUUID() },
      { ...valid, pairing_secret: randomBytes(32).toString("base64url") },
      expired,
      consumed,
    ])
      await denied("/auth/claim", body, "PAIRING_INVALID");
    assert.equal(calls, 0);
  } finally {
    hashing.hash = original;
  }
});
test("Retired credential-delivery endpoints cannot bypass browser-only approval", async () => {
  await denied("/devices/register", {}, "PROTOCOL_RETIRED");
  await denied(
    `/device-pairings/${randomUUID()}/desktop-confirm`,
    {},
    "PROTOCOL_RETIRED",
  );
  const p = await paired(candidate());
  const r = await fetch(base + "/auth/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://attacker.invalid",
    },
    body: JSON.stringify(p),
  });
  assert.equal(r.status, 403);
  const receipt = (await ok("/auth/claim", p)).body;
  assert.deepEqual(Object.keys(receipt).sort(), [
    "expires_at",
    "status",
    "username",
  ]);
  assert.equal(receipt.status, "APPROVED");
  assert.ok(
    !JSON.stringify(receipt).match(
      /credential|enrollment|claim_grant|browser_token/,
    ),
  );
});
test("Browser claim holds no PostgreSQL row lock across Argon2id and rechecks expiry", async () => {
  const key = candidate(),
    p = await paired(key),
    hashing = app.get(PasswordHashing),
    original = hashing.hash,
    held = barrier(),
    release = barrier();
  hashing.hash = async (value) => {
    held.resolve();
    await release.promise;
    return original.call(hashing, value);
  };
  const pending = request<ErrorBody>("/auth/claim", p);
  try {
    await waitForSignal(held.promise);
    await db.transaction(async (c) => {
      await c.query("SELECT id FROM pairings WHERE id=$1 FOR UPDATE NOWAIT", [
        p.pairing_id,
      ]);
      await c.query(
        "UPDATE pairings SET expires_at=now()-interval '1 second' WHERE id=$1",
        [p.pairing_id],
      );
    });
    release.resolve();
    assert.equal((await pending).body.error.code, "PAIRING_INVALID");
  } finally {
    release.resolve();
    hashing.hash = original;
  }
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM customers c JOIN devices d ON d.id=c.device_id WHERE d.fingerprint_digest=$1",
        [key.fingerprint],
      )
    ).rows[0].count,
    "0",
  );
});
test("Concurrent browser claims approve once and only the correct key can pick up", async () => {
  const key = candidate(),
    p = await paired(key);
  const r = await Promise.all([
    request("/auth/claim", p),
    request(`/device-pairings/${p.pairing_id}/confirm`, {
      pairing_secret: p.pairing_secret,
      password: p.password,
    }),
  ]);
  assert.equal(r.filter((x) => x.status === 201).length, 1);
  assert.equal(r.filter((x) => x.status === 410).length, 1);
  await denied(
    `/device-pairings/${p.pairing_id}/pickup`,
    await proof(candidate(key.fingerprint), "CONFIRM", p.pairing_id),
    "PAIRING_INVALID",
  );
  const picked = (
    await ok<Enrolled>(
      `/device-pairings/${p.pairing_id}/pickup`,
      await proof(key, "CONFIRM", p.pairing_id),
    )
  ).body;
  assert.ok(picked.credential);
  await login(picked);
});
test("Pending and lost-response pickup never duplicate profile issuance; fresh AUTH recovers certificate", async () => {
  const key = candidate(),
    p = await paired(key),
    route = `/device-pairings/${p.pairing_id}/pickup`;
  assert.deepEqual(
    (await ok(route, await proof(key, "CONFIRM", p.pairing_id))).body,
    { status: "PENDING" },
  );
  await ok("/auth/claim", p);
  const signed = await proof(key, "CONFIRM", p.pairing_id),
    first = (await ok<Enrolled>(route, signed)).body;
  await denied(route, signed, "CHALLENGE_INVALID");
  const retry = (
    await ok<Enrolled>(route, await proof(key, "CONFIRM", p.pairing_id))
  ).body;
  assert.deepEqual(retry.enrollment, first.enrollment);
  assert.notEqual(retry.credential, first.credential);
  await denied(
    "/desktop/trials/YARIZAN-G1/status",
    undefined,
    "ACCOUNT_RESTRICTED",
    first.credential,
  );
  const renewed = (await ok("/devices/authenticate", await proof(key, "AUTH")))
    .body;
  assert.deepEqual(renewed.enrollment, first.enrollment);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM device_enrollment_history WHERE key_id=$1",
        [first.enrollment.payload.profile_enrollment_id],
      )
    ).rows[0].count,
    "1",
  );
});
test("Reset invalidates pending and approved pairing generations", async () => {
  const key = candidate(),
    first = await enroll(key),
    owner = await login(first),
    second = candidate(key.fingerprint),
    pending = await paired(second),
    approved = await paired(candidate(key.fingerprint));
  await ok("/auth/claim", approved, owner);
  await ok(`/admin/customers/${first.customer_id}/reset`, mutation(), admin);
  await denied("/auth/claim", pending, "PAIRING_INVALID");
  await denied(
    `/device-pairings/${approved.pairing_id}/pickup`,
    await proof(second, "CONFIRM", approved.pairing_id),
    "PAIRING_INVALID",
  );
});
test("Cancelled pairing cannot authorize or provision", async () => {
  const key = candidate(),
    p = await paired(key);
  await ok(`/device-pairings/${p.pairing_id}/cancel`, {
    pairing_secret: p.pairing_secret,
  });
  await denied("/auth/claim", p, "PAIRING_INVALID");
  await denied(
    `/device-pairings/${p.pairing_id}/pickup`,
    await proof(key, "CONFIRM", p.pairing_id),
    "PAIRING_INVALID",
  );
});
test("Admin paginated reads enforce permissions and omit authentication and fingerprint secrets", async () => {
  for (const route of [
    "customers",
    "devices",
    "licenses",
    "trials",
    "activation-codes",
    "products",
  ]) {
    const r = (
      await ok<{
        items: Record<string, unknown>[];
        next_offset: number | null;
      }>(`/admin/${route}?limit=1`, undefined, admin)
    ).body;
    assert.ok(r.items.length <= 1);
    assert.ok(
      !JSON.stringify(r).match(
        /password_hash|verifier|fingerprint_digest|public_key|token_hash|signed_enrollment/,
      ),
    );
  }
  const auditor = await adminLogin("auditor");
  await denied("/admin/customers", undefined, "FORBIDDEN", auditor);
  assert.ok(
    (
      await ok<{ permissions: string[] }>(
        "/admin/auth/session",
        undefined,
        admin,
      )
    ).body.permissions.includes("customers.reset"),
  );
  await denied(
    "/admin/devices?limit=1000",
    undefined,
    "INVALID_REQUEST",
    admin,
  );
});
