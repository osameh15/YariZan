// Owner-approved initial retail prices (technical specification; approved for public display
// on 2026-10-18). Integer IRR is the only authoritative amount; Toman is display only
// (1 Toman = 10 IRR). A price says nothing about availability: sale, trial and activation stay
// separate, explicitly reviewed product flags.
// The same object is kept in apps/web/shared/approved-pricing.ts; web unit tests fail if the
// two copies differ. Change both together, with a new revision, after owner approval.
export const approvedPricing = {
  revision: "pricing-2026-10-18-r1",
  approved: "2026-10-18",
  currency: "IRR",
  products: [
    {
      sku: "YARIZAN-G1",
      grade: 1,
      price_irr: 12990000,
      launch: "launch-candidate",
    },
    { sku: "YARIZAN-G2", grade: 2, price_irr: 12990000, launch: "coming-soon" },
    { sku: "YARIZAN-G3", grade: 3, price_irr: 12990000, launch: "coming-soon" },
    { sku: "YARIZAN-G4", grade: 4, price_irr: 12990000, launch: "coming-soon" },
    { sku: "YARIZAN-G5", grade: 5, price_irr: 12990000, launch: "coming-soon" },
    { sku: "YARIZAN-G6", grade: 6, price_irr: 12990000, launch: "coming-soon" },
  ],
} as const;
export type ApprovedPricing = typeof approvedPricing;
