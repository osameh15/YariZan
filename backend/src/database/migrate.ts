import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Database } from "./database";
import { ConfigurationError } from "../config";

export async function migrate(db: Database) {
  await db.transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(748293001)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, hash text NOT NULL)",
    );
    const files = (await readdir(path.resolve("migrations")))
      .filter((f) => /^\d{3}_[a-z_]+\.sql$/.test(f))
      .sort();
    const applied = await c.query<{ name: string; hash: string }>(
      "SELECT name,hash FROM schema_migrations ORDER BY name",
    );
    if (applied.rows.some((r, i) => r.name !== files[i]))
      throw new Error("MIGRATION_ORDER_DRIFT");
    for (const name of files) {
      const sql = (
        await readFile(path.join("migrations", name), "utf8")
      ).replace(/\r\n/g, "\n");
      const hash = createHash("sha256").update(sql).digest("hex");
      const previous = applied.rows.find((r) => r.name === name);
      if (previous && previous.hash !== hash)
        throw new Error("MIGRATION_HASH_DRIFT");
      if (!previous) {
        await c.query(sql);
        await c.query("INSERT INTO schema_migrations VALUES($1,$2)", [
          name,
          hash,
        ]);
      }
    }
  });
}
if (require.main === module) {
  void (async () => {
    let db: Database | undefined;
    try {
      db = new Database();
      await migrate(db);
      console.log("Migrations verified");
    } catch (error: unknown) {
      console.error(
        error instanceof ConfigurationError
          ? error.message
          : "Migration failed",
      );
      process.exitCode = 1;
    } finally {
      await db?.onModuleDestroy();
    }
  })();
}
