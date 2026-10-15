# YariZan web design system

## Design contract

Warm modern minimalism: preserve the approved book identity, local Shabnam font and Persian RTL language. Use product illustrations and simple geometric composition rather than stock photography. No new dependency, font licence, commercial claim or payment capability is introduced.

The checkout has one job: review the server-calculated grade/device purchase and continue safely. Product and coupon belong in the main column; exact totals, simulation disclosure and the primary action belong in a contrasting summary. The summary is sticky only on sufficiently wide screens. No mobile fixed action covers content. Invalid or changed coupons require a new server quote. Removing a coupon also requests a server quote.

Operational screens prioritize scanning, permission-aware navigation, useful totals and reachable actions. Preserve the ten supported commerce sections and their authorization. Group navigation by task; distinguish the net order amount from gateway captures (which can include duplicate captures). Never interpret a simulated amount as actual revenue. Do not draw fictional charts or create decorative statistics.

## Tokens and migration

`apps/web/app/assets/css/premium.css` is the shared presentation layer, loaded after the established layout and validation rules in `main.css`. This is an intentional incremental migration: existing security and form behaviors remain intact while semantic component styling changes. New component rules use semantic tokens. Legacy one-off palette values remain in the older illustrative CSS; migrating every legacy value is outside this focused change.

| Layer | Tokens | Purpose |
| --- | --- | --- |
| Primitive | sand-50/100/200, brown-900/600, teal-700/50, coral-50, white | Approved warm brand palette and complementary accents |
| Semantic | ink, muted, paper, line, surface, surface-soft, accent, danger | Text, boundaries, surfaces, actions and failures |
| Component | radius-control (12px), radius-card (20px), shadow-card, space-section | Consistent controls, restrained depth and adaptive section spacing |

Keep normal text at least 4.5:1 and control boundaries/focus at least 3:1 against adjacent surfaces. Use a label or symbol with status colors. Product accents identify grades without implying unavailable products are purchasable. The local font has 400 and 700 weights; avoid synthesized intermediate weights. Persian text uses natural line height and no compressed negative letter spacing. Isolate identifiers and codes with `dir=ltr` or `bdi`; amounts use exact integer IRR-to-Toman formatting.

## Components and states

- Primary action: teal filled, white text, 48px minimum height; secondary action: white surface and visible border. Preserve visible focus, disabled feedback and custom validation.
- Product card: independent grade accent, large grade numeral, publication badge, exact backend price and 44px detail action. No purchase inferred from SKU existence.
- Checkout: selected-product cover, optional coupon row, device/offline explanation, server totals, unmistakable fake-payment notice and full-width primary action.
- Order receipt: labeled status and restrained symbol. Ready/confirmed, failed/review, pending/unknown have distinct surfaces; unknown expressly warns against paying again. Copy only the public order identifier; announce completion accessibly.
- Admin: grouped side navigation, exact active state for query-based sections, compact filter toolbar, scrollable tables, labeled status chips and net-amount emphasis. All mutations remain server authorized.
- Long editor: header and action footer remain outside the internally scrollable field region. Section headings separate configuration and quotas. Reason is full width. Native modal focus containment, Escape and focus restoration remain in BaseDialog.
- Loading: static skeleton geometry and a polite status. No perpetual animation is necessary. Empty/error views retain actionable Persian feedback.

## Responsive and accessibility rules

Validate 360, 390, 768, 1024 and 1440px, narrow dialog heights and enlarged presentation. Public header switches to a native modal menu below 760px. Checkout becomes one column; summary stops sticking. Admin navigation becomes wrapping task links, tables retain horizontal scrolling within their own region, and the coupon editor becomes one field column below 600px. Footer remains compact with two link columns on phones, both support numbers and preserved studio/copyright credits.

Do not hide overflow to mask a broken layout. No fixed bottom overlay may cover content. All form submission uses FormShell/novalidate and Persian errors. Keep keyboard focus visible; preserve active navigation semantics and live announcements. Reduced-motion preference disables transitions and decorative movement. Test WCAG A/AA using axe alongside keyboard and viewport checks; automated checks do not establish full WCAG conformance or physical-device acceptance.

## Visual evidence

Before: `docs/Images/phase4/`. After: `docs/Images/phase4-premium/`. Compare checkout summary, finance overview, orders and long coupon dialogs at matching viewport widths. The Phase 4 report records executed tests, evidence and limitations.
