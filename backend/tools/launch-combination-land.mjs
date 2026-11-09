// Run after migrations and coordinated web/API deployment with an authorized owner ID.
import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrationConfiguration } from "../dist/src/config.js";
import {
  productionBootstrap,
  initializePricing,
  applyProductUpdate,
} from "../dist/src/database/production-bootstrap.js";
import { approvedPricing } from "../dist/src/catalog/approved-pricing.js";
import { Promotions } from "../dist/src/commerce/promotions.js";
import { Audit } from "../dist/src/audit/audit.js";

const adminId = process.argv.find((a) => a.startsWith("--admin="))?.slice(8);
if (!adminId || !/^[0-9a-f-]{36}$/i.test(adminId))
  throw new Error("Use --admin=<owner UUID>");
const pool = new Pool({
  connectionString: migrationConfiguration().url,
  max: 1,
});
try {
  const owner = await pool.query(
    "SELECT 1 FROM admin_user_roles WHERE admin_id=$1 AND role='owner'",
    [adminId],
  );
  if (!owner.rowCount) throw new Error("OWNER_REQUIRED");
  await productionBootstrap(pool);
  await initializePricing(pool, approvedPricing.revision);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const sku = "YARIZAN-S-COMBINATION-LAND";
    const row = (
      await c.query("SELECT revision FROM products WHERE sku=$1 FOR UPDATE", [
        sku,
      ])
    ).rows[0];
    const previous = await c.query(
      "SELECT 1 FROM product_promotions WHERE sku=$1",
      [sku],
    );
    // Never re-enable an offer that an Admin has disabled, or replace their later decision.
    if (!previous.rowCount) {
      const promotions = new Promotions(new Audit(), null);
      await promotions.create(
        c,
        sku,
        {
          request_id: randomUUID(),
          expected_revision: Number(row.revision),
          promo_price_irr: 2990000,
          ends_at: "9999-12-31T00:00:00Z",
          reason:
            "Owner approved 2026-11-09: 399000 toman list, 299000 offer until disabled",
        },
        { type: "ADMIN", id: adminId, correlationId: randomUUID() },
      );
    }
    await c.query("COMMIT");
    console.log(
      "Combination Land catalog and offer initialized; existing Admin decisions preserved.",
    );
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
  await applyProductUpdate(pool, approvedPricing.revision);
} finally {
  await pool.end();
}
