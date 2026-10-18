import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool, PoolClient } from "pg";
import { approvedPricing } from "../src/catalog/approved-pricing";
import { migrate } from "../src/database/migrate";
import {
  initializePricing,
  productionBootstrap,
} from "../src/database/production-bootstrap";

// Each scenario uses its own disposable database next to yarizan_phase2_test.
const base = new URL(process.env.DATABASE_URL!);
assert.equal(
  base.pathname,
  "/yarizan_phase2_test",
  "Disposable test database only",
);
const operator = new Pool({
  connectionString: new URL("/postgres", base).toString(),
});
const created: string[] = [];
const pools: Pool[] = [];

async function freshDatabase(name: string) {
  await operator.query(`DROP DATABASE IF EXISTS ${name}`);
  await operator.query(`CREATE DATABASE ${name}`);
  created.push(name);
  const pool = new Pool({
    connectionString: new URL("/" + name, base).toString(),
    max: 2,
  });
  pools.push(pool);
  return pool;
}
const transactional = (pool: Pool) => ({
  async transaction<T>(work: (c: PoolClient) => Promise<T>) {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await work(c);
      await c.query("COMMIT");
      return result;
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
  },
});
const revision = approvedPricing.revision;
let fresh: Pool;

before(async () => {
  fresh = await freshDatabase("yarizan_phase2_pricing_fresh");
  await migrate(transactional(fresh));
});
after(async () => {
  for (const pool of pools) await pool.end();
  for (const name of created)
    await operator.query(`DROP DATABASE IF EXISTS ${name}`);
  await operator.end();
});

test("Approved pricing contract: six SKUs, integer IRR, G1 launch candidate only", () => {
  assert.match(revision, /^pricing-\d{4}-\d{2}-\d{2}-r\d+$/);
  assert.deepEqual(
    approvedPricing.products.map((p) => [
      p.sku,
      p.grade,
      p.price_irr,
      p.launch,
    ]),
    [1, 2, 3, 4, 5, 6].map((g) => [
      `YARIZAN-G${g}`,
      g,
      12990000,
      g === 1 ? "launch-candidate" : "coming-soon",
    ]),
  );
  for (const p of approvedPricing.products) {
    assert.ok(Number.isSafeInteger(p.price_irr));
    assert.equal(p.price_irr % 10, 0, "IRR must be an exact Toman multiple");
  }
});

test("Fresh database: catalog bootstrap has no prices; pricing needs the exact revision", async () => {
  assert.deepEqual(await productionBootstrap(fresh), { products_created: 6 });
  assert.equal(
    (await fresh.query("SELECT count(*)::int n FROM product_prices")).rows[0].n,
    0,
  );
  for (const wrong of ["", "pricing-2026-10-18-r2", "latest"])
    await assert.rejects(
      initializePricing(fresh, wrong),
      /PRICING_REVISION_MISMATCH/,
    );
  assert.equal(
    (await fresh.query("SELECT count(*)::int n FROM product_prices")).rows[0].n,
    0,
  );
});

test("Fresh database: approved prices are recorded exactly, audited, and flags stay closed", async () => {
  const result = await initializePricing(fresh, revision);
  assert.deepEqual(
    result.initialized,
    approvedPricing.products.map((p) => p.sku),
  );
  assert.deepEqual([result.unchanged, result.differing], [[], []]);
  const rows = (
    await fresh.query(
      "SELECT sku,amount_irr::text amount,source,changed_by,pricing_revision,ended_at FROM product_prices ORDER BY sku",
    )
  ).rows;
  assert.deepEqual(
    rows,
    approvedPricing.products.map((p) => ({
      sku: p.sku,
      amount: "12990000",
      source: "BOOTSTRAP",
      changed_by: null,
      pricing_revision: revision,
      ended_at: null,
    })),
  );
  const flags = (
    await fresh.query(
      "SELECT DISTINCT publication_status,sale_enabled,trial_enabled,activation_enabled FROM products",
    )
  ).rows;
  assert.deepEqual(flags, [
    {
      publication_status: "hidden",
      sale_enabled: false,
      trial_enabled: false,
      activation_enabled: false,
    },
  ]);
  const audits = (
    await fresh.query(
      "SELECT actor_type,actor_id,entity_id,metadata_redacted FROM audit_logs WHERE action='price.initialized' ORDER BY entity_id",
    )
  ).rows;
  assert.equal(audits.length, 6);
  assert.ok(
    audits.every(
      (a) =>
        a.actor_type === "SYSTEM" &&
        a.actor_id === null &&
        a.metadata_redacted.price_irr === 12990000 &&
        a.metadata_redacted.pricing_revision === revision,
    ),
  );
});

test("Duplicate pricing bootstrap changes nothing", async () => {
  const before = (
    await fresh.query("SELECT * FROM product_prices ORDER BY sku")
  ).rows;
  const result = await initializePricing(fresh, revision);
  assert.deepEqual(result.initialized, []);
  assert.equal(result.unchanged.length, 6);
  assert.deepEqual(
    (await fresh.query("SELECT * FROM product_prices ORDER BY sku")).rows,
    before,
  );
  assert.equal(
    (
      await fresh.query(
        "SELECT count(*)::int n FROM audit_logs WHERE action='price.initialized'",
      )
    ).rows[0].n,
    6,
  );
});

test("Price history is append-only with explicit provenance", async () => {
  const c = await fresh.connect();
  try {
    await assert.rejects(
      c.query("UPDATE product_prices SET amount_irr=1 WHERE sku='YARIZAN-G1'"),
      /append-only/,
    );
    await assert.rejects(
      c.query(
        "UPDATE product_prices SET source='UNATTRIBUTED',pricing_revision=NULL WHERE sku='YARIZAN-G1'",
      ),
      /append-only/,
    );
    await assert.rejects(
      c.query("DELETE FROM product_prices WHERE sku='YARIZAN-G1'"),
      /Immutable/,
    );
    for (const [source, revisionValue] of [
      ["ADMIN", null],
      ["BOOTSTRAP", null],
      ["BOOTSTRAP", "unreviewed"],
      ["SEED", null],
    ])
      await assert.rejects(
        c.query(
          "INSERT INTO product_prices(id,sku,amount_irr,effective_at,source,pricing_revision) VALUES($1,'YARIZAN-G2',1,now()+interval '1 day',$2,$3)",
          [randomUUID(), source, revisionValue],
        ),
        /price_provenance|null value/,
      );
    // A later price closes the current row exactly once; the closed row is then frozen.
    await c.query("BEGIN");
    await c.query(
      "UPDATE product_prices SET ended_at=transaction_timestamp() WHERE sku='YARIZAN-G2' AND ended_at IS NULL",
    );
    await c.query(
      "INSERT INTO product_prices(id,sku,amount_irr,effective_at,source,pricing_revision) VALUES($1,'YARIZAN-G2',13990000,transaction_timestamp(),'BOOTSTRAP',$2)",
      [randomUUID(), "pricing-2026-10-19-r2"],
    );
    await c.query("COMMIT");
    await assert.rejects(
      c.query(
        "UPDATE product_prices SET ended_at=now() WHERE sku='YARIZAN-G2' AND ended_at IS NOT NULL",
      ),
      /append-only/,
    );
    const history = (
      await c.query(
        "SELECT amount_irr::text a,ended_at IS NULL current FROM product_prices WHERE sku='YARIZAN-G2' ORDER BY effective_at",
      )
    ).rows;
    assert.deepEqual(history, [
      { a: "12990000", current: false },
      { a: "13990000", current: true },
    ]);
  } finally {
    c.release();
  }
  // An existing different price is reported for review, never overwritten.
  const result = await initializePricing(fresh, revision);
  assert.deepEqual(
    [result.initialized, result.differing],
    [[], ["YARIZAN-G2"]],
  );
  assert.equal(
    (
      await fresh.query(
        "SELECT amount_irr::text a FROM product_prices WHERE sku='YARIZAN-G2' AND ended_at IS NULL",
      )
    ).rows[0].a,
    "13990000",
  );
});

test("Existing database upgraded from 009 keeps legacy prices as unattributed", async () => {
  const legacy = await freshDatabase("yarizan_phase2_pricing_legacy");
  const c = await legacy.connect();
  try {
    await c.query(
      "CREATE TABLE schema_migrations(name text PRIMARY KEY, hash text NOT NULL)",
    );
    for (const name of (await readdir("migrations"))
      .filter((n) => /^00[1-9]_.*\.sql$/.test(n))
      .sort()) {
      const sql = (await readFile("migrations/" + name, "utf8")).replace(
        /\r\n/g,
        "\n",
      );
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations VALUES($1,$2)", [
        name,
        createHash("sha256").update(sql).digest("hex"),
      ]);
    }
    await c.query(
      "INSERT INTO products(sku,grade,title_fa,publication_status,sale_enabled,trial_enabled,activation_enabled) VALUES('YARIZAN-G1',1,'x','hidden',false,false,false)",
    );
    await c.query(
      "INSERT INTO product_prices(id,sku,amount_irr) VALUES($1,'YARIZAN-G1',12990000)",
      [randomUUID()],
    );
  } finally {
    c.release();
  }
  await migrate(transactional(legacy));
  assert.deepEqual(
    (
      await legacy.query(
        "SELECT source,pricing_revision,amount_irr::text a FROM product_prices",
      )
    ).rows,
    [{ source: "UNATTRIBUTED", pricing_revision: null, a: "12990000" }],
  );
  await productionBootstrap(legacy);
  const result = await initializePricing(legacy, revision);
  assert.deepEqual(result.unchanged, ["YARIZAN-G1"]);
  assert.equal(result.initialized.length, 5);
});
