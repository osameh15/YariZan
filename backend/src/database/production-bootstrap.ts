import { randomUUID } from "node:crypto";
import { productTitle } from "../catalog/standalone-products";
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
    let products = 0;
    for (const { sku, grade } of approvedPricing.products)
      products += (
        await c.query(
          `INSERT INTO products(sku,grade,title_fa,publication_status,sale_enabled,trial_enabled,activation_enabled)
          VALUES($1,$2,$3,'hidden',false,false,false) ON CONFLICT DO NOTHING`,
          [sku, grade, productTitle(sku, grade)],
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
// changed, once per product, so a later Admin decision (including "hidden") is never overwritten.
// Sale, trial and activation stay off: they belong to their own capabilities. A published product
// must already have a current price. Independent games stay hidden here: applyProductUpdate
// publishes them after the new web build runs, because older builds reject a grade 0 row.
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
      const initialized = await c.query(
        "SELECT 1 FROM audit_logs WHERE action='product.publication_initialized' AND entity_id=$1 LIMIT 1",
        [p.sku],
      );
      if (
        p.grade === 0 ||
        row.publication_status !== "hidden" ||
        initialized.rowCount
      ) {
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

// Explicit owner-approved rollout. Existing order/payment snapshots and ended prices remain
// immutable. Run after catalog/price bootstrap, once the new API and web containers run.
export async function applyProductUpdate(pool: Pool, revision: string) {
  if (revision !== approvedPricing.revision)
    throw new ConfigurationError(
      `PRICING_REVISION_MISMATCH: expected ${approvedPricing.revision}`,
    );
  const c = await pool.connect();
  const changed: string[] = [];
  try {
    await c.query("BEGIN");
    await verifyMigrations(c);
    const audit = new Audit();
    const correlationId = randomUUID();
    await c.query("SELECT pg_advisory_xact_lock(748293002)");
    const applied = await c.query(
      "SELECT 1 FROM audit_logs WHERE action='catalog.revision_applied' AND entity_id=$1",
      [revision],
    );
    if (applied.rowCount) {
      await c.query("COMMIT");
      return { pricing_revision: revision, changed, already_applied: true };
    }
    const standalone: string[] = approvedPricing.products
      .filter((p) => p.sku === "YARIZAN-S-COMBINATION-LAND")
      .map((p) => p.sku);
    for (const sku of standalone) {
      const approved = approvedPricing.products.find((p) => p.sku === sku)!;
      const product = await c.query(
        "SELECT 1 FROM products WHERE sku=$1 FOR UPDATE",
        [sku],
      );
      if (!product.rowCount)
        throw new ConfigurationError("PRODUCTS_MISSING: run bootstrap first");
      const current = (
        await c.query<{ amount_irr: string }>(
          "SELECT amount_irr FROM product_prices WHERE sku=$1 AND ended_at IS NULL FOR UPDATE",
          [sku],
        )
      ).rows[0];
      if (
        !current ||
        BigInt(current.amount_irr) !== BigInt(approved.price_irr)
      ) {
        const promotion = await c.query(
          "SELECT 1 FROM product_promotions WHERE sku=$1 AND state='ENABLED' AND ends_at>clock_timestamp()",
          [sku],
        );
        if (promotion.rowCount)
          throw new ConfigurationError(
            "ACTIVE_PROMOTION: deactivate before changing the list price",
          );
        await c.query(
          "UPDATE product_prices SET ended_at=transaction_timestamp() WHERE sku=$1 AND ended_at IS NULL",
          [sku],
        );
        await c.query(
          "INSERT INTO product_prices(id,sku,amount_irr,effective_at,source,pricing_revision) VALUES($1,$2,$3,transaction_timestamp(),'BOOTSTRAP',$4)",
          [randomUUID(), sku, approved.price_irr, revision],
        );
        await c.query("UPDATE products SET revision=revision+1 WHERE sku=$1", [
          sku,
        ]);
        await audit.append(
          c,
          { type: "SYSTEM", correlationId },
          "price.revision_applied",
          sku,
          { price_irr: approved.price_irr, pricing_revision: revision },
        );
        changed.push(sku);
      }
    }
    const published = await c.query<{ sku: string }>(
      "UPDATE products SET publication_status='published',sale_enabled=true,trial_enabled=true,activation_enabled=true,revision=revision+1 WHERE sku=ANY($1::text[]) AND (publication_status<>'published' OR NOT sale_enabled OR NOT trial_enabled OR NOT activation_enabled) RETURNING sku",
      [standalone],
    );
    for (const row of published.rows)
      await audit.append(
        c,
        { type: "SYSTEM", correlationId },
        "product.standalone_enabled",
        row.sku,
        { pricing_revision: revision },
      );
    await audit.append(
      c,
      { type: "SYSTEM", correlationId },
      "catalog.revision_applied",
      revision,
      { changed },
    );
    await c.query("COMMIT");
    return {
      pricing_revision: revision,
      changed,
      standalone_enabled: true,
      already_applied: false,
    };
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
      const update = option("--apply-product-update");
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
      if (update !== undefined)
        console.log(
          JSON.stringify({
            event: "product_update_applied",
            ...(await applyProductUpdate(pool, update)),
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
