// Detects divergence between the public storefront's approved prices and a live Backend
// catalog (GET /api/v2/products). A difference means either Admin changed a price after the
// approved revision or the storefront image is stale; both must be reviewed before the
// storefront keeps showing prices. Never used to authorize a transaction.
export function catalogDrift(approved, live) {
  const problems = [];
  if (!Array.isArray(live)) return ['live catalog is not a list'];
  const bySku = new Map(live.map((p) => [p?.sku, p]));
  for (const p of approved.products) {
    const current = bySku.get(p.sku);
    // The live public endpoint omits hidden products; that is reported, not guessed.
    if (!current) {
      problems.push(`${p.sku}: not in the live public catalog`);
      continue;
    }
    if (!Number.isSafeInteger(current.price_irr))
      problems.push(`${p.sku}: live price is not an integer IRR`);
    else if (current.price_irr !== p.price_irr)
      problems.push(`${p.sku}: live ${current.price_irr} IRR != approved ${p.price_irr} IRR`);
    const comingSoon = p.launch === 'coming-soon';
    if (comingSoon !== (current.publication_status === 'coming_soon'))
      problems.push(`${p.sku}: availability ${current.publication_status} != approved ${p.launch}`);
  }
  for (const sku of bySku.keys())
    if (!approved.products.some((p) => p.sku === sku)) problems.push(`${sku}: not approved`);
  return problems;
}
