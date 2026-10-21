import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";

// The isolated SMS harness (tools/sms-test) must work end to end in fake mode, refuse to send in live
// mode without an interactive terminal, and never record a secret. Uses a disposable database only.
const repo = path.resolve("..");
const harness = path.join(repo, "tools", "sms-test", "harness.mjs");
const name = "yarizan_sms_test";
const admin = new URL(
  process.env.DATABASE_URL ??
    "postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test",
);
const url = new URL(admin);
url.pathname = "/" + name;
let evidenceDir = "";

before(async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(admin.hostname));
  const pool = new Pool({
    connectionString: new URL("/postgres", admin).toString(),
  });
  if (
    !(await pool.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount
  )
    await pool.query(`CREATE DATABASE ${name}`);
  await pool.end();
  evidenceDir = await mkdtemp(path.join(tmpdir(), "yz-sms-evidence-"));
});
after(async () => {
  await rm(evidenceDir, { recursive: true, force: true });
});
const run = (args: string[], databaseUrl = url.toString()) =>
  spawnSync(process.execPath, [harness, ...args], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      BACKEND_ROOT: process.cwd(),
      EVIDENCE_DIR: evidenceDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 180000,
  });

test("fake-ci run proves Admin MFA, wrong code, replay, throttling and expiry with exactly one send per recipient", async () => {
  const r = run(["--fake-ci"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const file = (await readdir(evidenceDir)).find((f) =>
    f.startsWith("sms-test-fake-ci-"),
  );
  assert.ok(file);
  const raw = await readFile(path.join(evidenceDir, file), "utf8");
  const e = JSON.parse(raw);
  assert.equal(e.mode, "fake-ci");
  assert.equal(e.pattern_body_id, 562281);
  assert.equal(e.summary.all_checks_passed, true);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(e.summary).filter(([k]) => k !== "all_checks_passed"),
    ),
    {
      total_chargeable_sends: 2,
      provider_calls: 0,
      admin_mfa_success: true,
      wrong_code_rejected: true,
      replay_rejected: true,
      throttled_without_send: true,
      expiry_rejected: true,
      lifetime_exactly_180: true,
      no_session_before_proof: true,
    },
  );
  assert.equal(e.recipients.A.wrong_code.error, "OTP_INVALID");
  assert.equal(e.recipients.A.second_request.error, "RATE_LIMITED");
  assert.equal(e.recipients.B.late_code.error, "OTP_INVALID");
  assert.equal(e.recipients.A.sessions_after_wrong_code, 0);
  assert.equal(e.recipients.A.sessions_after_right_code, 1);
  // Nothing identifying or secret reaches the evidence or the output.
  const everything = raw + r.stdout + r.stderr;
  assert.ok(!/09[0-9]{9}/.test(everything), "no phone number");
  assert.ok(!/"(code|token|mobile|phone|password|secret)"/i.test(raw));
  assert.ok(!/console\.melipayamak\.com\/api\/send\/shared\//.test(everything));
});

test("live mode refuses to send without an interactive terminal and records no provider call", async () => {
  const r = run([]);
  assert.notEqual(r.status, 0);
  const file = (await readdir(evidenceDir)).find((f) =>
    f.startsWith("sms-test-live-"),
  );
  assert.ok(file);
  const e = JSON.parse(await readFile(path.join(evidenceDir, file), "utf8"));
  assert.equal(e.mode, "live");
  assert.equal(e.provider.calls, 0);
  assert.match(e.error, /interactive terminal/);
  assert.equal(e.summary.total_chargeable_sends, undefined);
});

test("the harness only touches its own disposable database", () => {
  const other = new URL(url);
  other.pathname = "/yarizan_production";
  const r = run(["--fake-ci"], other.toString());
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Refusing/);
  const remote = new URL(url);
  remote.hostname = "db.example.invalid";
  assert.notEqual(run(["--fake-ci"], remote.toString()).status, 0);
});

test("the isolated stack has no published ports, an internal network and a single-host relay", async () => {
  const compose = await readFile(
    path.join(repo, "tools", "sms-test", "compose.yaml"),
    "utf8",
  );
  assert.ok(!/^\s*ports:/m.test(compose), "no published ports");
  assert.match(compose, /internal:\s*\n\s+internal: true/);
  assert.ok(
    !/MELIPAYAMAK_API_TOKEN|api.?token\s*[:=]/i.test(compose),
    "no token in the compose file",
  );
  const relay = await readFile(
    path.join(repo, "tools", "sms-test", "relay.conf"),
    "utf8",
  );
  assert.equal((relay.match(/proxy_pass /g) ?? []).length, 1);
  assert.match(relay, /set \$vendor console\.melipayamak\.com;/);
  assert.ok(!/ssl_/.test(relay), "the relay never terminates TLS");
  const source = await readFile(harness, "utf8");
  assert.match(source, /Outbound destination refused/);
  assert.match(source, /console\.melipayamak\.com/);
});
