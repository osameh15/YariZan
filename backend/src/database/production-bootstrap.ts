import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { Audit } from "../audit/audit";
import { approvedPricing } from "../catalog/approved-pricing";
import { ConfigurationError, migrationConfiguration } from "../config";
import { verifyMigrations } from "./migrate";
import { seedAdminRoles } from "./seed";

// Reviewed, idempotent production bootstrap. Run by the migration owner after migrations:
//   node dist/src/database/production-bootstrap.js
//   node dist/src/database/production-bootstrap.js --initialize-prices=<approved revision>
// The first form creates the RBAC catalog and the six product rows only. Every product starts
// hidden with sale, trial and activation disabled; existing rows are never modified.
// The second form also records the owner-approved initial prices (src/catalog/approved-pricing.ts),
// but only when the operator names the exact approved revision. It never touches product flags,
// never creates an Admin and never overwrites a current price (Admin changes stay authoritative).
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
export type PricingResult = {
  pricing_revision: string;
  initialized: string[];
  unchanged: string[];
  differing: string[];
};

// Records an approved initial price for every product that has no current price. Prices that
// already exist are left alone: equal ones are "unchanged", others are reported as "differing"
// for the owner to review in Admin. Each initialization is audited as a SYSTEM bootstrap action.
export async function initializePricing(
  pool: Pool,
  revision: string,
): Promise<PricingResult> {
  if (revision !== approvedPricing.revision)
    throw new ConfigurationError(
      `PRICING_REVISION_MISMATCH: expected ${approvedPricing.revision}`,
    );
  const c = await pool.connect();
  const result: PricingResult = {
    pricing_revision: revision,
    initialized: [],
    unchanged: [],
    differing: [],
  };
  try {
    await c.query("BEGIN");
    await verifyMigrations(c);
    const audit = new Audit();
    const correlationId = randomUUID();
    for (const p of approvedPricing.products) {
      const product = await c.query(
        "SELECT 1 FROM products WHERE sku=$1 FOR UPDATE",
        [p.sku],
      );
      if (!product.rowCount)
        throw new ConfigurationError(
          "PRODUCTS_MISSING: run the catalog bootstrap first",
        );
      const current = (
        await c.query<{ amount_irr: string }>(
          "SELECT amount_irr FROM product_prices WHERE sku=$1 AND ended_at IS NULL FOR UPDATE",
          [p.sku],
        )
      ).rows[0];
      if (current) {
        (BigInt(current.amount_irr) === BigInt(p.price_irr)
          ? result.unchanged
          : result.differing
        ).push(p.sku);
        continue;
      }
      await c.query(
        `INSERT INTO product_prices(id,sku,amount_irr,effective_at,source,pricing_revision)
        VALUES($1,$2,$3,transaction_timestamp(),'BOOTSTRAP',$4)`,
        [randomUUID(), p.sku, p.price_irr, revision],
      );
      await audit.append(
        c,
        { type: "SYSTEM", correlationId },
        "price.initialized",
        p.sku,
        { price_irr: p.price_irr, pricing_revision: revision },
      );
      result.initialized.push(p.sku);
    }
    await c.query("COMMIT");
    return result;
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}

export type PublicationResult = {
  pricing_revision: string;
  published: string[];
  coming_soon: string[];
  unchanged: string[];
};

// Makes the owner-approved catalog visible while no Admin can sign in yet: the launch candidate
// becomes "published" and every other grade "coming_soon". Only rows that are still "hidden" are
// changed, so a later Admin decision is never overwritten. Sale, trial and activation stay off:
// they belong to their own capabilities. A published product must already have a current price.
export async function publishApprovedCatalog(
  pool: Pool,
  revision: string,
): Promise<PublicationResult> {
  if (revision !== approvedPricing.revision)
    throw new ConfigurationError(
      `PRICING_REVISION_MISMATCH: expected ${approvedPricing.revision}`,
    );
  const c = await pool.connect();
  const result: PublicationResult = {
    pricing_revision: revision,
    published: [],
    coming_soon: [],
    unchanged: [],
  };
  try {
    await c.query("BEGIN");
    await verifyMigrations(c);
    const audit = new Audit();
    const correlationId = randomUUID();
    for (const p of approvedPricing.products) {
      const row = (
        await c.query<{ publication_status: string }>(
          "SELECT publication_status FROM products WHERE sku=$1 FOR UPDATE",
          [p.sku],
        )
      ).rows[0];
      if (!row)
        throw new ConfigurationError(
          "PRODUCTS_MISSING: run the catalog bootstrap first",
        );
      if (row.publication_status !== "hidden") {
        result.unchanged.push(p.sku);
        continue;
      }
      const status =
        p.launch === "launch-candidate" ? "published" : "coming_soon";
      if (
        status === "published" &&
        !(
          await c.query(
            "SELECT 1 FROM product_prices WHERE sku=$1 AND ended_at IS NULL",
            [p.sku],
          )
        ).rowCount
      )
        throw new ConfigurationError(
          "PRICE_REQUIRED: initialize the approved prices first",
        );
      await c.query(
        "UPDATE products SET publication_status=$2,revision=revision+1 WHERE sku=$1",
        [p.sku, status],
      );
      await audit.append(
        c,
        { type: "SYSTEM", correlationId },
        "product.publication_initialized",
        p.sku,
        { publication_status: status, pricing_revision: revision },
      );
      (status === "published" ? result.published : result.coming_soon).push(
        p.sku,
      );
    }
    await c.query("COMMIT");
    return result;
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
      const option = (name: string) => {
        if (process.argv.some((a) => a === name))
          throw new ConfigurationError(
            `PRICING_REVISION_REQUIRED: use ${name}=<approved revision>`,
          );
        return process.argv
          .find((a) => a.startsWith(name + "="))
          ?.slice(name.length + 1);
      };
      const pricing = option("--initialize-prices");
      const publication = option("--publish-approved-catalog");
      const result = await productionBootstrap(pool);
      console.log(JSON.stringify({ event: "production_bootstrap", ...result }));
      if (pricing !== undefined)
        console.log(
          JSON.stringify({
            event: "pricing_initialized",
            ...(await initializePricing(pool, pricing)),
          }),
        );
      if (publication !== undefined)
        console.log(
          JSON.stringify({
            event: "catalog_published",
            ...(await publishApprovedCatalog(pool, publication)),
          }),
        );
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
