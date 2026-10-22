import "reflect-metadata";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { Database } from "../src/database/database";
import { migrate } from "../src/database/migrate";
import { seed } from "../src/database/seed";

// A core-only deployment: the public catalog and health are served, everything else is refused by
// the capability guard before any handler, provider, signing key or fixture is touched.
process.env.NODE_ENV = "test";
process.env.ENABLED_CAPABILITIES = "PRODUCTION_CORE";
process.env.COMMERCE_MODE = "disabled";
process.env.SMS_PROVIDER = "disabled";
process.env.DATABASE_URL ??=
  "postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test";
for (const [key, value] of [
  ["CODE_HMAC_KEY", "1"],
  ["TOKEN_HMAC_KEY", "2"],
  ["MFA_ENCRYPTION_KEY", "3"],
])
  process.env[key] ??= value.repeat(64);

let app: {
  close(): Promise<void>;
  getHttpServer(): import("node:http").Server;
};
let db: Database;
let root: string;
before(async () => {
  const u = new URL(process.env.DATABASE_URL!);
  assert.equal(u.pathname, "/yarizan_phase2_test");
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
  const { createApp } = await import("../src/main");
  const created = await createApp();
  await created.listen(0, "127.0.0.1");
  app = created;
  const address = created.getHttpServer().address() as { port: number };
  root = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  await app?.close();
  await db?.onApplicationShutdown();
});

const call = async (method: string, route: string, body?: unknown) => {
  const r = await fetch(root + route, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    body: (await r.json()) as {
      error: { code: string };
      [key: string]: unknown;
    },
  };
};

test("Core-only deployment serves health, readiness and the public catalog", async () => {
  assert.equal((await call("GET", "/health")).status, 200);
  assert.equal((await call("GET", "/ready")).status, 200);
  const products = await call("GET", "/api/v2/products");
  assert.equal(products.status, 200);
  const g1 = (
    products.body as unknown as { sku: string; price_irr: number }[]
  ).find((p) => p.sku === "YARIZAN-G1");
  assert.equal(g1?.price_irr, 12990000);
  const caps = await call("GET", "/api/v2/commerce/capabilities");
  assert.equal(caps.status, 200);
  assert.deepEqual(caps.body.enabled_capabilities, ["PRODUCTION_CORE"]);
  assert.equal(caps.body.checkout_enabled, false);
  assert.equal(caps.body.real_payments_enabled, false);
  assert.equal(caps.body.test_price_irr, null);
});

test("Core-only deployment refuses every disabled capability explicitly", async () => {
  for (const [method, route, body] of [
    ["POST", "/api/v2/auth/login", { username: "x", password: "y" }],
    ["POST", "/api/v2/auth/otp/request", { mobile: "09120000000" }],
    ["POST", "/api/v2/admin/auth/login", { username: "x", password: "y" }],
    ["GET", "/api/v2/admin/customers"],
    ["GET", "/api/v2/account"],
    ["POST", "/api/v2/devices/challenges", {}],
    ["POST", "/api/v2/device-pairings", {}],
    ["GET", "/api/v2/desktop/entitlements"],
    ["POST", "/api/v2/desktop/licenses/pickup", {}],
    ["POST", "/api/v2/orders", {}],
    ["POST", "/api/v2/discounts/quote", {}],
    ["POST", "/api/v2/orders/x/simulate", {}],
    ["GET", "/api/v2/payments/zarinpal/return?Authority=x&Status=OK"],
    ["POST", "/api/v2/admin/licenses/issue", {}],
  ] as [string, string, unknown?][]) {
    const r = await call(method, route, body);
    assert.equal(r.status, 503, `${method} ${route}`);
    assert.equal(
      r.body.error.code,
      "CAPABILITY_DISABLED",
      `${method} ${route}`,
    );
  }
  // No SMS or session side effect happened.
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM outbox_events")).rows[0].n,
    0,
  );
});
