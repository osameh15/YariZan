import { randomUUID } from "node:crypto";
import { Database } from "./database";
import { ConfigurationError } from "../config";

export const permissions = [
  "notes.manage",
  "customers.read",
  "devices.read",
  "licenses.read",
  "trials.read",
  "activation_codes.read",
  "customers.reset",
  "device_products.block",
  "device_products.unblock",
  "trials.reset",
  "licenses.issue",
  "licenses.revoke",
  "licenses.reissue",
  "activation_codes.issue",
  "activation_codes.cancel",
  "products.manage",
  "audit.read",
  "support.password_reset",
  "enrollments.recover",
];
export async function seed(db: Database) {
  await db.transaction(async (c) => {
    const names = ["اول", "دوم", "سوم", "چهارم", "پنجم", "ششم"];
    for (let grade = 1; grade <= 6; grade++) {
      const sku = `YARIZAN-G${grade}`;
      await c.query(
        `INSERT INTO products(sku,grade,title_fa,publication_status,sale_enabled,trial_enabled,activation_enabled)
        VALUES($1,$2,$3,$4,$5,$5,$5) ON CONFLICT DO NOTHING`,
        [
          sku,
          grade,
          `یاریزان پایه ${names[grade - 1]} دبستان`,
          grade === 1 ? "published" : "coming_soon",
          grade === 1,
        ],
      );
      await c.query(
        `INSERT INTO product_prices(id,sku,amount_irr) SELECT $1,$2,12990000
        WHERE NOT EXISTS(SELECT 1 FROM product_prices WHERE sku=$2)`,
        [randomUUID(), sku],
      );
    }
    for (const role of ["owner", "support", "auditor", "catalog"])
      await c.query(
        "INSERT INTO admin_roles VALUES($1) ON CONFLICT DO NOTHING",
        [role],
      );
    for (const p of permissions) {
      await c.query(
        "INSERT INTO admin_permissions VALUES($1) ON CONFLICT DO NOTHING",
        [p],
      );
      await c.query(
        "INSERT INTO admin_role_permissions VALUES('owner',$1) ON CONFLICT DO NOTHING",
        [p],
      );
    }
    for (const [role, p] of [
      ["support", "support.password_reset"],
      ["support", "customers.read"],
      ["support", "devices.read"],
      ["support", "licenses.read"],
      ["support", "trials.read"],
      ["auditor", "audit.read"],
      ["catalog", "products.manage"],
    ])
      await c.query(
        "INSERT INTO admin_role_permissions VALUES($1,$2) ON CONFLICT DO NOTHING",
        [role, p],
      );
  });
}
if (require.main === module) {
  void (async () => {
    let db: Database | undefined;
    try {
      db = new Database();
      await seed(db);
      console.log("Six products seeded");
    } catch (error: unknown) {
      console.error(
        error instanceof ConfigurationError ? error.message : "Seed failed",
      );
      process.exitCode = 1;
    } finally {
      await db?.onModuleDestroy();
    }
  })();
}
