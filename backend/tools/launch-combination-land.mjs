// Run after migrations and coordinated web/API deployment with an authorized owner ID.
import "reflect-metadata";
import { Pool } from "pg";
import { migrationConfiguration } from "../dist/src/config.js";
import {
  productionBootstrap,
  initializePricing,
  applyProductUpdate,
} from "../dist/src/database/production-bootstrap.js";
import { approvedPricing } from "../dist/src/catalog/approved-pricing.js";

let adminId = process.argv.find((a) => a.startsWith("--admin="))?.slice(8);
if (!adminId || (adminId !== "auto" && !/^[0-9a-f-]{36}$/i.test(adminId)))
  throw new Error("Use --admin=<owner UUID>");
const pool = new Pool({
  connectionString: migrationConfiguration().url,
  max: 1,
});
try {
  if (adminId === "auto") {
    const owners = await pool.query(
      "SELECT DISTINCT admin_id FROM admin_user_roles WHERE role='owner'",
    );
    if (owners.rowCount !== 1)
      throw new Error(
        "Multiple or missing owners: set an explicit YARIZAN_OFFER_ADMIN_ID",
      );
    adminId = owners.rows[0].admin_id;
  }
  const owner = await pool.query(
    "SELECT 1 FROM admin_user_roles WHERE admin_id=$1 AND role='owner'",
    [adminId],
  );
  if (!owner.rowCount) throw new Error("OWNER_REQUIRED");
  await productionBootstrap(pool);
  await initializePricing(pool, approvedPricing.revision);
  await applyProductUpdate(pool, approvedPricing.revision, adminId);
} finally {
  await pool.end();
}
