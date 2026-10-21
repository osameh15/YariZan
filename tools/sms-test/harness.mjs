// Controlled, isolated MeliPayamak test harness for YariZan Admin SMS MFA (pattern 562281).
//
// Runs INSIDE the isolated test stack (tools/sms-test/compose.yaml): disposable PostgreSQL, synthetic
// Admins, independent throw-away keys, no published port beyond the container, and outbound access
// only through a relay that forwards one host (console.melipayamak.com:443). Never run against a
// real database or with production keys.
//
// Secrets and recipients are read from the operator's terminal without echo and live only in this
// process's memory. Nothing secret reaches a file, an argument, the environment, a log or the
// evidence record. Exactly ONE chargeable SMS is sent to each of two recipients.
//
//   recipient A: Admin MFA code -> wrong code rejected -> right code opens one session -> replay
//                rejected -> immediate second request throttled with no second send
//   recipient B: Admin MFA code -> wait past 180 seconds -> the right code is rejected (live expiry)
//
// CI uses `--fake-ci`: the same flow against the in-memory fake provider, no network, no prompts.
import { createRequire } from "node:module";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const fakeCi = process.argv.includes("--fake-ci");
const evidenceDir = process.env.EVIDENCE_DIR ?? "/evidence";
const root = process.env.BACKEND_ROOT ?? "/app";
// The harness file lives outside the backend tree: resolve dependencies from the backend install.
createRequire(path.join(root, "package.json"))("reflect-metadata");
const hex = () => randomBytes(32).toString("hex");

// ---- environment: disposable database and independent throw-away keys ---------------------------
process.env.NODE_ENV = "test";
process.env.COMMERCE_MODE = "disabled";
process.env.SMS_PROVIDER = "fake";
process.env.SMS_ALLOW_LIVE = "false";
for (const key of [
  "MOBILE_ENCRYPTION_KEY",
  "OTP_HMAC_KEY",
  "CODE_HMAC_KEY",
  "TOKEN_HMAC_KEY",
  "MFA_ENCRYPTION_KEY",
])
  process.env[key] = hex();
delete process.env.MELIPAYAMAK_API_TOKEN;
process.env.BROWSER_ORIGIN = "http://127.0.0.1:3100";
const dbUrl = new URL(process.env.DATABASE_URL ?? "");
const allowedDatabases = fakeCi
  ? ["yarizan_phase2_test", "yarizan_sms_test"]
  : ["yarizan_sms_test"];
if (!allowedDatabases.includes(dbUrl.pathname.slice(1)))
  throw new Error(
    "Refusing: this harness only touches its own disposable database",
  );
if (!["db", "localhost", "127.0.0.1"].includes(dbUrl.hostname))
  throw new Error("Refusing: disposable database host required");

const load = (file) =>
  import(pathToFileURL(path.join(root, "dist", "src", file)).href);
const { createApp } = await load("main.js");
const { Database } = await load("database/database.js");
const { migrate } = await load("database/migrate.js");
const { seed } = await load("database/seed.js");
const { Sms, MeliPayamakSharedProvider, MELIPAYAMAK_HOST } =
  await load("accounts/sms.js");
const { seal } = await load("security/crypto.js");
const { hashPassword } = await load("security/passwords.js");

// ---- terminal prompts (no echo, TTY only) -------------------------------------------------------
let rl;
let muted = false;
function terminal() {
  if (rl) return rl;
  if (!(process.stdin.isTTY && process.stdout.isTTY))
    throw new Error("An interactive terminal is required (run with a TTY).");
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const original = rl._writeToOutput;
  rl._writeToOutput = (text) => original.call(rl, muted ? "" : text);
  return rl;
}
const say = (text) => process.stdout.write(text + "\n");
const ask = (question, hidden = false) =>
  new Promise((resolve) => {
    const r = terminal();
    // The question goes through readline itself so it stays on screen; only the typed answer is muted.
    r.question(question, (answer) => {
      muted = false;
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
    muted = hidden;
  });
// Only a literal "y" or "yes" confirms. Anything else is a refusal and nothing is sent.
const yes = async (question) => {
  for (;;) {
    const answer = (
      await ask(question + " Type y or n, then Enter: ")
    ).toLowerCase();
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no", ""].includes(answer)) return false;
    say("Please type y or n.");
  }
};

// ---- evidence (redacted): no token, no phone number, no code ------------------------------------
const evidence = {
  harness: "yarizan-admin-sms-mfa-v1",
  mode: fakeCi ? "fake-ci" : "live",
  started_at: new Date().toISOString(),
  pattern_body_id: 562281,
  owner_panel_check: null,
  provider: { calls: 0, responses: [] },
  recipients: {},
  summary: {},
};
// The provider's status text (Persian or English words) is not secret and is exactly what is needed to
// understand a rejection; digits runs long enough to be a number or code are masked.
const safeStatus = (value) =>
  typeof value === "string" &&
  value.length <= 120 &&
  /^[\p{L}\p{N} _.:,;()\-]+$/u.test(value)
    ? value.replace(/[0-9]{6,}/g, "[digits]")
    : "[non-simple value]";
// Records only the SHAPE of a provider response, then hands the untouched response on.
function recordingTransport(real) {
  return async (url, init) => {
    const target = String(url);
    if (!target.startsWith(`https://${MELIPAYAMAK_HOST}/api/send/shared/`))
      throw new Error("Outbound destination refused");
    evidence.provider.calls++;
    const response = await real(url, init);
    let body = {};
    try {
      body = JSON.parse((await response.clone().text()).slice(0, 8192));
    } catch {
      /* non-JSON answer: recorded as such below */
    }
    const rec = body?.recId;
    if (!fakeCi)
      say(
        `Provider answered HTTP ${response.status}` +
          (body?.status === undefined
            ? ""
            : `, status: ${safeStatus(body.status)}`) +
          (rec === undefined ? ", no recId" : ", recId received"),
      );
    evidence.provider.responses.push({
      http_status: response.status,
      status_value:
        body?.status === undefined ? "[absent]" : safeStatus(body.status),
      status_type: typeof body?.status,
      recId_type: typeof rec,
      recId_digits: rec === undefined ? 0 : String(rec).length,
      keys: Object.keys(body ?? {})
        .filter((k) => /^[A-Za-z]{1,24}$/.test(k))
        .sort(),
    });
    return response;
  };
}

// ---- boot the disposable stack ------------------------------------------------------------------
process.chdir(root);
const db = new Database();
await db.query("DROP SCHEMA public CASCADE");
await db.query("CREATE SCHEMA public");
await migrate(db);
await seed(db);
const app = await createApp();
await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v2`;
const sms = app.get(Sms);
let sent = 0;

async function post(route, body) {
  const r = await fetch(base + route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.BROWSER_ORIGIN,
    },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get("set-cookie"),
  };
}
const sessions = async () =>
  (await db.query("SELECT count(*)::int n FROM admin_sessions")).rows[0].n;
async function syntheticAdmin(label, mobile) {
  const id = randomUUID();
  const username = `sms-test-${label}`;
  const secret = "Syn-" + randomBytes(12).toString("base64url") + "!9a";
  await db.query(
    "INSERT INTO admins(id,username,password_hash,mfa_ciphertext,mobile_ciphertext,mobile_last4) VALUES($1,$2,$3,$4,$5,$6)",
    [
      id,
      username,
      await hashPassword(secret),
      seal(randomBytes(20).toString("hex"), process.env.MFA_ENCRYPTION_KEY),
      seal(mobile, process.env.MOBILE_ENCRYPTION_KEY),
      mobile.slice(-4),
    ],
  );
  await db.query(
    "INSERT INTO admin_user_roles(admin_id,role) VALUES($1,'owner')",
    [id],
  );
  return { id, username, secret };
}
async function fakeCode(challengeId) {
  for (let n = 0; n < 300; n++) {
    const code = sms.fake.codeFor(challengeId);
    const delivered = (
      await db.query("SELECT delivered FROM otp_challenges WHERE id=$1", [
        challengeId,
      ])
    ).rows[0]?.delivered;
    if (code && delivered) return code;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("fake delivery did not complete");
}
async function waitDelivered(challengeId) {
  for (let n = 0; n < 600; n++) {
    const row = (
      await db.query("SELECT delivered FROM otp_challenges WHERE id=$1", [
        challengeId,
      ])
    ).rows[0];
    if (row?.delivered) return true;
    // A provider refusal is audited at once: stop waiting instead of idling for the full minute.
    const failed = await db.query(
      "SELECT 1 FROM audit_logs WHERE action='otp.delivery_unavailable' AND entity_id=$1",
      [challengeId],
    );
    if (failed.rowCount) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

let exitCode = 0;
try {
  let recipientA, recipientB;
  if (fakeCi) {
    recipientA = "09100000011";
    recipientB = "09100000012";
    evidence.owner_panel_check = "not-applicable-fake-ci";
  } else {
    say(
      "YariZan isolated Admin SMS MFA test. Exactly two chargeable SMS will be sent.",
    );
    say(
      "Open the provider panel yourself and compare pattern 562281 before continuing.",
    );
    say(
      "Expected text: یاریزان: کد تایید ورود به پنل مدیریت شما: {0} اعتبار: ۳ دقیقه. این کد محرمانه است و نباید در اختیار دیگران قرار بگیرد.",
    );
    const panel = await yes(
      "Pattern 562281 is approved and its Body ID and wording are unchanged?",
    );
    evidence.owner_panel_check = {
      confirmed: panel,
      at: new Date().toISOString(),
    };
    if (!panel) throw new Error("Panel check not confirmed; nothing was sent.");
    const token = await ask("MeliPayamak console API token (hidden): ", true);
    recipientA = await ask("Recipient A mobile (hidden): ", true);
    recipientB = await ask("Recipient B mobile (hidden): ", true);
    if (
      !/^[0-9]{11}$/.test(recipientA) ||
      !/^[0-9]{11}$/.test(recipientB) ||
      recipientA === recipientB
    )
      throw new Error("Two different 11-digit mobile numbers are required.");
    // Test-only: the registry keeps textConfirmed=false until a reviewed change records this panel check.
    sms.provider = new MeliPayamakSharedProvider(
      token,
      recordingTransport(fetch),
      false,
    );
    // Reachability and certificate check through the relay (no message is sent).
    const probe = await fetch(`https://${MELIPAYAMAK_HOST}/`, {
      signal: AbortSignal.timeout(15000),
    }).then(
      (r) => r.status,
      () => 0,
    );
    evidence.provider.reachable = probe !== 0;
    if (!probe)
      throw new Error(
        "The provider is not reachable through the restricted relay.",
      );
  }
  const original = sms.provider.send.bind(sms.provider);
  sms.provider.send = async (m) => {
    sent++;
    return original(m);
  };

  // ---------- recipient A: real code, wrong code, success, replay, throttle ----------
  const a = await syntheticAdmin("a", recipientA);
  const resultA = { sends: 0 };
  evidence.recipients.A = resultA;
  const loginA = await post("/admin/auth/login", {
    username: a.username,
    password: a.secret,
  });
  resultA.request_status = loginA.status;
  resultA.expires_in = loginA.body.expires_in;
  if (loginA.status !== 201)
    throw new Error("Admin login request failed: " + loginA.status);
  const delivered = await waitDelivered(loginA.body.challenge_id);
  resultA.provider_accepted = delivered;
  resultA.sends = sent;
  resultA.sessions_before_proof = await sessions();
  if (!fakeCi && !delivered)
    throw new Error(
      "The provider did not accept request A (see the provider line above). Nothing more was sent.",
    );
  if (!fakeCi) {
    say("The provider accepted request A.");
    resultA.handset_received = await yes(
      "Did recipient A's handset receive the SMS?",
    );
  } else resultA.handset_received = "not-applicable-fake-ci";
  const codeA = fakeCi
    ? await fakeCode(loginA.body.challenge_id)
    : await ask("Enter the code received on A (hidden): ", true);
  const wrong = /^0+$/.test(codeA) ? "111111" : "000000";
  const bad = await post("/admin/auth/sms/verify", {
    challenge_id: loginA.body.challenge_id,
    code: wrong,
  });
  resultA.wrong_code = { status: bad.status, error: bad.body?.error?.code };
  resultA.sessions_after_wrong_code = await sessions();
  const good = await post("/admin/auth/sms/verify", {
    challenge_id: loginA.body.challenge_id,
    code: codeA,
  });
  resultA.right_code = {
    status: good.status,
    session_cookie_set: !!good.cookie,
  };
  resultA.sessions_after_right_code = await sessions();
  const replay = await post("/admin/auth/sms/verify", {
    challenge_id: loginA.body.challenge_id,
    code: codeA,
  });
  resultA.replay = { status: replay.status, error: replay.body?.error?.code };
  resultA.sessions_after_replay = await sessions();
  const again = await post("/admin/auth/login", {
    username: a.username,
    password: a.secret,
  });
  resultA.second_request = {
    status: again.status,
    error: again.body?.error?.code,
  };
  resultA.sends_after_second_request = sent;

  // ---------- recipient B: real code that is allowed to expire ----------
  const b = await syntheticAdmin("b", recipientB);
  const resultB = { sends: 0 };
  evidence.recipients.B = resultB;
  const loginB = await post("/admin/auth/login", {
    username: b.username,
    password: b.secret,
  });
  resultB.request_status = loginB.status;
  resultB.expires_in = loginB.body.expires_in;
  if (loginB.status !== 201)
    throw new Error("Admin login request B failed: " + loginB.status);
  resultB.provider_accepted = await waitDelivered(loginB.body.challenge_id);
  if (!fakeCi && !resultB.provider_accepted)
    throw new Error(
      "The provider did not accept request B (see the provider line above). Nothing more was sent.",
    );
  resultB.sends = sent - resultA.sends_after_second_request;
  resultB.lifetime_seconds = Number(
    (
      await db.query(
        "SELECT extract(epoch FROM expires_at-created_at) s FROM otp_challenges WHERE id=$1",
        [loginB.body.challenge_id],
      )
    ).rows[0].s,
  );
  if (!fakeCi) {
    resultB.handset_received = await yes(
      "Did recipient B's handset receive the SMS?",
    );
    say(
      "Do NOT enter the code yet. Waiting until the code has expired (180 seconds)...",
    );
  } else {
    resultB.handset_received = "not-applicable-fake-ci";
    // Deterministic stand-in for the wait: move the challenge into the past on the database clock.
    await db.query(
      "UPDATE otp_challenges SET created_at=now()-interval '181 seconds',expires_at=now()-interval '1 second' WHERE id=$1",
      [loginB.body.challenge_id],
    );
  }
  for (;;) {
    const left = Number(
      (
        await db.query(
          "SELECT extract(epoch FROM expires_at-clock_timestamp()) s FROM otp_challenges WHERE id=$1",
          [loginB.body.challenge_id],
        )
      ).rows[0].s,
    );
    if (left <= -1) break;
    if (!fakeCi)
      process.stdout.write(
        `\r  ${Math.max(0, Math.ceil(left + 1))} s remaining   `,
      );
    await new Promise((r) => setTimeout(r, fakeCi ? 10 : 1000));
  }
  if (!fakeCi) process.stdout.write("\n");
  const codeB = fakeCi
    ? await fakeCode(loginB.body.challenge_id)
    : await ask("Now enter the (expired) code received on B (hidden): ", true);
  const late = await post("/admin/auth/sms/verify", {
    challenge_id: loginB.body.challenge_id,
    code: codeB,
  });
  resultB.late_code = { status: late.status, error: late.body?.error?.code };
  resultB.sessions_total = await sessions();

  evidence.summary = {
    total_chargeable_sends: sent,
    provider_calls: evidence.provider.calls,
    admin_mfa_success:
      good.status === 201 &&
      resultA.sessions_after_wrong_code === 0 &&
      resultA.sessions_after_right_code === 1,
    wrong_code_rejected: bad.status === 401,
    replay_rejected:
      replay.status === 401 && resultA.sessions_after_replay === 1,
    throttled_without_send:
      again.status === 429 && resultA.sends_after_second_request === 1,
    expiry_rejected: late.status === 401 && resultB.sessions_total === 1,
    lifetime_exactly_180:
      resultB.lifetime_seconds === 180 && loginA.body.expires_in === 180,
    no_session_before_proof: resultA.sessions_before_proof === 0,
  };
  const all = Object.values(evidence.summary).filter(
    (v) => typeof v === "boolean",
  );
  evidence.summary.all_checks_passed = all.every(Boolean);
  if (!evidence.summary.all_checks_passed) exitCode = 1;
  if (!fakeCi && evidence.summary.total_chargeable_sends !== 2) exitCode = 1;
} catch (error) {
  evidence.error =
    error instanceof Error
      ? error.message.replace(/[0-9]{9,}/g, "[number]")
      : "failed";
  exitCode = 1;
} finally {
  evidence.finished_at = new Date().toISOString();
  rl?.close();
  try {
    await mkdir(evidenceDir, { recursive: true });
    const file = path.join(
      evidenceDir,
      `sms-test-${evidence.mode}-${Date.now()}.json`,
    );
    await writeFile(file, JSON.stringify(evidence, null, 2) + "\n", {
      mode: 0o600,
    });
    say(`Redacted evidence: ${file}`);
    say(JSON.stringify(evidence.summary));
  } catch {
    say("The evidence record could not be written.");
  }
  await app.close().catch(() => {});
  await db.query("DROP SCHEMA public CASCADE").catch(() => {});
  await db.query("CREATE SCHEMA public").catch(() => {});
  await db.onApplicationShutdown().catch(() => {});
}
process.exit(exitCode);
