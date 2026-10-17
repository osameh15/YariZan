import { Pool } from "pg";
import { ConfigurationError, migrationConfiguration } from "../config";
import { verifyMigrations } from "./migrate";
import { seedAdminRoles } from "./seed";

// Reviewed, idempotent production bootstrap. Run once by the migration owner after migrations:
//   node dist/src/database/production-bootstrap.js
// It creates the RBAC catalog and the six product rows only. It inserts no prices, no Admin
// account and no customer data, and every product starts hidden with sale, trial and
// activation disabled. Existing rows are never modified (ON CONFLICT DO NOTHING).
export async function productionBootstrap(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await verifyMigrations(c);
    const names = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"];
    let products = 0;
    for (let grade = 1; grade <= 6; grade++)
      products += (
        await c.query(
          `INSERT INTO products(sku,grade,title_fa,publication_status,sale_enabled,trial_enabled,activation_enabled)
          VALUES($1,$2,$3,'hidden',false,false,false) ON CONFLICT DO NOTHING`,
          [
            `YARIZAN-G${grade}`,
            grade,
            `یاریزان پایه ${names[grade - 1]} دبستان`,
          ],
        )
      ).rowCount!;
    await seedAdminRoles(c);
    await c.query("COMMIT");
    return { products_created: products };
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
if (require.main === module) {
  void (async () => {
    let pool: Pool | undefined;
    try {
      const config = migrationConfiguration();
      pool = new Pool({ connectionString: config.url, max: 1 });
      const result = await productionBootstrap(pool);
      console.log(JSON.stringify({ event: "production_bootstrap", ...result }));
    } catch (error: unknown) {
      console.error(
        error instanceof ConfigurationError
          ? error.message
          : "BOOTSTRAP_FAILED",
      );
      process.exitCode = 1;
    } finally {
      await pool?.end();
    }
  })();
}
