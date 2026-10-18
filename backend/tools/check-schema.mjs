import assert from "node:assert/strict";
import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Database } from "../dist/src/database/database.js";
import { migrate } from "../dist/src/database/migrate.js";
const url = new URL(process.env.DATABASE_URL);
assert.equal(
  url.pathname,
  "/yarizan_phase2_test",
  "Schema verification requires disposable test database",
);
const original = new Database();
const operator = new pg.Pool({
  connectionString: new URL("/postgres", url).toString(),
});
const referenceName = "yarizan_phase2_schema_reference";
const found = await operator.query(
  "SELECT 1 FROM pg_database WHERE datname=$1",
  [referenceName],
);
if (found.rowCount)
  await operator.query("DROP DATABASE yarizan_phase2_schema_reference");
await operator.query("CREATE DATABASE yarizan_phase2_schema_reference");
process.env.DATABASE_URL = new URL("/" + referenceName, url).toString();
const fresh = new Database();
const queries = [
  "SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
  "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  "SELECT c.relname table_name,con.conname,pg_get_constraintdef(con.oid) definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname",
  "SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
  "SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'  ORDER BY p.proname",
];
try {
  // Materialize the merged Phase 3 schema, then apply the real forward migration.
  await fresh.transaction(async (c) => {
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
  });
  await migrate(fresh);
  for (const sql of queries)
    assert.deepEqual(
      (await original.query(sql)).rows,
      (await fresh.query(sql)).rows,
    );
  console.log(
    "Migration schema comparison: five catalog groups match fresh initialization against 001-009 upgraded through 010",
  );
} finally {
  await fresh.onApplicationShutdown();
  await original.onApplicationShutdown();
  await operator.query("DROP DATABASE yarizan_phase2_schema_reference");
  await operator.end();
}
