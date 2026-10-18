import { readFileSync } from 'node:fs';
import { catalogDrift } from './catalog-drift.mjs';
import { approvedPricing } from '../../apps/web/shared/approved-pricing.ts';
// Usage: node tools/release/check-catalog-drift.mjs <products.json | https://host/api/v2/products>
// Exits 1 when the live catalog differs from the approved pricing revision.
const source = process.argv[2];
if (!source) throw new Error('usage: <products.json | url>');
const live = /^https?:\/\//.test(source)
  ? await (await fetch(source, { headers: { Accept: 'application/json' } })).json()
  : JSON.parse(readFileSync(source, 'utf8'));
const problems = catalogDrift(approvedPricing, live);
console.log(
  JSON.stringify({
    pricing_revision: approvedPricing.revision,
    drift: problems.length > 0,
    problems,
  }),
);
if (problems.length) process.exit(1);
