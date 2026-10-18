import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogDrift } from './catalog-drift.mjs';
import { approvedPricing } from '../../apps/web/shared/approved-pricing.ts';

const live = () =>
  approvedPricing.products.map((p) => ({
    sku: p.sku,
    grade: p.grade,
    price_irr: p.price_irr,
    publication_status: p.launch === 'coming-soon' ? 'coming_soon' : 'published',
    sale_enabled: false,
  }));

test('a live catalog matching the approved revision has no drift', () => {
  assert.deepEqual(catalogDrift(approvedPricing, live()), []);
});
test('price, availability, missing, unapproved and non-integer drift are all reported', () => {
  const changed = live();
  changed[0].price_irr = 13990000;
  changed[1].publication_status = 'published';
  changed[2].price_irr = 1299000.5;
  const rest = changed.slice(0, 5);
  rest.push({ sku: 'YARIZAN-G9', price_irr: 1 });
  const problems = catalogDrift(approvedPricing, rest);
  for (const fragment of [
    'YARIZAN-G1: live 13990000',
    'YARIZAN-G2: availability',
    'YARIZAN-G3: live price is not an integer',
    'YARIZAN-G6: not in the live public catalog',
    'YARIZAN-G9: not approved',
  ])
    assert.ok(
      problems.some((p) => p.startsWith(fragment)),
      fragment,
    );
  assert.deepEqual(catalogDrift(approvedPricing, { error: 'x' }), ['live catalog is not a list']);
});
