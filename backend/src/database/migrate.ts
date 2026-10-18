import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, PoolClient } from "pg";
import { ConfigurationError, migrationConfiguration } from "../config";
import { migrationFilePattern, SCHEMA_MIGRATION_COUNT } from "./schema-version";
import { runtimeGrantsSql, runtimeRole } from "./runtime-grants";

export class MigrationError extends Error {}

interface Queryable {
  query: PoolClient["query"];
}
async function migrationFiles() {
  const files = (await readdir(path.resolve("migrations")))
    .filter((f) => migrationFilePattern.test(f))
    .sort();
  if (files.length !== SCHEMA_MIGRATION_COUNT)
    throw new MigrationError("MIGRATION_COUNT_MISMATCH");
  return Promise.all(
    files.map(async (name) => {
      const sql = (
        await readFile(path.join("migrations", name), "utf8")
      ).replace(/\r\n/g, "\n");
      return {
        name,
        sql,
        hash: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
}
async function appliedMigrations(c: Queryable) {
  return (
    await c.query<{ name: string; hash: string }>(
      "SELECT name,hash FROM schema_migrations ORDER BY name",
    )
  ).rows;
}
function compare(
  applied: { name: string; hash: string }[],
  files: { name: string; hash: string }[],
) {
  if (applied.some((r, i) => r.name !== files[i]?.name))
    throw new MigrationError("MIGRATION_ORDER_DRIFT");
  if (applied.some((r, i) => r.hash !== files[i]!.hash))
    throw new MigrationError("MIGRATION_HASH_DRIFT");
}

// Applies pending migrations in one transaction under an advisory lock, then refreshes the
// runtime role grants. Hash or order drift aborts without changes.
export async function migrate(
  db: {
    transaction<T>(work: (c: PoolClient) => Promise<T>): Promise<T>;
  },
  options: { requireRuntimeRole?: boolean } = {},
) {
  const files = await migrationFiles();
  return db.transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(748293001)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, hash text NOT NULL)",
    );
    const applied = await appliedMigrations(c);
    compare(applied, files);
    const pending = files.slice(applied.length);
    for (const file of pending) {
      await c.query(file.sql);
      await c.query("INSERT INTO schema_migrations VALUES($1,$2)", [
        file.name,
        file.hash,
      ]);
    }
    const role = await c.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
      runtimeRole,
    ]);
    if (role.rowCount) await c.query(runtimeGrantsSql);
    else if (options.requireRuntimeRole)
      throw new MigrationError("RUNTIME_ROLE_MISSING");
    return {
      applied: pending.length,
      total: files.length,
      grants: !!role.rowCount,
    };
  });
}

// Read-only verification: usable with the runtime login. Changes nothing.
export async function verifyMigrations(c: Queryable) {
  const files = await migrationFiles();
  const applied = await appliedMigrations(c);
  compare(applied, files);
  if (applied.length !== files.length)
    throw new MigrationError("MIGRATIONS_PENDING");
  return { total: applied.length };
}

if (require.main === module) {
  void (async () => {
    let pool: Pool | undefined;
    try {
      const config = migrationConfiguration();
      pool = new Pool({
        connectionString: config.url,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      if (process.argv.includes("--verify")) {
        const result = await verifyMigrations(pool);
        console.log(
          JSON.stringify({ event: "migrations_verified", ...result }),
        );
      } else {
        const client = pool;
        const result = await migrate(
          {
            async transaction(work) {
              const c = await client.connect();
              try {
                await c.query("BEGIN");
                await c.query("SET LOCAL lock_timeout='10s'");
                const value = await work(c);
                await c.query("COMMIT");
                return value;
              } catch (error) {
                await c.query("ROLLBACK");
                throw error;
              } finally {
                c.release();
              }
            },
          },
          { requireRuntimeRole: config.NODE_ENV === "production" },
        );
        console.log(JSON.stringify({ event: "migrations_applied", ...result }));
      }
    } catch (error: unknown) {
      console.error(
        error instanceof ConfigurationError || error instanceof MigrationError
          ? error.message
          : "MIGRATION_FAILED",
      );
      process.exitCode = 1;
    } finally {
      await pool?.end();
    }
  })();
}
