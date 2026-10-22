import "reflect-metadata";
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { createApp } from "../src/main";
import { Database } from "../src/database/database";
import { migrate } from "../src/database/migrate";
import { seed, permissions } from "../src/database/seed";
import { Sms } from "../src/accounts/sms";
import {
  AdminEnrollment,
  validateIdentity,
  ownerEnrollmentLimit,
} from "../src/admin/enrollment";
import { ApiError } from "../src/common/errors";

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

// Synthetic identities only. Nothing here is a real person, phone or password.
const one = {
  username: "synthetic-owner-one",
  password: "Quartz!Meadow7-Harbor-Lamp",
  mobile: "09100000001",
};
const two = {
  username: "synthetic-owner-two",
  password: "Willow$Canyon4-Ember-Drift",
  mobile: "09100000002",
};
const system = () => ({ type: "SYSTEM" as const, correlationId: randomUUID() });
let app: Awaited<ReturnType<typeof createApp>>,
  db: Database,
  enrollment: AdminEnrollment,
  base: string;

async function post(route: string, body: unknown) {
  const r = await fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    body: (await r.json()) as Record<string, unknown> & {
      error?: { code?: string };
      expires_in?: number;
      challenge_id?: string;
    },
  };
}
async function codeFor(id: string) {
  for (let n = 0; n < 200; n++) {
    const code = app.get(Sms).fake.codeFor(id);
    const delivered = (
      await db.query("SELECT delivered FROM otp_challenges WHERE id=$1", [id])
    ).rows[0]?.delivered;
    if (code && delivered) return code;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw Error("Fake delivery did not complete");
}
async function rejects(work: Promise<unknown>, code: string) {
  await assert.rejects(
    work,
    (e: unknown) => e instanceof ApiError && e.code === code,
  );
}
const row = async (username: string) =>
  (await db.query("SELECT * FROM admins WHERE username=$1", [username]))
    .rows[0];

before(async () => {
  const u = new URL(process.env.DATABASE_URL!);
  assert.equal(
    u.pathname,
    "/yarizan_phase2_test",
    "Tests only touch the disposable database",
  );
  const p = new Pool({ connectionString: new URL("/postgres", u).toString() });
  if (
    !(
      await p.query(
        "SELECT 1 FROM pg_database WHERE datname='yarizan_phase2_test'",
      )
    ).rowCount
  )
    await p.query("CREATE DATABASE yarizan_phase2_test");
  await p.end();
  db = new Database();
  await db.query("DROP SCHEMA public CASCADE");
  await db.query("CREATE SCHEMA public");
  await migrate(db);
  await seed(db);
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}/api/v2`;
  enrollment = app.get(AdminEnrollment);
});
beforeEach(async () => {
  await db.query("DELETE FROM rate_buckets");
});
after(async () => {
  await app?.close();
  await db?.onApplicationShutdown();
});

test("Identity validation rejects phone-like usernames and weak passwords", () => {
  for (const username of [
    "09100000001",
    "owner09100000001",
    "a",
    "Has Space",
    "UPPER-case",
  ])
    assert.throws(
      () => validateIdentity({ ...one, username }),
      ApiError,
      username,
    );
  for (const password of [
    "short",
    "alllowercaseallowercase1!",
    "NoDigitsHere-Password!",
    "Xx-synthetic-owner-one-9!",
  ])
    assert.throws(
      () => validateIdentity({ ...one, password }),
      ApiError,
      password,
    );
  assert.equal(validateIdentity(one), "09100000001");
});

test("Exactly two independent pending owners are created with no role and no login", async () => {
  const a = await enrollment.provision(one, system());
  const b = await enrollment.provision(two, system());
  assert.deepEqual(
    [a.state, b.state, a.created, b.created],
    ["PENDING", "PENDING", true, true],
  );
  assert.notEqual(a.admin_id, b.admin_id);
  for (const input of [one, two]) {
    const r = await row(input.username);
    assert.equal(r.enrollment_state, "PENDING");
    assert.equal(r.disabled, true);
    assert.match(r.password_hash, /^\$argon2id\$/);
    // The phone is stored only encrypted plus a keyed lookup; the password only as a hash.
    const dump = JSON.stringify(r);
    assert.ok(!dump.includes(input.mobile) && !dump.includes(input.password));
    assert.match(r.mobile_lookup, /^[a-f0-9]{64}$/);
    assert.equal(r.mobile_last4, input.mobile.slice(-4));
    assert.equal(
      (
        await db.query("SELECT 1 FROM admin_user_roles WHERE admin_id=$1", [
          r.id,
        ])
      ).rowCount,
      0,
    );
  }
  assert.notEqual(
    (await row(one.username)).password_hash,
    (await row(two.username)).password_hash,
  );
  assert.notEqual(
    (await row(one.username)).mobile_lookup,
    (await row(two.username)).mobile_lookup,
  );
});

test("A pending Admin cannot log in and holds no role (API and database)", async () => {
  const before = (
    await db.query("SELECT count(*)::int AS n FROM otp_challenges")
  ).rows[0].n;
  const login = await post("/admin/auth/login", {
    username: one.username,
    password: one.password,
  });
  assert.equal(login.status, 401);
  assert.equal(login.body.error?.code, "INVALID_CREDENTIALS");
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM otp_challenges")).rows[0].n,
    before,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    0,
  );
  await assert.rejects(
    db.query("INSERT INTO admin_user_roles(admin_id,role) VALUES($1,'owner')", [
      (await row(one.username)).id,
    ]),
    /pending Admin cannot hold a role/,
  );
});

test("Enrollment rejects wrong passwords, wrong, foreign, expired and replayed codes", async () => {
  await rejects(
    enrollment.begin(one.username, "Wrong-Password-1234!", system()),
    "INVALID_CREDENTIALS",
  );
  await rejects(
    enrollment.begin("synthetic-nobody", one.password, system()),
    "INVALID_CREDENTIALS",
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM otp_challenges")).rows[0].n,
    0,
  );

  const first = await enrollment.begin(one.username, one.password, system());
  assert.equal(first.expires_in, 180);
  const stored = (
    await db.query(
      "SELECT extract(epoch FROM expires_at-created_at) AS secs FROM otp_challenges WHERE id=$1",
      [first.challenge_id],
    )
  ).rows[0];
  assert.equal(Number(stored.secs), 180, "OTP lifetime is exactly 180 seconds");
  const firstCode = await codeFor(first.challenge_id);
  const wrong = firstCode === "000000" ? "000001" : "000000";
  await rejects(
    enrollment.complete(first.challenge_id, wrong, system()),
    "OTP_INVALID",
  );
  assert.equal((await row(one.username)).enrollment_state, "PENDING");

  // A code issued for the other Admin's challenge cannot complete this one.
  await db.query("DELETE FROM rate_buckets");
  const other = await enrollment.begin(two.username, two.password, system());
  const otherCode = await codeFor(other.challenge_id);
  if (otherCode !== firstCode)
    await rejects(
      enrollment.complete(first.challenge_id, otherCode, system()),
      "OTP_INVALID",
    );
  await rejects(
    enrollment.complete(randomUUID(), otherCode, system()),
    "OTP_INVALID",
  );

  // Expiry uses database time: an expired challenge is refused even with the right code.
  await db.query(
    "UPDATE otp_challenges SET created_at=now()-interval '4 minutes',expires_at=now()-interval '1 minute' WHERE id=$1",
    [first.challenge_id],
  );
  await rejects(
    enrollment.complete(first.challenge_id, firstCode, system()),
    "OTP_INVALID",
  );
  assert.equal((await row(one.username)).enrollment_state, "PENDING");
  assert.equal((await row(two.username)).enrollment_state, "PENDING");
});

test("Each Admin activates only through its own code; no session is created; replay fails", async () => {
  await db.query("DELETE FROM rate_buckets");
  const a = await enrollment.begin(one.username, one.password, system());
  const codeA = await codeFor(a.challenge_id);
  const done = await enrollment.complete(a.challenge_id, codeA, system());
  assert.deepEqual([done.state, done.role], ["ACTIVE", "owner"]);
  assert.equal((await row(one.username)).disabled, false);
  assert.equal(
    (await row(two.username)).enrollment_state,
    "PENDING",
    "the second Admin is untouched",
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    0,
    "enrollment creates no session",
  );
  await rejects(
    enrollment.complete(a.challenge_id, codeA, system()),
    "OTP_INVALID",
  );

  await db.query("DELETE FROM rate_buckets");
  const b = await enrollment.begin(two.username, two.password, system());
  const doneB = await enrollment.complete(
    b.challenge_id,
    await codeFor(b.challenge_id),
    system(),
  );
  assert.equal(doneB.state, "ACTIVE");
  assert.notEqual(done.admin_id, doneB.admin_id);
});

test("Both owners hold the complete permission set and others never gain it", async () => {
  const report = await enrollment.report();
  assert.equal(report.admins.length, 2);
  for (const admin of report.admins) {
    assert.equal(admin.state, "ACTIVE");
    assert.equal(admin.can_log_in, true);
    assert.deepEqual(admin.roles, ["owner"]);
    assert.equal(admin.permissions, permissions.length);
    assert.equal(admin.permissions_expected, permissions.length);
    assert.equal(admin.complete_owner, true);
  }
  const owned = async (username: string) =>
    (
      await db.query(
        "SELECT DISTINCT rp.permission FROM admins a JOIN admin_user_roles ur ON ur.admin_id=a.id JOIN admin_role_permissions rp ON rp.role=ur.role WHERE a.username=$1 ORDER BY 1",
        [username],
      )
    ).rows.map((r) => r.permission);
  const all = (
    await db.query("SELECT name FROM admin_permissions ORDER BY 1")
  ).rows.map((r) => r.name);
  assert.deepEqual(await owned(one.username), all);
  assert.deepEqual(await owned(two.username), all);
  // Other roles stay narrower than owner.
  const roleCounts = (
    await db.query(
      "SELECT role,count(*)::int AS n FROM admin_role_permissions GROUP BY role",
    )
  ).rows;
  for (const r of roleCounts.filter((x) => x.role !== "owner"))
    assert.ok(r.n < all.length, r.role);
  // The report never carries a phone, hash, code or secret.
  const text = JSON.stringify(report);
  for (const secret of [
    one.mobile,
    two.mobile,
    one.password,
    "argon2",
    "ciphertext",
    "lookup",
  ])
    assert.ok(!text.includes(secret), secret);
});

test("An activated owner logs in only with password then SMS MFA, never a TOTP fallback", async () => {
  await db.query("DELETE FROM rate_buckets");
  const bad = await post("/admin/auth/login", {
    username: one.username,
    password: "Wrong-Password-1234!",
  });
  assert.equal(bad.status, 401);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    0,
  );
  const sent = await post("/admin/auth/login", {
    username: one.username,
    password: one.password,
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.expires_in, 180);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    0,
    "no session before MFA",
  );
  const wrong = await post("/admin/auth/sms/verify", {
    challenge_id: sent.body.challenge_id,
    code: "000000",
  });
  assert.equal(wrong.status, 401);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    0,
  );
  const code = await codeFor(sent.body.challenge_id!);
  const ok = await post("/admin/auth/sms/verify", {
    challenge_id: sent.body.challenge_id,
    code,
  });
  assert.equal(ok.status, 201);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    1,
  );
  const replay = await post("/admin/auth/sms/verify", {
    challenge_id: sent.body.challenge_id,
    code,
  });
  assert.equal(replay.status, 401);
  const totp = await post("/admin/auth/login", {
    username: one.username,
    password: one.password,
    totp: "123456",
  });
  assert.ok([200, 400].includes(totp.status));
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM admin_sessions")).rows[0].n,
    1,
    "a TOTP field opens nothing",
  );
});

test("Customer or forged credentials never reach Admin routes or change Admin roles", async () => {
  const count = async (sql: string) =>
    (await db.query(sql)).rows[0].n as number;
  const roles = await count("SELECT count(*)::int AS n FROM admin_user_roles");
  const sessions = await count("SELECT count(*)::int AS n FROM admin_sessions");
  const token = () => randomUUID().replace(/-/g, "").padEnd(43, "x");
  for (const cookie of [
    "",
    `yz_customer=${token()}`,
    `yz_admin=${token()}`,
    `yz_customer=${token()}; yz_csrf_customer=${token()}`,
  ])
    for (const [method, route] of [
      ["GET", "/admin/commerce/finance"],
      ["GET", "/admin/customers"],
      ["GET", "/admin/auth/session"],
      ["POST", "/admin/products/YARIZAN-G1/promotions"],
    ]) {
      const r = await fetch(base + route, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(method === "POST" ? { body: "{}" } : {}),
      });
      // Reads are refused as unauthenticated; a write may already fail validation. Never a success.
      assert.ok(
        method === "GET"
          ? r.status === 401
          : [400, 401, 403].includes(r.status),
        `${method} ${route} with ${cookie || "no"} cookie: ${r.status}`,
      );
    }
  assert.equal(
    await count("SELECT count(*)::int AS n FROM admin_user_roles"),
    roles,
  );
  assert.equal(
    await count("SELECT count(*)::int AS n FROM admin_sessions"),
    sessions,
  );
});

test("Rerunning is idempotent and conflicting identities fail safely", async () => {
  const before = await row(one.username);
  const auditBefore = (
    await db.query(
      "SELECT count(*)::int AS n FROM audit_logs WHERE action='admin.enrollment_created'",
    )
  ).rows[0].n;
  const again = await enrollment.provision(one, system());
  assert.deepEqual(
    [again.created, again.state, again.admin_id],
    [false, "ACTIVE", before.id],
  );
  // A different password in a rerun never resets the stored one.
  await enrollment.provision(
    { ...one, password: "Another-Synthetic-Pw3!" },
    system(),
  );
  const after = await row(one.username);
  assert.equal(after.password_hash, before.password_hash);
  assert.equal(after.mobile_ciphertext, before.mobile_ciphertext);
  assert.equal(after.enrolled_at.getTime(), before.enrolled_at.getTime());
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE action='admin.enrollment_created'",
      )
    ).rows[0].n,
    auditBefore,
  );
  // Same username with another phone, and another username with the same phone, are refused.
  await rejects(
    enrollment.provision({ ...one, mobile: "09100000003" }, system()),
    "ENROLLMENT_CONFLICT",
  );
  await rejects(
    enrollment.provision(
      { ...one, username: "synthetic-owner-three" },
      system(),
    ),
    "ENROLLMENT_CONFLICT",
  );
  // A third distinct identity exceeds the enrollment limit.
  assert.equal(ownerEnrollmentLimit, 2);
  await rejects(
    enrollment.provision(
      {
        username: "synthetic-owner-three",
        password: "Cobalt#Orchard5-Violet-Gate",
        mobile: "09100000003",
      },
      system(),
    ),
    "ENROLLMENT_LIMIT",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM admins WHERE mobile_lookup IS NOT NULL",
      )
    ).rows[0].n,
    2,
  );
});

test("Creation, verification, activation and role assignment are audited per Admin without secrets", async () => {
  for (const input of [one, two]) {
    const admin = await row(input.username);
    const trail = (
      await db.query(
        "SELECT action,actor_type,actor_id,metadata_redacted FROM audit_logs WHERE entity_id=$1 ORDER BY created_at,id",
        [admin.id],
      )
    ).rows;
    const actions = trail.map((r) => r.action);
    for (const action of [
      "admin.enrollment_created",
      "admin.enrollment_verified",
      "admin.activated",
      "admin.role_assigned",
    ])
      assert.ok(actions.includes(action), `${input.username} ${action}`);
    const verified = trail.find(
      (r) => r.action === "admin.enrollment_verified",
    );
    assert.ok(verified);
    assert.equal(verified.actor_type, "ADMIN");
    assert.equal(
      verified.actor_id,
      admin.id,
      "the Admin attests to its own phone",
    );
  }
  const everything =
    JSON.stringify((await db.query("SELECT * FROM audit_logs")).rows) +
    JSON.stringify(
      (await db.query("SELECT payload_redacted FROM outbox_events")).rows,
    );
  for (const secret of [one.mobile, two.mobile, one.password, two.password])
    assert.ok(!everything.includes(secret));
  assert.ok(!/"code"\s*:\s*"[0-9]{6}"/.test(everything));
});

test("Only the reviewed enrollment path writes Admin role assignments", async () => {
  const root = path.resolve("src");
  const files: string[] = [];
  const walk = async (dir: string) => {
    for (const e of await readdir(dir, { withFileTypes: true }))
      if (e.isDirectory()) await walk(path.join(dir, e.name));
      else files.push(path.join(dir, e.name));
  };
  await walk(root);
  const writers: string[] = [];
  for (const f of files.filter((x) => x.endsWith(".ts")))
    if (/INTO\s+admin_user_roles/i.test(await readFile(f, "utf8")))
      writers.push(path.relative(root, f).replace(/\\/g, "/"));
  assert.deepEqual(writers.sort(), ["admin/enrollment.ts"]);
});

test("The operator tool refuses to run without an interactive terminal", () => {
  const r = spawnSync(
    process.execPath,
    ["tools/admin-enroll.mjs", "provision"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  assert.equal(r.status, 2);
  assert.match(r.stderr, /interactive terminal/);
  assert.ok(!r.stdout.includes("Password"));
});
