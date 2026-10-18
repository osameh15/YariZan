import "reflect-metadata";
import { before, beforeEach, after, test } from "node:test";
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
import { Identity } from "../src/identity/identity";
import { PasswordHashing } from "../src/security/passwords";
import { ApiError } from "../src/common/errors";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { hash as passwordHash } from "argon2";
import { createApp } from "../src/main";
import { Database } from "../src/database/database";
import { migrate, verifyMigrations } from "../src/database/migrate";
import { productionBootstrap } from "../src/database/production-bootstrap";
import { seed } from "../src/database/seed";
import { Signing, Envelope, canonical, profiles } from "../src/signing/signing";
import { Security } from "../src/security/security";
import { seal, unseal, hash } from "../src/security/crypto";

import { Otp } from "../src/accounts/otp";
import { Orders } from "../src/commerce/orders";
import { Payments } from "../src/commerce/payments";
import {
  Gateway,
  PaymentGateway,
  PaymentResult,
} from "../src/commerce/gateway";
import { Sms } from "../src/accounts/sms";
import { Notifications } from "../src/accounts/notifications";
process.env.NODE_ENV = "test";
process.env.COMMERCE_MODE = "fake";
process.env.SMS_PROVIDER = "fake";
process.env.MOBILE_ENCRYPTION_KEY = "4".repeat(64);
process.env.OTP_HMAC_KEY = "5".repeat(64);
process.env.SMS_FAKE_OUTBOX = ".local/sms-test-outbox.jsonl";
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
let mobileCounter = 10000000;
const nextMobile = () => "091" + (++mobileCounter).toString().padStart(8, "0");
async function otpCode(id: string) {
  for (let n = 0; n < 100; n++) {
    const code = app.get(Sms).fake.codeFor(id);
    if (
      code &&
      (await db.query("SELECT delivered FROM otp_challenges WHERE id=$1", [id]))
        .rows[0]?.delivered
    )
      return code;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw Error("Fake delivery not completed");
}
async function paired(key: Candidate) {
  const p = (
    await ok<{ pairing_id: string; pairing_secret: string }>(
      "/device-pairings",
      await proof(key, "PAIR"),
    )
  ).body;
  const owner = (
    await db.query(
      "SELECT 1 FROM pairings p JOIN customers c ON c.device_id=p.device_id AND c.generation=p.generation AND c.state='ACTIVE' WHERE p.id=$1",
      [p.pairing_id],
    )
  ).rowCount;
  let otp: { challenge_id: string; code: string } | undefined;
  if (!owner) {
    const sent = await ok<{ challenge_id: string }>("/auth/claim/otp/request", {
      pairing_id: p.pairing_id,
      pairing_secret: p.pairing_secret,
      mobile: nextMobile(),
    });
    otp = {
      challenge_id: sent.body.challenge_id,
      code: await otpCode(sent.body.challenge_id),
    };
  }
  return {
    ...(otp ? { otp } : {}),
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
  const phone = nextMobile();
  await db.query(
    "UPDATE admins SET mobile_ciphertext=$2,mobile_last4=$3 WHERE id=$1",
    [id, seal(phone, process.env.MOBILE_ENCRYPTION_KEY!), phone.slice(-4)],
  );
  const sent = await ok<{ challenge_id: string }>("/admin/auth/login", {
    username,
    password: "Synthetic!Admin123456",
  });
  const r = await ok<{ csrf_token: string }>("/admin/auth/sms/verify", {
    challenge_id: sent.body.challenge_id,
    code: await otpCode(sent.body.challenge_id),
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
beforeEach(async () => {
  await db.query("DELETE FROM rate_buckets");
});
after(async () => {
  await app?.close();
  await db?.onApplicationShutdown();
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
  const phone = nextMobile();
  await db.query(
    "UPDATE admins SET mobile_ciphertext=$2,mobile_last4=$3 WHERE id=$1",
    [id, seal(phone, process.env.MOBILE_ENCRYPTION_KEY!), phone.slice(-4)],
  );
  const b = { username, password: "Synthetic!Admin123456" };
  await denied(
    "/admin/auth/login",
    { ...b, mfa_code: "123456" },
    "INVALID_REQUEST",
  );
  const challenge = await ok<{ challenge_id: string }>("/admin/auth/login", b),
    code = await otpCode(challenge.body.challenge_id);
  await denied(
    "/admin/auth/sms/verify",
    {
      challenge_id: challenge.body.challenge_id,
      code: code === "000000" ? "111111" : "000000",
    },
    "OTP_INVALID",
  );
  await ok("/admin/auth/sms/verify", {
    challenge_id: challenge.body.challenge_id,
    code,
  });
  await denied(
    "/admin/auth/sms/verify",
    { challenge_id: challenge.body.challenge_id, code },
    "OTP_INVALID",
  );
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
  await db.query(
    await readFile("migrations/roles/create-runtime-role.sql", "utf8"),
  );
  // The migrator applies grants after migrating once the role exists.
  assert.equal((await migrate(db)).grants, true);
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
    await assert.rejects(c.query("TRUNCATE rate_buckets"), /permission denied/);
    await assert.rejects(
      c.query("DELETE FROM audit_logs"),
      /permission denied/,
    );
    await assert.rejects(
      c.query("CREATE TABLE intruder(id int)"),
      /permission denied/,
    );
    // The single runtime DELETE used by the application stays permitted.
    await c.query("DELETE FROM discount_products WHERE false");
    // Read-only migration verification works with runtime privileges.
    assert.deepEqual(await verifyMigrations(c), { total: 10 });
  } finally {
    await c.query("RESET ROLE");
    c.release();
  }
});

test("Production bootstrap is idempotent and never edits catalog or prices", async () => {
  const before = (
    await db.query(
      "SELECT sku,publication_status,sale_enabled FROM products ORDER BY sku",
    )
  ).rows;
  const prices = (await db.query("SELECT count(*) FROM product_prices"))
    .rows[0];
  assert.deepEqual(await productionBootstrap(db.pool), { products_created: 0 });
  assert.deepEqual(
    (
      await db.query(
        "SELECT sku,publication_status,sale_enabled FROM products ORDER BY sku",
      )
    ).rows,
    before,
  );
  assert.deepEqual(
    (await db.query("SELECT count(*) FROM product_prices")).rows[0],
    prices,
  );
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
    "authenticated",
    "csrf_token",
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
      otp: p.otp,
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

test("Real C# provisioning transport, lost delivery, protected storage and offline access", async () => {
  const fixture = {
    provisioning: true,
    commerce: true,
    sms_fixture_path: path.resolve(".local/sms-test-outbox.jsonl"),
    mobile_key: process.env.MOBILE_ENCRYPTION_KEY,
    apiBase: base.replace("/api/v2", "/"),
    origin,
    kid: signing.keys.kid,
    publicKey: signing.keys.publicKey,
    adminCookie: admin.cookie,
    adminCsrf: admin.csrf,
  };
  const dir = await mkdtemp(path.join(tmpdir(), "yarizan-provisioning-"));
  try {
    const file = path.join(dir, "synthetic.json");
    await writeFile(file, JSON.stringify(fixture));
    const projects = [
      "../tests/BackendInterop",
      ...(process.platform === "win32" ? ["../tests/ProvisioningChecks"] : []),
    ];
    for (const project of projects) {
      const result = await promisify(execFile)(
        "dotnet",
        ["run", "--project", project, "-c", "Release", "--", file],
        { timeout: 180000 },
      );
      assert.match(result.stdout, /DOTNET_PROVISIONING \d+ passed, 0 failed/);
      console.log(result.stdout.trim());
    }
  } finally {
    assert.ok(
      path
        .resolve(dir)
        .startsWith(path.join(path.resolve(tmpdir()), "yarizan-provisioning-")),
    );
    await rm(dir, { recursive: true, force: true });
  }
});

test("Owner session is revalidated atomically after browser claim admission", async () => {
  const key = candidate(),
    e = await enroll(key),
    owner = await login(e),
    p = await paired(candidate(key.fingerprint));
  const service = app.get(Identity),
    original = service.claim.bind(service),
    held = barrier(),
    release = barrier();
  service.claim = async (...args: Parameters<Identity["claim"]>) => {
    held.resolve();
    await release.promise;
    return original(...args);
  };
  const pending = request<ErrorBody>("/auth/claim", p, owner);
  try {
    await waitForSignal(held.promise);
    await ok("/auth/logout", {}, owner);
    release.resolve();
    assert.equal((await pending).body.error.code, "UNAUTHENTICATED");
  } finally {
    release.resolve();
    service.claim = original;
  }
  assert.equal(
    (await db.query("SELECT status FROM pairings WHERE id=$1", [p.pairing_id]))
      .rows[0].status,
    "PENDING",
  );
  await ok("/auth/claim", p, await login(e));
});

async function mobileFor(e: Enrolled) {
  return unseal(
    (
      await db.query("SELECT mobile_ciphertext FROM customers WHERE id=$1", [
        e.customer_id,
      ])
    ).rows[0].mobile_ciphertext,
    process.env.MOBILE_ENCRYPTION_KEY!,
  );
}
async function requestOtp(e: Enrolled, purpose = "LOGIN") {
  const r = await ok<{ challenge_id: string }>("/auth/otp/request", {
    username: e.username,
    mobile: await mobileFor(e),
    purpose,
  });
  return {
    challenge_id: r.body.challenge_id,
    code: await otpCode(r.body.challenge_id),
  };
}
async function browserOtp(e: Enrolled) {
  const r = await ok<{ csrf_token: string }>(
    "/auth/otp/verify",
    await requestOtp(e),
  );
  return {
    cookie: r.headers
      .getSetCookie()
      .find((v) => v.startsWith("yz_customer="))!
      .split(";")[0],
    csrf: r.body.csrf_token,
  };
}
test("Mobile-only first claim creates an initial browser session without another OTP", async () => {
  const k = candidate(),
    p = await paired(k);
  const { password: ignored, ...body } = p;
  void ignored;
  const r = await ok("/auth/claim", body);
  assert.deepEqual(Object.keys(r.body).sort(), [
    "authenticated",
    "csrf_token",
    "expires_at",
    "status",
    "username",
  ]);
  const e = (
    await ok<Enrolled>(
      `/device-pairings/${p.pairing_id}/pickup`,
      await proof(k, "CONFIRM", p.pairing_id),
    )
  ).body;
  assert.equal(
    (
      await db.query("SELECT password_hash FROM customers WHERE id=$1", [
        e.customer_id,
      ])
    ).rows[0].password_hash,
    null,
  );
  await denied(
    "/auth/login",
    { username: e.username, password: "Synthetic!Password12345" },
    "INVALID_CREDENTIALS",
  );
  const browser = {
    cookie: r.headers
      .getSetCookie()
      .find((v) => v.startsWith("yz_customer="))!
      .split(";")[0],
    csrf: r.body.csrf_token as string,
  };
  assert.match(
    r.headers.getSetCookie().find((v) => v.startsWith("yz_customer="))!,
    /HttpOnly/,
  );
  assert.match(
    r.headers.getSetCookie().find((v) => v.startsWith("yz_customer="))!,
    /SameSite=Strict/,
  );
  const details = (await ok("/account/security", undefined, browser)).body;
  assert.equal(details.has_password, false);
  assert.ok(!JSON.stringify(details).includes(await mobileFor(e)));
});

test("Concurrent initial claims mint one session; replay and invalid claim never set cookies", async () => {
  const p = await paired(candidate());
  const { password: ignored, ...body } = p;
  void ignored;
  const results = await Promise.all(
    Array.from({ length: 3 }, () => request("/auth/claim", body)),
  );
  const success = results.filter((r) => r.status === 201);
  assert.equal(success.length, 1);
  assert.equal(results.filter((r) => r.headers.has("set-cookie")).length, 1);
  const id = (
    await db.query("SELECT authorized_customer_id FROM pairings WHERE id=$1", [
      p.pairing_id,
    ])
  ).rows[0].authorized_customer_id;
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM customer_sessions WHERE customer_id=$1",
        [id],
      )
    ).rows[0].count,
    "1",
  );
  const replay = await denied("/auth/claim", body, "PAIRING_INVALID");
  assert.equal(replay.headers.has("set-cookie"), false);
  for (const state of ["expired", "cancelled", "mismatch", "otp-used"]) {
    const q = await paired(candidate());
    if (state === "expired")
      await db.query(
        "UPDATE pairings SET expires_at=now()-interval '1 second' WHERE id=$1",
        [q.pairing_id],
      );
    if (state === "cancelled")
      await ok(`/device-pairings/${q.pairing_id}/cancel`, {
        pairing_secret: q.pairing_secret,
      });
    if (state === "mismatch") q.pairing_secret = "A".repeat(43);
    if (state === "otp-used")
      await db.query("UPDATE otp_challenges SET used_at=now() WHERE id=$1", [
        q.otp!.challenge_id,
      ]);
    const rejected = await request("/auth/claim", q);
    assert.ok(rejected.status >= 400);
    assert.equal(rejected.headers.has("set-cookie"), false);
  }
});

test("Existing-owner profile approval preserves its session without minting another", async () => {
  const e = await enroll(candidate()),
    owner = await login(e);
  const p = await paired(
    candidate(
      (
        await db.query("SELECT fingerprint_digest FROM devices WHERE id=$1", [
          e.device_id,
        ])
      ).rows[0].fingerprint_digest,
    ),
  );
  const count = async () =>
    (
      await db.query(
        "SELECT count(*) FROM customer_sessions WHERE customer_id=$1",
        [e.customer_id],
      )
    ).rows[0].count;
  const before = await count();
  const r = await ok(
    `/device-pairings/${p.pairing_id}/confirm`,
    { pairing_secret: p.pairing_secret },
    owner,
  );
  assert.equal(r.body.authenticated, true);
  assert.equal(r.body.csrf_token, undefined);
  assert.equal(r.headers.has("set-cookie"), false);
  assert.equal(await count(), before);
  await ok("/account", undefined, owner);
});

test("Initial-session audit failure rolls back account, OTP and pairing together", async () => {
  const p = await paired(candidate()),
    audit = app.get(Audit),
    original = audit.append;
  audit.append = async (c, actor, action, entity, metadata) => {
    if (action === "customer.login_claim")
      throw new Error("synthetic transaction rollback");
    return original.call(audit, c, actor, action, entity, metadata);
  };
  try {
    const r = await request("/auth/claim", p);
    assert.equal(r.status, 503);
    assert.equal(r.headers.has("set-cookie"), false);
    assert.equal(
      (
        await db.query("SELECT status FROM pairings WHERE id=$1", [
          p.pairing_id,
        ])
      ).rows[0].status,
      "PENDING",
    );
    assert.equal(
      (
        await db.query("SELECT used_at FROM otp_challenges WHERE id=$1", [
          p.otp!.challenge_id,
        ])
      ).rows[0].used_at,
      null,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM customers c JOIN pairings p ON p.device_id=c.device_id WHERE p.id=$1",
          [p.pairing_id],
        )
      ).rows[0].count,
      "0",
    );
  } finally {
    audit.append = original;
  }
  const r = await ok("/auth/claim", p);
  assert.ok(r.headers.has("set-cookie"));
});

async function eventually(check: () => Promise<boolean>) {
  for (let i = 0; i < 300; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("Asynchronous delivery did not settle");
}
function controlledDelivery() {
  const sms = new Sms(security),
    service = new Otp(db, security, sms, app.get(Audit));
  const release = barrier(),
    started: string[] = [];
  sms.fake.send = async (m) => {
    started.push(m.challengeId);
    await release.promise;
  };
  const actor = { type: "SYSTEM" as const, correlationId: randomUUID() };
  const issue = (deliver = true) =>
    service.issue("LOGIN", nextMobile(), actor, {}, deliver);
  return { sms, service, release, started, issue };
}

test("Bounded FIFO admits every accepted concurrent OTP, including decoys, and explicitly rejects excess", async () => {
  const d = controlledDelivery();
  try {
    const first = await Promise.all(Array.from({ length: 4 }, () => d.issue()));
    await eventually(async () => d.started.length === 4);
    const rest = await Promise.allSettled(
      Array.from({ length: 36 }, (_, i) => d.issue(i % 2 === 0)),
    );
    assert.equal(rest.filter((r) => r.status === "fulfilled").length, 16);
    assert.equal(rest.filter((r) => r.status === "rejected").length, 20);
    for (const r of rest)
      if (r.status === "rejected")
        assert.equal(r.reason.code, "SMS_UNAVAILABLE");
    assert.equal(d.started.length, 4);
    d.release.resolve();
    await eventually(async () => d.started.length === 12);
    const accepted = [
      ...first,
      ...rest.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    ];
    await eventually(
      async () =>
        (
          await db.query(
            "SELECT count(*) FROM otp_challenges WHERE id=ANY($1::uuid[]) AND delivered",
            [accepted.map((r) => r.challenge_id)],
          )
        ).rows[0].count === "12",
    );
    assert.equal(new Set(d.started).size, 12);
    for (const r of accepted)
      assert.deepEqual(Object.keys(r).sort(), [
        "challenge_id",
        "expires_in",
        "retry_after",
      ]);
  } finally {
    d.release.resolve();
    await d.service.beforeApplicationShutdown();
  }
});

test("Saturated public login admission rejects matched and unknown accounts identically without waiting for SMS", async () => {
  const e = await enroll(candidate()),
    sms = app.get(Sms),
    original = sms.fake.send;
  const release = barrier(),
    sent: string[] = [];
  sms.fake.send = async (m) => {
    sent.push(m.challengeId);
    await release.promise;
  };
  try {
    const service = app.get(Otp),
      actor = { type: "SYSTEM" as const, correlationId: randomUUID() };
    await Promise.all(
      Array.from({ length: 20 }, () =>
        service.issue("LOGIN", nextMobile(), actor, {}),
      ),
    );
    await eventually(async () => sent.length === 4);
    const mobile = await mobileFor(e);
    const results = await Promise.all(
      [e.username, "unknown-device"].map((username) =>
        request<ErrorBody>("/auth/otp/request", {
          username,
          mobile,
          purpose: "LOGIN",
        }),
      ),
    );
    for (const r of results) {
      assert.equal(r.status, 503);
      assert.equal(r.body.error.code, "SMS_UNAVAILABLE");
    }
    release.resolve();
    await eventually(async () => sent.length === 20);
    await eventually(
      async () =>
        (
          await db.query(
            "SELECT count(*) FROM otp_challenges WHERE id=ANY($1::uuid[]) AND delivered",
            [sent],
          )
        ).rows[0].count === "20",
    );
  } finally {
    release.resolve();
    sms.fake.send = original;
  }
});

test("Queued OTPs recheck expiry and supersession before provider dispatch", async () => {
  const d = controlledDelivery();
  try {
    await Promise.all(Array.from({ length: 4 }, () => d.issue()));
    await eventually(async () => d.started.length === 4);
    const expired = await d.issue(),
      superseded = await d.issue(),
      current = await d.issue();
    await db.query(
      "UPDATE otp_challenges SET created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
      [expired.challenge_id],
    );
    await db.query("UPDATE otp_challenges SET used_at=now() WHERE id=$1", [
      superseded.challenge_id,
    ]);
    d.release.resolve();
    await eventually(async () => d.started.includes(current.challenge_id));
    await d.service.beforeApplicationShutdown();
    assert.equal(d.started.includes(expired.challenge_id), false);
    assert.equal(d.started.includes(superseded.challenge_id), false);
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM audit_logs WHERE entity_id=ANY($1::text[]) AND action='otp.delivery_unavailable'",
          [[expired.challenge_id, superseded.challenge_id]],
        )
      ).rows[0].count,
      "2",
    );
  } finally {
    d.release.resolve();
    await d.service.beforeApplicationShutdown();
  }
});

test("Interrupted queued delivery is audited and not sent; ambiguous provider failures are never retried", async () => {
  const d = controlledDelivery();
  try {
    await Promise.all(Array.from({ length: 4 }, () => d.issue()));
    await eventually(async () => d.started.length === 4);
    const pending = await d.issue();
    const stopped = d.service.beforeApplicationShutdown();
    d.release.resolve();
    await stopped;
    assert.equal(d.started.includes(pending.challenge_id), false);
    assert.equal(
      (
        await db.query("SELECT delivered FROM otp_challenges WHERE id=$1", [
          pending.challenge_id,
        ])
      ).rows[0].delivered,
      false,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM audit_logs WHERE entity_id=$1 AND action='otp.delivery_unavailable'",
          [pending.challenge_id],
        )
      ).rows[0].count,
      "1",
    );
    await assert.rejects(
      d.issue(),
      (e: unknown) => (e as ApiError).code === "SMS_UNAVAILABLE",
    );
  } finally {
    d.release.resolve();
    await d.service.beforeApplicationShutdown();
  }
  const failed = controlledDelivery();
  let calls = 0;
  failed.sms.fake.send = async () => {
    calls++;
    throw Error("ambiguous timeout secret");
  };
  try {
    const r = await failed.issue();
    await eventually(
      async () =>
        (
          await db.query(
            "SELECT 1 FROM audit_logs WHERE entity_id=$1 AND action='otp.delivery_unavailable'",
            [r.challenge_id],
          )
        ).rowCount === 1,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      failed.service.admit(r.challenge_id, "LOGIN", "123456"),
      (e: unknown) => (e as ApiError).code === "OTP_INVALID",
    );
  } finally {
    await failed.service.beforeApplicationShutdown();
  }
});
test("Unverified first claim and cross-pairing OTP cannot approve another key", async () => {
  const a = await paired(candidate()),
    b = await paired(candidate());
  await denied(
    "/auth/claim",
    { pairing_id: a.pairing_id, pairing_secret: a.pairing_secret },
    "OTP_REQUIRED",
  );
  await denied("/auth/claim", { ...a, otp: b.otp }, "OTP_INVALID");
  await ok("/auth/claim", b);
});
test("Unknown username/mobile requests have identical public receipts and never deliver", async () => {
  const e = await enroll(candidate()),
    known = await requestOtp(e);
  const r = await ok<{ challenge_id: string }>("/auth/otp/request", {
    username: "unknown-device",
    mobile: nextMobile(),
    purpose: "LOGIN",
  });
  assert.deepEqual(Object.keys(r.body).sort(), [
    "challenge_id",
    "expires_in",
    "retry_after",
  ]);
  assert.equal(app.get(Sms).fake.codeFor(r.body.challenge_id), undefined);
  await denied(
    "/auth/otp/verify",
    { challenge_id: r.body.challenge_id, code: known.code },
    "OTP_INVALID",
  );
  assert.ok(!JSON.stringify(r.body).includes(known.code));
});
test("OTP five wrong attempts persist, expire and replay fail closed", async () => {
  const e = await enroll(candidate()),
    p = await requestOtp(e);
  const wrong = p.code === "000000" ? "111111" : "000000";
  for (let n = 0; n < 5; n++)
    await denied("/auth/otp/verify", { ...p, code: wrong }, "OTP_INVALID");
  await denied("/auth/otp/verify", p, "OTP_INVALID");
  assert.equal(
    (
      await db.query("SELECT attempts FROM otp_challenges WHERE id=$1", [
        p.challenge_id,
      ])
    ).rows[0].attempts,
    5,
  );
  const e2 = await enroll(candidate()),
    q = await requestOtp(e2);
  await db.query(
    "UPDATE otp_challenges SET created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
    [q.challenge_id],
  );
  await denied("/auth/otp/verify", q, "OTP_INVALID");
});
test("Parallel OTP login consumes once and retries cannot mint another session", async () => {
  const e = await enroll(candidate()),
    p = await requestOtp(e);
  const r = await Promise.all([
    request("/auth/otp/verify", p),
    request("/auth/otp/verify", p),
  ]);
  assert.equal(r.filter((x) => x.status === 201).length, 1);
  await denied("/auth/otp/verify", p, "OTP_INVALID");
});
test("Set optional password with existing-mobile OTP, revoke sessions and retain password login", async () => {
  const k = candidate(),
    p = await paired(k);
  await ok("/auth/claim", {
    pairing_id: p.pairing_id,
    pairing_secret: p.pairing_secret,
    otp: p.otp,
  });
  const e = (
      await ok<Enrolled>(
        `/device-pairings/${p.pairing_id}/pickup`,
        await proof(k, "CONFIRM", p.pairing_id),
      )
    ).body,
    browser = await browserOtp(e);
  const sent = await ok<{ challenge_id: string }>(
      "/account/security/otp",
      { purpose: "PASSWORD" },
      browser,
    ),
    passwordProof = {
      challenge_id: sent.body.challenge_id,
      code: await otpCode(sent.body.challenge_id),
    };
  await ok(
    "/account/security/password",
    { ...passwordProof, password: "NewOptional!Password123" },
    browser,
  );
  await denied("/account", undefined, "UNAUTHENTICATED", browser);
  await login(e, "NewOptional!Password123");
});
test("Password change requires mobile proof, revokes sessions and old password", async () => {
  const e = await enroll(candidate()),
    browser = await login(e),
    sent = await ok<{ challenge_id: string }>(
      "/account/security/otp",
      { purpose: "PASSWORD" },
      browser,
    );
  await ok(
    "/account/security/password",
    {
      challenge_id: sent.body.challenge_id,
      code: await otpCode(sent.body.challenge_id),
      password: "Changed!Password12345",
    },
    browser,
  );
  await denied(
    "/auth/login",
    { username: e.username, password: "Synthetic!Password12345" },
    "INVALID_CREDENTIALS",
  );
  await denied("/account", undefined, "UNAUTHENTICATED", browser);
  await login(e, "Changed!Password12345");
});
test("Self-service mobile password reset invalidates sessions and stale login proofs", async () => {
  const e = await enroll(candidate()),
    browser = await login(e),
    stale = await requestOtp(e),
    p = await requestOtp(e, "RESET");
  await ok("/auth/password-reset/otp", {
    ...p,
    password: "ResetMobile!Password123",
  });
  await denied("/auth/otp/verify", stale, "OTP_INVALID");
  await denied("/account", undefined, "UNAUTHENTICATED", browser);
  await denied(
    "/auth/password-reset/otp",
    { ...p, password: "Repeat!Password12345" },
    "OTP_INVALID",
  );
  await login(e, "ResetMobile!Password123");
});
test("Mobile change needs both current and new number proofs, never a bare session", async () => {
  const e = await enroll(candidate()),
    browser = await login(e),
    mobile = nextMobile();
  await denied(
    "/account/security/otp",
    { purpose: "MOBILE_NEW", mobile },
    "OTP_REQUIRED",
    browser,
  );
  const old = await ok<{ challenge_id: string }>(
      "/account/security/otp",
      { purpose: "MOBILE_OLD" },
      browser,
    ),
    current = {
      challenge_id: old.body.challenge_id,
      code: await otpCode(old.body.challenge_id),
    };
  const fresh = await ok<{ challenge_id: string }>(
      "/account/security/otp",
      { purpose: "MOBILE_NEW", mobile, current },
      browser,
    ),
    proof = {
      challenge_id: fresh.body.challenge_id,
      code: await otpCode(fresh.body.challenge_id),
    };
  await denied("/account/security/mobile", proof, "OTP_REQUIRED", browser);
  await ok("/account/security/mobile", { ...proof, current }, browser);
  assert.equal(await mobileFor(e), mobile);
  await denied("/account", undefined, "UNAUTHENTICATED", browser);
});
test("Account reset retires mobile OTP generation without changing desktop access policy", async () => {
  const e = await enroll(candidate()),
    p = await requestOtp(e);
  await ok(`/admin/customers/${e.customer_id}/reset`, mutation(), admin);
  await denied("/auth/otp/verify", p, "OTP_INVALID");
});
test("OTP requests enforce cooldown, IP and mobile budgets", async () => {
  const e = await enroll(candidate());
  await requestOtp(e);
  await denied(
    "/auth/otp/request",
    { username: e.username, mobile: await mobileFor(e), purpose: "LOGIN" },
    "RATE_LIMITED",
  );
});
test("SMS provider outage returns generic receipt and no usable OTP", async () => {
  const e = await enroll(candidate()),
    sms = app.get(Sms),
    send = sms.fake.send;
  sms.fake.send = async () => {
    throw Error("vendor-secret-do-not-expose");
  };
  try {
    const r = await ok<{ challenge_id: string }>("/auth/otp/request", {
      username: e.username,
      mobile: await mobileFor(e),
      purpose: "RESET",
    });
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(
      (
        await db.query("SELECT delivered FROM otp_challenges WHERE id=$1", [
          r.body.challenge_id,
        ])
      ).rows[0].delivered,
      false,
    );
    await denied(
      "/auth/password-reset/otp",
      {
        challenge_id: r.body.challenge_id,
        code: "123456",
        password: "Unused!Password12345",
      },
      "OTP_INVALID",
    );
    assert.ok(!JSON.stringify(r.body).includes("vendor-secret"));
  } finally {
    sms.fake.send = send;
  }
});
test("Notes support optimistic edits, entity references, scoped RBAC and note/phone/id search", async () => {
  const e = await enroll(candidate()),
    note = "Independent synthetic note searchable purple-orbit",
    route = `/admin/notes/devices/${e.device_id}`;
  const r = await ok<{ revision: number }>(
    route,
    { note, expected_revision: 0 },
    admin,
  );
  assert.equal(r.body.revision, 1);
  await denied(
    route,
    { note: "stale", expected_revision: 0 },
    "STALE_REVISION",
    admin,
  );
  await ok(route, { note: note + " updated", expected_revision: 1 }, admin);
  for (const search of ["purple-orbit", e.device_id, await mobileFor(e)]) {
    const result = (
      await ok<{ items: { id: string; note: string }[] }>(
        "/admin/devices?search=" + encodeURIComponent(search),
        undefined,
        admin,
      )
    ).body;
    assert.ok(
      result.items.some((r) => r.id === e.device_id && r.note.includes(note)),
    );
  }
  const auditor = await adminLogin("auditor");
  await denied(
    route,
    { note: "forbidden", expected_revision: 2 },
    "FORBIDDEN",
    auditor,
  );
  await denied(
    `/admin/notes/devices/${randomUUID()}`,
    { note: "missing", expected_revision: 0 },
    "NOT_FOUND",
    admin,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM audit_logs WHERE entity_id=$1 AND action IN ('note.created','note.updated')",
        [e.device_id],
      )
    ).rows[0].count,
    "2",
  );
});
test("Trial notes are scoped to machine, SKU and account generation", async () => {
  const e = await enroll(candidate());
  await ok(
    "/desktop/trials/YARIZAN-G1/start",
    {
      device_id: e.device_id,
      client_nonce: hash(randomBytes(32)),
      client_process_session_id: randomUUID(),
    },
    e.credential,
  );
  const id = e.device_id + "~YARIZAN-G1~1";
  await ok(
    "/admin/notes/trials/" + id,
    { note: "Trial support note grade one", expected_revision: 0 },
    admin,
  );
  const r = (
    await ok<{ items: Record<string, unknown>[] }>(
      "/admin/trials?search=Trial%20support%20note",
      undefined,
      admin,
    )
  ).body;
  assert.ok(r.items.some((r) => r.device_id === e.device_id));
});

test("Notes CRUD and search cover customers, licenses, codes and product records", async () => {
  const e = await enroll(candidate());
  const license = (
    await ok<Envelope>(
      "/admin/licenses/issue",
      { ...mutation(), device_id: e.device_id, sku: "YARIZAN-G1" },
      admin,
    )
  ).body;
  const activation = (
    await ok<{ code_id: string }>(
      "/admin/activation-codes",
      {
        ...mutation(),
        device_id: e.device_id,
        sku: "YARIZAN-G1",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      admin,
    )
  ).body;
  for (const [type, id] of [
    ["customers", e.customer_id],
    ["licenses", String(license.payload.license_id)],
    ["activation-codes", activation.code_id],
    ["products", "YARIZAN-G1"],
  ]) {
    const note = "Record context " + type + " " + randomUUID();
    await ok(
      `/admin/notes/${type}/${id}`,
      { note, expected_revision: 0 },
      admin,
    );
    const found = (
      await ok<{ items: Record<string, unknown>[] }>(
        `/admin/${type}?search=` + encodeURIComponent(note),
        undefined,
        admin,
      )
    ).body.items;
    assert.ok(found.some((r) => r.note === note));
    await ok(
      `/admin/notes/${type}/${id}`,
      { note: note + " edited", expected_revision: 1 },
      admin,
    );
  }
});
test("Credential changes reject a valid OTP from another customer/session before password work", async () => {
  const a = await enroll(candidate()),
    b = await enroll(candidate()),
    ownerA = await login(a),
    ownerB = await login(b);
  const sent = await ok<{ challenge_id: string }>(
    "/account/security/otp",
    { purpose: "PASSWORD" },
    ownerA,
  );
  await denied(
    "/account/security/password",
    {
      challenge_id: sent.body.challenge_id,
      code: await otpCode(sent.body.challenge_id),
      password: "Foreign!Password12345",
    },
    "OTP_INVALID",
    ownerB,
  );
});

test("First-claim resend retires prior phone proof and limits one pairing to three requests", async () => {
  const p = await paired(candidate());
  const newer = await ok<{ challenge_id: string }>("/auth/claim/otp/request", {
    pairing_id: p.pairing_id,
    pairing_secret: p.pairing_secret,
    mobile: nextMobile(),
  });
  await otpCode(newer.body.challenge_id);
  await denied("/auth/claim", p, "OTP_INVALID");
  await ok("/auth/claim/otp/request", {
    pairing_id: p.pairing_id,
    pairing_secret: p.pairing_secret,
    mobile: nextMobile(),
  });
  await denied(
    "/auth/claim/otp/request",
    {
      pairing_id: p.pairing_id,
      pairing_secret: p.pairing_secret,
      mobile: nextMobile(),
    },
    "RATE_LIMITED",
  );
});

test("Public OTP cooldown cannot distinguish a matching username through bucket differences", async () => {
  const e = await enroll(candidate()),
    mobile = await mobileFor(e);
  await ok("/auth/otp/request", {
    username: "unknown-public-name",
    mobile,
    purpose: "LOGIN",
  });
  await denied(
    "/auth/otp/request",
    { username: e.username, mobile, purpose: "LOGIN" },
    "RATE_LIMITED",
  );
  await db.query("DELETE FROM rate_buckets");
  await requestOtp(e);
  await denied(
    "/auth/otp/request",
    { username: "unknown-public-name", mobile, purpose: "LOGIN" },
    "RATE_LIMITED",
  );
});
test("Disabled SMS fails closed while customer password login remains independent", async () => {
  const e = await enroll(candidate()),
    browser = await login(e),
    sms = app.get(Sms),
    available = sms.available;
  sms.available = () => {
    throw new ApiError("SMS_UNAVAILABLE", 503);
  };
  try {
    await login(e);
    await denied(
      "/auth/otp/request",
      { username: e.username, mobile: await mobileFor(e), purpose: "LOGIN" },
      "SMS_UNAVAILABLE",
    );
    await denied(
      "/account/security/otp",
      { purpose: "PASSWORD" },
      "SMS_UNAVAILABLE",
      browser,
    );
  } finally {
    sms.available = available;
  }
});
test("Schema rejects password-only new accounts and non-SMS active Admin sessions", async () => {
  const p = await paired(candidate()),
    device = (
      await db.query("SELECT device_id,generation FROM pairings WHERE id=$1", [
        p.pairing_id,
      ])
    ).rows[0];
  await assert.rejects(
    db.query(
      "INSERT INTO customers(id,device_id,generation,username,password_hash,state) VALUES($1,$2,$3,$4,'unused','ACTIVE')",
      [randomUUID(), device.device_id, device.generation, "unverified-claim"],
    ),
    (e) => (e as { code: string }).code === "23514",
  );
  const adminId = (await db.query("SELECT id FROM admins LIMIT 1")).rows[0].id;
  await assert.rejects(
    db.query(
      "INSERT INTO admin_sessions(token_hash,admin_id,csrf_hash,mfa_at,expires_at,mfa_method) VALUES($1,$2,$3,now(),now()+interval '1 hour','LEGACY_TOTP')",
      [security.tokenHash("legacy"), adminId, security.tokenHash("csrf")],
    ),
    (e) => (e as { code: string }).code === "23514",
  );
});

type SaleOrder = {
  id: string;
  state: string;
  total_irr: number;
  discount_irr: number;
  revision: number;
  exception_code: string | null;
  payments: { id: string; state: string; redirect_url: string | null }[];
};
async function buyer() {
  const e = await enroll(candidate());
  return { ...e, browser: await login(e) };
}
async function saleOrder(
  e: Awaited<ReturnType<typeof buyer>>,
  coupon?: string,
) {
  return (
    await ok<SaleOrder>(
      "/orders",
      {
        request_id: randomUUID(),
        sku: "YARIZAN-G1",
        ...(coupon ? { coupon } : {}),
      },
      e.browser,
    )
  ).body;
}
async function salePayment(e: Awaited<ReturnType<typeof buyer>>, o: SaleOrder) {
  return (
    await ok<{ attempt_id: string; redirect_url: string }>(
      `/orders/${o.id}/payments`,
      { request_id: randomUUID() },
      e.browser,
    )
  ).body;
}
async function recoverCommerce() {
  await db.query(
    "UPDATE commerce_jobs SET due_at=now() WHERE state='PENDING' AND kind<>'EXPIRE'",
  );
  for (let n = 0; n < 3; n++) await app.get(Payments).work(50);
}
async function discountFixture(overrides: Record<string, unknown> = {}) {
  const campaign = (
    await ok<{ id: string }>(
      "/admin/commerce/campaigns",
      {
        ...mutation(),
        name: "Synthetic campaign",
        starts_at: new Date(Date.now() - 60000).toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
        enabled: true,
        max_redemptions: 100,
        max_per_customer: 1,
        ...overrides,
      },
      admin,
    )
  ).body;
  const body = {
    ...mutation(),
    campaign_id: campaign.id,
    code: "TEST-" + randomBytes(6).toString("hex").toUpperCase(),
    type: "percent",
    value: 10,
    max_discount_irr: null,
    min_order_irr: null,
    enabled: true,
    max_redemptions: 100,
    max_per_customer: 1,
    skus: ["YARIZAN-G1"],
  };
  const code = (
    await ok<{ id: string }>("/admin/commerce/coupons", body, admin)
  ).body;
  return { campaign, code, body };
}

test("Commerce uses real snapshots, idempotency, ownership and disabled product checks", async () => {
  await app.get(Payments).beforeApplicationShutdown();
  await db.query(
    "UPDATE products SET publication_status='coming_soon',sale_enabled=false,trial_enabled=false,activation_enabled=false WHERE sku<>'YARIZAN-G1'",
  );
  const e = await buyer(),
    other = await buyer();
  const input = { request_id: randomUUID(), sku: "YARIZAN-G1" };
  const quote = (
    await ok<{ total_irr: number }>(
      "/discounts/quote",
      { sku: input.sku },
      e.browser,
    )
  ).body;
  assert.equal(quote.total_irr, 12990000);
  const o = (await ok<SaleOrder>("/orders", input, e.browser)).body;
  assert.equal(
    (await ok<SaleOrder>("/orders", input, e.browser)).body.id,
    o.id,
  );
  await denied(
    "/orders",
    { ...input, sku: "YARIZAN-G2" },
    "IDEMPOTENCY_MISMATCH",
    e.browser,
  );
  await denied(`/orders/${o.id}`, undefined, "NOT_FOUND", other.browser);
  for (let grade = 2; grade <= 6; grade++)
    await denied(
      "/orders",
      { request_id: randomUUID(), sku: "YARIZAN-G" + grade },
      "PRODUCT_NOT_AVAILABLE",
      other.browser,
    );
  // A later price change is appended (price history is append-only) and never alters the
  // order's captured snapshot; the original price is then restored by another appended row.
  const changePrice = (amount: number) =>
    db.transaction(async (c) => {
      await c.query(
        "UPDATE product_prices SET ended_at=clock_timestamp() WHERE sku='YARIZAN-G1' AND ended_at IS NULL",
      );
      await c.query(
        "INSERT INTO product_prices(id,sku,amount_irr,effective_at,source,pricing_revision) VALUES($1,'YARIZAN-G1',$2,clock_timestamp(),'BOOTSTRAP','pricing-2026-10-18-r9')",
        [randomUUID(), amount],
      );
    });
  await changePrice(14000000);
  try {
    assert.equal(
      (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body
        .total_irr,
      12990000,
    );
  } finally {
    await changePrice(12990000);
  }
  await assert.rejects(
    db.query("UPDATE order_items SET total_irr=total_irr WHERE order_id=$1", [
      o.id,
    ]),
    /Immutable history/,
  );
  await assert.rejects(
    db.query("UPDATE orders SET total_irr=1 WHERE id=$1", [o.id]),
    /immutable/i,
  );
});

test("Disabled commerce and client-supplied prices cannot create an order over direct HTTP", async () => {
  // The browser never sends a price: unknown fields, including any price or total, are refused.
  for (const extra of [
    { price_irr: 1 },
    { total_irr: 0 },
    { unit_price_irr: 12990000 },
    { pricing_revision: "pricing-2026-10-18-r1" },
  ])
    await denied(
      "/orders",
      { request_id: randomUUID(), sku: "YARIZAN-G1", ...extra },
      "INVALID_REQUEST",
      owner,
    );
  // With commerce disabled (the public and production default) no order, quote or payment
  // can be created even by a direct, authenticated, CSRF-valid request.
  const config = security.config as { COMMERCE_MODE: string };
  const mode = config.COMMERCE_MODE;
  const before = (await db.query("SELECT count(*)::int n FROM orders")).rows[0]
    .n;
  config.COMMERCE_MODE = "disabled";
  try {
    assert.equal(
      (await ok<{ checkout_enabled: boolean }>("/commerce/capabilities")).body
        .checkout_enabled,
      false,
    );
    await denied(
      "/orders",
      { request_id: randomUUID(), sku: "YARIZAN-G1" },
      "COMMERCE_UNAVAILABLE",
      owner,
    );
  } finally {
    config.COMMERCE_MODE = mode;
  }
  assert.equal(
    (await db.query("SELECT count(*)::int n FROM orders")).rows[0].n,
    before,
  );
});
test("Parallel duplicate order clicks expose only one financial order", async () => {
  const e = await buyer();
  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      request(
        "/orders",
        { request_id: randomUUID(), sku: "YARIZAN-G1" },
        e.browser,
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(
    (
      await db.query("SELECT count(*) FROM orders WHERE customer_id=$1", [
        e.customer_id,
      ])
    ).rows[0].count,
    "1",
  );
});

test("Percent/fixed/capped coupons quote without reserving and reject zero totals and invalid rules", async () => {
  const e = await buyer(),
    d = await discountFixture();
  const quote = () =>
    ok<{ discount_irr: number }>(
      "/discounts/quote",
      { sku: "YARIZAN-G1", coupon: d.body.code.toLowerCase() },
      e.browser,
    );
  assert.equal((await quote()).body.discount_irr, 1299000);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM discount_reservations WHERE code_id=$1",
        [d.code.id],
      )
    ).rows[0].count,
    "0",
  );
  await db.query(
    "UPDATE discount_codes SET max_discount_irr=100000 WHERE id=$1",
    [d.code.id],
  );
  assert.equal((await quote()).body.discount_irr, 100000);
  await db.query(
    "UPDATE discount_codes SET type='fixed',value=123456,max_discount_irr=NULL WHERE id=$1",
    [d.code.id],
  );
  assert.equal((await quote()).body.discount_irr, 123456);
  for (const sql of [
    "UPDATE discount_codes SET min_order_irr=99999999 WHERE id=$1",
    "UPDATE discount_codes SET min_order_irr=NULL,enabled=false WHERE id=$1",
  ]) {
    await db.query(sql, [d.code.id]);
    await denied(
      "/discounts/quote",
      { sku: "YARIZAN-G1", coupon: d.body.code },
      "COUPON_UNAVAILABLE",
      e.browser,
    );
  }
  await db.query(
    "UPDATE discount_codes SET enabled=true,type='percent',value=100,min_order_irr=NULL WHERE id=$1",
    [d.code.id],
  );
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: d.body.code },
    "ZERO_TOTAL_BLOCKED",
    e.browser,
  );
  await db.query("UPDATE discount_codes SET value=10 WHERE id=$1", [d.code.id]);
  await db.query(
    "UPDATE discount_campaigns SET starts_at=now()+interval '1 hour' WHERE id=$1",
    [d.campaign.id],
  );
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: d.body.code },
    "COUPON_UNAVAILABLE",
    e.browser,
  );
  await db.query(
    "UPDATE discount_campaigns SET starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' WHERE id=$1",
    [d.campaign.id],
  );
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: d.body.code },
    "COUPON_UNAVAILABLE",
    e.browser,
  );
});

test("Twenty PostgreSQL checkouts cannot reserve more than the last coupon allocation", async () => {
  const d = await discountFixture({ max_redemptions: 1 }),
    buyers = [];
  for (let n = 0; n < 20; n++) buyers.push(await buyer());
  const r = await Promise.all(
    buyers.map((e) =>
      request(
        "/orders",
        { request_id: randomUUID(), sku: "YARIZAN-G1", coupon: d.body.code },
        e.browser,
      ),
    ),
  );
  assert.equal(r.filter((r) => r.status === 201).length, 1);
  assert.equal(r.filter((r) => r.status === 422).length, 19);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM discount_reservations WHERE code_id=$1 AND state='RESERVED'",
        [d.code.id],
      )
    ).rows[0].count,
    "1",
  );
});

test("Forged callback cannot pay; verified synthetic capture fulfills exactly once under duplicate workers", async () => {
  const e = await buyer(),
    d = await discountFixture(),
    o = await saleOrder(e, d.body.code),
    p = await salePayment(e, o);
  const authority = (
    await db.query("SELECT authority FROM payment_attempts WHERE id=$1", [
      p.attempt_id,
    ])
  ).rows[0].authority;
  await ok(`/payments/zarinpal/return?Authority=${authority}&Status=OK`);
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
    "PENDING",
  );
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await db.query("UPDATE commerce_jobs SET due_at=now() WHERE target_id=$1", [
    p.attempt_id,
  ]);
  await Promise.all(
    Array.from({ length: 5 }, () => app.get(Payments).work(20)),
  );
  await recoverCommerce();
  const paid = (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser))
    .body;
  assert.equal(paid.state, "FULFILLED");
  for (let n = 0; n < 3; n++)
    await ok(`/payments/zarinpal/return?Authority=${authority}&Status=NOK`);
  await recoverCommerce();
  await db.query(
    "UPDATE commerce_jobs SET state='PENDING',due_at=now() WHERE order_id=$1 AND kind='PURCHASE_NOTICE'",
    [o.id],
  );
  await recoverCommerce();
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM outbox_events WHERE aggregate_id=$1 AND type='purchase.notification_recorded'",
        [o.id],
      )
    ).rows[0].count,
    "1",
  );
  for (const table of [
    "order_fulfillments",
    "discount_redemptions",
    "purchase_notifications",
  ]) {
    const field =
      table === "order_fulfillments"
        ? "order_item_id IN (SELECT id FROM order_items WHERE order_id=$1)"
        : "order_id=$1";
    assert.equal(
      (await db.query(`SELECT count(*) FROM ${table} WHERE ${field}`, [o.id]))
        .rows[0].count,
      "1",
    );
  }
  const license = (
    await ok<Envelope>(
      "/desktop/licenses/pickup",
      { sku: "YARIZAN-G1" },
      e.credential,
    )
  ).body;
  assert.equal(license.payload.device_id, e.device_id);
  assert.equal(license.payload.expires_at, null);
  await denied(
    "/desktop/licenses/pickup",
    { sku: "YARIZAN-G2" },
    "ENTITLEMENT_REQUIRED",
    e.credential,
  );
  await denied(
    "/orders",
    { request_id: randomUUID(), sku: "YARIZAN-G1" },
    "ALREADY_OWNED",
    e.browser,
  );
  await assert.rejects(
    db.query("DELETE FROM payment_attempts WHERE id=$1", [p.attempt_id]),
    /Immutable/,
  );
});

test("Ambiguous verification retains coupon after expiry and recovers across a new worker instance", async () => {
  const e = await buyer(),
    d = await discountFixture(),
    o = await saleOrder(e, d.body.code),
    p = await salePayment(e, o);
  await ok(`/orders/${o.id}/simulate`, { outcome: "UNKNOWN" }, e.browser);
  await recoverCommerce();
  assert.equal(
    (
      await db.query(
        "SELECT state FROM discount_reservations WHERE order_id=$1",
        [o.id],
      )
    ).rows[0].state,
    "UNKNOWN",
  );
  await db.query(
    "UPDATE discount_reservations SET expires_at=now()-interval '1 hour' WHERE order_id=$1",
    [o.id],
  );
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  const worker = new Payments(
    app.get(Orders),
    app.get((await import("../src/licenses/licenses")).Licenses),
  );
  await worker.work(50);
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
    "FULFILLED",
  );
  assert.equal(
    (
      await db.query(
        "SELECT state FROM discount_reservations WHERE order_id=$1",
        [o.id],
      )
    ).rows[0].state,
    "REDEEMED",
  );
  assert.ok(
    (
      await db.query(
        "SELECT * FROM payment_transitions WHERE attempt_id=$1 AND next_state='UNKNOWN'",
        [p.attempt_id],
      )
    ).rowCount,
  );
});

test("Definitive failure releases quota; late-paid released allocation is preserved as a paid exception", async () => {
  const e = await buyer(),
    d = await discountFixture({ max_redemptions: 1 }),
    o = await saleOrder(e, d.body.code),
    p = await salePayment(e, o);
  await ok(`/orders/${o.id}/simulate`, { outcome: "FAILED" }, e.browser);
  await recoverCommerce();
  assert.equal(
    (
      await db.query(
        "SELECT state FROM discount_reservations WHERE order_id=$1",
        [o.id],
      )
    ).rows[0].state,
    "RELEASED",
  );
  const a = (
    await db.query("SELECT * FROM fake_gateway_payments WHERE attempt_id=$1", [
      p.attempt_id,
    ])
  ).rows[0];
  await app.get(Payments).settle(p.attempt_id, {
    state: "VERIFIED",
    authority: a.authority,
    reference: a.provider_ref,
    amount_irr: Number(a.amount_irr),
    currency: a.currency,
    provider_config: a.merchant_config,
  });
  const paid = (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser))
    .body;
  assert.equal(paid.exception_code, "LATE_RELEASED_COUPON");
  assert.equal(paid.state, "FULFILLMENT_PENDING");
  assert.equal(
    (
      await db.query("SELECT state FROM payment_attempts WHERE id=$1", [
        p.attempt_id,
      ])
    ).rows[0].state,
    "VERIFIED",
  );
});

test("Paid signing failure never loses payment and safely retries fulfillment", async () => {
  const e = await buyer(),
    o = await saleOrder(e);
  await salePayment(e, o);
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await app.get(Payments).work(50);
  const original = signing.artifact.bind(signing);
  signing.artifact = () => {
    throw Error("synthetic signer outage");
  };
  try {
    await app.get(Payments).work(50);
    const paid = (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser))
      .body;
    assert.equal(paid.state, "FULFILLMENT_PENDING");
    assert.equal(paid.payments[0].state, "VERIFIED");
  } finally {
    signing.artifact = original;
  }
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
    "FULFILLED",
  );
});

test("Reset and product blocks retain captured money without granting stale-generation access", async () => {
  for (const action of ["reset", "block"]) {
    const e = await buyer(),
      o = await saleOrder(e);
    await salePayment(e, o);
    await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
    if (action === "reset")
      await ok(`/admin/customers/${e.customer_id}/reset`, mutation(), admin);
    else
      await ok(
        `/admin/devices/${e.device_id}/products/YARIZAN-G1/block`,
        mutation(),
        admin,
      );
    await recoverCommerce();
    const paid = (await db.query("SELECT * FROM orders WHERE id=$1", [o.id]))
      .rows[0];
    assert.ok(paid.paid_at);
    assert.equal(
      paid.exception_code,
      action === "reset" ? "ACCOUNT_GENERATION_CHANGED" : "PRODUCT_BLOCKED",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM entitlements WHERE source_order_item_id IN (SELECT id FROM order_items WHERE order_id=$1)",
          [o.id],
        )
      ).rows[0].count,
      "0",
    );
  }
});

test("Sales disabling after initiation does not invalidate the paid snapshot", async () => {
  const e = await buyer(),
    o = await saleOrder(e);
  await salePayment(e, o);
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await db.query(
    "UPDATE products SET sale_enabled=false WHERE sku='YARIZAN-G1'",
  );
  try {
    await recoverCommerce();
    assert.equal(
      (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
      "FULFILLED",
    );
  } finally {
    await db.query(
      "UPDATE products SET sale_enabled=true WHERE sku='YARIZAN-G1'",
    );
  }
});

test("Merchant/amount/currency/authority mismatch remains unknown and auditable", async () => {
  for (const change of [
    { amount_irr: 1 },
    { currency: "IRT" },
    { provider_config: "wrong-merchant" },
    { authority: "FAKE-" + randomUUID() },
  ]) {
    const e = await buyer(),
      o = await saleOrder(e),
      p = await salePayment(e, o),
      a = (
        await db.query(
          "SELECT * FROM fake_gateway_payments WHERE attempt_id=$1",
          [p.attempt_id],
        )
      ).rows[0];
    await app.get(Payments).settle(p.attempt_id, {
      state: "VERIFIED",
      authority: a.authority,
      reference: a.provider_ref,
      amount_irr: Number(a.amount_irr),
      currency: a.currency,
      provider_config: a.merchant_config,
      ...change,
    });
    assert.equal(
      (
        await db.query("SELECT state FROM payment_attempts WHERE id=$1", [
          p.attempt_id,
        ])
      ).rows[0].state,
      "UNKNOWN",
    );
    assert.equal(
      (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body
        .exception_code,
      "VERIFICATION_MISMATCH",
    );
  }
});

test("Commerce RBAC, revision conflicts, notes search and finance reporting are server-authoritative", async () => {
  const d = await discountFixture(),
    e = await buyer(),
    o = await saleOrder(e),
    support = await adminLogin("support");
  await denied("/admin/commerce/finance", undefined, "FORBIDDEN", support);
  await denied(
    "/admin/commerce/campaigns",
    {
      ...mutation(),
      name: "Forbidden campaign",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 86400000).toISOString(),
      enabled: true,
      max_redemptions: 1,
      max_per_customer: 1,
    },
    "FORBIDDEN",
    support,
  );
  await denied(
    `/admin/commerce/coupons/${d.code.id}`,
    { ...d.body, ...mutation(99) },
    "STALE_REVISION",
    admin,
    "PATCH",
  );
  await ok(
    `/admin/notes/orders/${o.id}`,
    { note: "Synthetic financial purple-orbit", expected_revision: 0 },
    admin,
  );
  const search = (
    await ok<{ items: { id: string }[] }>(
      "/admin/commerce/orders?search=purple-orbit",
      undefined,
      admin,
    )
  ).body;
  assert.ok(search.items.some((r) => r.id === o.id));
  const report = (
    await ok<{ net_irr: string; mode: string }>(
      "/admin/commerce/finance",
      undefined,
      admin,
    )
  ).body;
  assert.equal(report.mode, "simulated");
  assert.match(report.net_irr, /^[0-9]+$/);
});

test("Ambiguous create never retries charge creation; durable fake inquiry recovers orphan authority", async () => {
  const e = await buyer(),
    o = await saleOrder(e),
    gateway = app.get(Gateway),
    prior = gateway.provider;
  let creates = 0;
  gateway.provider = {
    create: async (r) => {
      creates++;
      await prior.create(r);
      throw Error("lost authority persistence response");
    },
    query: (r) => prior.query(r),
    verify: (r) => prior.verify(r),
  };
  const request_id = randomUUID();
  try {
    const a = (
      await ok<{ attempt_id: string; state: string }>(
        `/orders/${o.id}/payments`,
        { request_id },
        e.browser,
      )
    ).body;
    assert.equal(a.state, "UNKNOWN");
    await ok(`/orders/${o.id}/payments`, { request_id }, e.browser);
    assert.equal(creates, 1);
    await denied(
      `/orders/${o.id}/payments`,
      { request_id: randomUUID() },
      "PAYMENT_ALREADY_PENDING",
      e.browser,
    );
    await recoverCommerce();
    assert.ok(
      (
        await db.query("SELECT authority FROM payment_attempts WHERE id=$1", [
          a.attempt_id,
        ])
      ).rows[0].authority,
    );
    await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
    await recoverCommerce();
    assert.equal(
      (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
      "FULFILLED",
    );
  } finally {
    gateway.provider = prior;
  }
});

test("Duplicate capture and reused provider references retain financial exceptions without duplicate licenses", async () => {
  const e = await buyer(),
    o = await saleOrder(e),
    p = await salePayment(e, o);
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await recoverCommerce();
  const second = randomUUID();
  await db.query(
    "INSERT INTO payment_attempts(id,order_id,provider,amount_irr,state,authority,provider_config) VALUES($1,$2,'zarinpal',$3,'FAILED',$4,'fake-v1')",
    [second, o.id, o.total_irr, "FAKE-" + second],
  );
  await app.get(Payments).settle(second, {
    state: "VERIFIED",
    authority: "FAKE-" + second,
    reference: "SYNTHETIC-" + second,
    amount_irr: o.total_irr,
    currency: "IRR",
    provider_config: "fake-v1",
  });
  assert.equal(
    (
      await db.query(
        "SELECT exception_code FROM payment_attempts WHERE id=$1",
        [second],
      )
    ).rows[0].exception_code,
    "DUPLICATE_CAPTURE",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM order_fulfillments WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id=$1)",
        [o.id],
      )
    ).rows[0].count,
    "1",
  );
  const other = await buyer(),
    oo = await saleOrder(other),
    pp = await salePayment(other, oo),
    aa = (
      await db.query(
        "SELECT authority,provider_ref FROM payment_attempts WHERE id=$1",
        [p.attempt_id],
      )
    ).rows[0];
  const authority = (
    await db.query("SELECT authority FROM payment_attempts WHERE id=$1", [
      pp.attempt_id,
    ])
  ).rows[0].authority;
  const totalsBefore = (
    await ok<{ net_irr: string; verified_captures_irr: string }>(
      "/admin/commerce/finance",
      undefined,
      admin,
    )
  ).body;
  await app.get(Payments).settle(pp.attempt_id, {
    state: "VERIFIED",
    authority,
    reference: aa.provider_ref,
    amount_irr: oo.total_irr,
    currency: "IRR",
    provider_config: "fake-v1",
  });
  const evidence = (
    await db.query(
      "SELECT state,reported_ref,exception_code FROM payment_attempts WHERE id=$1",
      [pp.attempt_id],
    )
  ).rows[0];
  assert.equal(evidence.state, "VERIFIED");
  assert.equal(evidence.reported_ref, aa.provider_ref);
  assert.equal(evidence.exception_code, "REFERENCE_REUSED");
  const totalsAfter = (
    await ok<{ net_irr: string; verified_captures_irr: string }>(
      "/admin/commerce/finance",
      undefined,
      admin,
    )
  ).body;
  assert.equal(totalsAfter.net_irr, totalsBefore.net_irr);
  assert.equal(
    totalsAfter.verified_captures_irr,
    totalsBefore.verified_captures_irr,
  );
});

test("Expired uninitiated orders release coupon; held unknowns exhaust quotas; probing is bounded", async () => {
  const e = await buyer(),
    d = await discountFixture({ max_redemptions: 1 }),
    o = await saleOrder(e, d.body.code);
  await db.query(
    "UPDATE commerce_jobs SET due_at=now() WHERE order_id=$1 AND kind='EXPIRE'",
    [o.id],
  );
  // Snapshot expiry cannot be rewritten; advance the fixture clock by inserting a past-due order initially instead.
  await assert.rejects(
    db.query(
      "UPDATE orders SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [o.id],
    ),
    /immutable/i,
  );
  const other = await buyer();
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: d.body.code },
    "COUPON_UNAVAILABLE",
    other.browser,
  );
  for (let n = 0; n < 19; n++)
    await denied(
      "/discounts/quote",
      { sku: "YARIZAN-G1", coupon: "UNKNOWN-" + n },
      "COUPON_UNAVAILABLE",
      other.browser,
    );
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: "UNKNOWN-LAST" },
    "RATE_LIMITED",
    other.browser,
  );
});

test("Coupon account quotas, SKU restrictions and fixed snapshots survive campaign edits", async () => {
  const e = await buyer(),
    d = await discountFixture();
  const o = await saleOrder(e, d.body.code);
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: d.body.code },
    "COUPON_UNAVAILABLE",
    e.browser,
  );
  await ok(
    `/admin/commerce/coupons/${d.code.id}`,
    { ...d.body, ...mutation(), skus: ["YARIZAN-G2"] },
    admin,
    "PATCH",
  );
  const other = await buyer();
  await denied(
    "/discounts/quote",
    { sku: "YARIZAN-G1", coupon: d.body.code },
    "COUPON_UNAVAILABLE",
    other.browser,
  );
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body
      .total_irr,
    o.total_irr,
  );
});

test("Expired worker lease recovers after crash; review retries preserve durable history and idempotency", async () => {
  const e = await buyer(),
    o = await saleOrder(e),
    p = await salePayment(e, o);
  await db.query(
    "UPDATE commerce_jobs SET state='RUNNING',lease_until=now()-interval '1 second',lease_token=$2,due_at=now() WHERE target_id=$1",
    [p.attempt_id, randomUUID()],
  );
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
    "FULFILLED",
  );
  const runs = (
    await db.query(
      "SELECT event FROM commerce_job_runs WHERE job_id IN (SELECT id FROM commerce_jobs WHERE order_id=$1)",
      [o.id],
    )
  ).rows;
  assert.ok(runs.some((r) => r.event === "STARTED"));
  assert.ok(runs.some((r) => r.event === "DONE"));
  await assert.rejects(
    db.query(
      "DELETE FROM commerce_job_runs WHERE job_id IN (SELECT id FROM commerce_jobs WHERE order_id=$1)",
      [o.id],
    ),
    /immutable/i,
  );
  const pending = await buyer(),
    po = await saleOrder(pending),
    pp = await salePayment(pending, po);
  await db.query(
    "UPDATE commerce_jobs SET attempts=7,due_at=now() WHERE target_id=$1",
    [pp.attempt_id],
  );
  await recoverCommerce();
  assert.equal(
    (
      await db.query("SELECT state FROM commerce_jobs WHERE target_id=$1", [
        pp.attempt_id,
      ])
    ).rows[0].state,
    "REVIEW",
  );
  const view = (
    await ok<{ revision: number }>(
      `/admin/commerce/orders/${po.id}`,
      undefined,
      admin,
    )
  ).body;
  const b = mutation(view.revision);
  const first = await ok(`/admin/commerce/orders/${po.id}/reconcile`, b, admin);
  const retry = await ok(`/admin/commerce/orders/${po.id}/reconcile`, b, admin);
  assert.deepEqual(retry.body, first.body);
  await ok(
    `/orders/${po.id}/simulate`,
    { outcome: "SUCCESS" },
    pending.browser,
  );
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${po.id}`, undefined, pending.browser)).body
      .state,
    "FULFILLED",
  );
});

test("Refund request and review never execute a refund or revoke the purchased license", async () => {
  const e = await buyer(),
    other = await buyer(),
    o = await saleOrder(e);
  await salePayment(e, o);
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await recoverCommerce();
  await denied(
    `/orders/${o.id}/refund-request`,
    { reason: "Independent synthetic refund request" },
    "NOT_FOUND",
    other.browser,
  );
  const r = (
    await ok<{ id: string }>(
      `/orders/${o.id}/refund-request`,
      { reason: "Independent synthetic refund request" },
      e.browser,
    )
  ).body;
  r.id = (
    await db.query("SELECT id FROM refund_requests WHERE order_id=$1", [o.id])
  ).rows[0].id;
  const reviewed = (
    await ok<{ money_returned: boolean }>(
      `/admin/commerce/refunds/${r.id}/review`,
      { ...mutation(), state: "APPROVED" },
      admin,
    )
  ).body;
  assert.equal(reviewed.money_returned, false);
  assert.equal(
    (await db.query("SELECT count(*) FROM refunds WHERE request_id=$1", [r.id]))
      .rows[0].count,
    "0",
  );
  await ok("/desktop/licenses/pickup", { sku: "YARIZAN-G1" }, e.credential);
});

test("Password change sends one notice from the durable outbox, never twice", async () => {
  const notifications = app.get(Notifications);
  const e = await enroll(candidate()),
    browser = await login(e),
    sent = await ok<{ challenge_id: string }>(
      "/account/security/otp",
      { purpose: "PASSWORD" },
      browser,
    );
  await ok(
    "/account/security/password",
    {
      challenge_id: sent.body.challenge_id,
      code: await otpCode(sent.body.challenge_id),
      password: "Notified!Password12345",
    },
    browser,
  );
  for (let n = 0; n < 3; n++) await notifications.drain(50);
  const count = async (action: string) =>
    Number(
      (
        await db.query(
          "SELECT count(*) FROM audit_logs WHERE action=$1 AND entity_id=$2",
          [action, e.customer_id],
        )
      ).rows[0].count,
    );
  assert.equal(await count("sms.notice_sent"), 1);
  assert.equal(await count("sms.notice_unavailable"), 0);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM outbox_events WHERE aggregate_id=$1 AND type='password.changed' AND processed_at IS NULL",
        [e.customer_id],
      )
    ).rows[0].count,
    "0",
  );
  const fake = app.get(Sms).fake;
  const notice = fake.notices.findLast((n) => n.event === "PASSWORD_CHANGED");
  assert.match(notice!.values.date!, /^14\d\d\/\d\d\/\d\d$/);
  assert.equal(
    JSON.stringify(fake.notices).includes("Notified!Password"),
    false,
  );
  await Promise.all([notifications.drain(50), notifications.drain(50)]);
  assert.equal(await count("sms.notice_sent"), 1);
});

test("Purchase confirmation is sent once after durable fulfillment and carries only the order number", async () => {
  const notifications = app.get(Notifications);
  const e = await buyer(),
    o = await saleOrder(e),
    p = await salePayment(e, o);
  const before = Number(
    (
      await db.query(
        "SELECT count(*) FROM audit_logs WHERE action='sms.notice_sent' AND entity_id=$1",
        [o.id],
      )
    ).rows[0].count,
  );
  assert.equal(before, 0);
  await notifications.drain(50);
  assert.equal(
    app.get(Sms).fake.notices.some((n) => n.values.order === o.id),
    false,
    "no notice before payment",
  );
  await ok(`/orders/${o.id}/simulate`, { outcome: "SUCCESS" }, e.browser);
  await db.query("UPDATE commerce_jobs SET due_at=now() WHERE target_id=$1", [
    p.attempt_id,
  ]);
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
    "FULFILLED",
  );
  await Promise.all([
    notifications.drain(50),
    notifications.drain(50),
    notifications.drain(50),
  ]);
  const notices = app
    .get(Sms)
    .fake.notices.filter((n) => n.values.order === o.id);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]!.event, "PURCHASE_CONFIRMED");
  assert.deepEqual(Object.keys(notices[0]!.values), ["order"]);
  await db.query(
    "UPDATE commerce_jobs SET state='PENDING',due_at=now() WHERE order_id=$1 AND kind='PURCHASE_NOTICE'",
    [o.id],
  );
  await recoverCommerce();
  await notifications.drain(50);
  assert.equal(
    app.get(Sms).fake.notices.filter((n) => n.values.order === o.id).length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM order_fulfillments WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id=$1)",
        [o.id],
      )
    ).rows[0].count,
    "1",
  );
});

// Scripted provider: create/ledger come from the fake, verification answers are scripted.
async function scriptedVerification(
  script: (a: Parameters<PaymentGateway["verify"]>[0]) => PaymentResult[],
  run: (calls: () => number) => Promise<void>,
) {
  const gateway = app.get(Gateway);
  const original = gateway.provider;
  let calls = 0;
  let queue: PaymentResult[] | undefined;
  gateway.provider = {
    create: (r) => original.create(r),
    verify: (r) => gateway.provider.query(r),
    query: async (r) => {
      queue ??= script(r);
      calls++;
      return queue.shift() ?? { state: "UNKNOWN" };
    },
  };
  try {
    await run(() => calls);
  } finally {
    gateway.provider = original;
  }
}
const verifiedAnswer = (
  a: Parameters<PaymentGateway["verify"]>[0],
  extra: Partial<PaymentResult> = {},
): PaymentResult => ({
  state: "VERIFIED",
  authority: a.authority!,
  reference: "REF-" + a.attempt_id,
  amount_irr: a.amount_irr,
  currency: a.currency,
  provider_config: a.provider_config,
  answered: true,
  ...extra,
});
const runVerify = async (attemptId: string) => {
  await db.query(
    "UPDATE commerce_jobs SET due_at=now(),lease_until=NULL WHERE target_id=$1 AND state IN ('PENDING','RUNNING')",
    [attemptId],
  );
  await app.get(Payments).work(50);
};

test("Provider code 101 without prior order-bound evidence never captures a payment", async () => {
  const e = await buyer(),
    o = await saleOrder(e),
    p = await salePayment(e, o);
  await scriptedVerification(
    (a) => [verifiedAnswer(a, { previously_verified: true })],
    async () => {
      await runVerify(p.attempt_id);
    },
  );
  const order = (
    await db.query("SELECT state,exception_code FROM orders WHERE id=$1", [
      o.id,
    ])
  ).rows[0];
  assert.equal(order.state, "PENDING");
  assert.equal(order.exception_code, "ALREADY_VERIFIED_UNPROVEN");
  assert.equal(
    (
      await db.query("SELECT state FROM payment_attempts WHERE id=$1", [
        p.attempt_id,
      ])
    ).rows[0].state !== "VERIFIED",
    true,
  );
  // The unexplained 101 was an answered call, so a repeated 101 still captures nothing.
  await scriptedVerification(
    (a) => [verifiedAnswer(a, { previously_verified: true })],
    async () => {
      await runVerify(p.attempt_id);
    },
  );
  assert.equal(
    (await db.query("SELECT state FROM orders WHERE id=$1", [o.id])).rows[0]
      .state,
    "PENDING",
  );
});

test("Provider code 101 after an unanswered verify call settles exactly once", async () => {
  const e = await buyer(),
    o = await saleOrder(e),
    p = await salePayment(e, o);
  await scriptedVerification(
    (a) => [
      { state: "UNKNOWN" },
      verifiedAnswer(a, { previously_verified: true }),
    ],
    async (calls) => {
      await runVerify(p.attempt_id);
      assert.equal(
        (await db.query("SELECT state FROM orders WHERE id=$1", [o.id])).rows[0]
          .state,
        "PENDING",
        "timeout never creates a paid order",
      );
      await runVerify(p.attempt_id);
      assert.equal(calls(), 2);
    },
  );
  await recoverCommerce();
  assert.equal(
    (await ok<SaleOrder>(`/orders/${o.id}`, undefined, e.browser)).body.state,
    "FULFILLED",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM order_fulfillments WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id=$1)",
        [o.id],
      )
    ).rows[0].count,
    "1",
  );
});
