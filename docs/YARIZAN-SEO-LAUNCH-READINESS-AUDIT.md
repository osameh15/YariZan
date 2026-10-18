# YariZan Storefront — SEO Launch-Readiness Audit

Audited: `https://yarizan.oarnova.games`, storefront image `sha256:9febe61a…2be4`, 2026-10-18. Read-only: GET requests only, through the public CDN, with Chromium and axe-core 4.13. **Search indexing stays disabled until the owner explicitly approves it.**

## Result

| Area | Status | Evidence |
| --- | --- | --- |
| Indexing blocked | **Pass** | Every page: `<meta name="robots" content="noindex, nofollow">` and `X-Robots-Tag: noindex, nofollow`; `robots.txt` = `User-agent: * / Disallow: /` |
| Canonical URLs | **Pass** | Each public page has `rel=canonical` = `https://yarizan.oarnova.games<path>` (absolute, https, no query) |
| Sitemap XML | **Pass** | Valid `urlset`, `application/xml`, exactly 9 public URLs; no account, checkout, payment, Admin or API URL |
| Persian RTL | **Pass** | `lang="fa"`, `dir="rtl"`, one `h1` per page, Persian titles |
| Prices | **Pass** | All six grades show ۱٬۲۹۹٬۰۰۰ تومان (approved 12,990,000 IRR) |
| Availability | **Pass** | G1 «فروش اینترنتی به‌زودی», G2–G6 «به‌زودی»; no purchase link; disabled routes 503 |
| Open Graph | Partial | `og:url`, `og:locale=fa_IR`, `og:image` present; `og:title` is the same brand title on every page |
| Meta descriptions | **Gap** | The same generic description on all 9 pages |
| Structured data | **Gap** | No JSON-LD (Organization, Product/Offer, BreadcrumbList) |
| Legal pages | **Gap (blocking for indexing and commerce)** | `/privacy`, `/terms`, `/legal`, `/about` return 404; footer has no privacy, terms or refund links |
| Accessibility | Minor | axe: `region` (moderate) on every page; `heading-order` (moderate) on `/products`; no missing `alt`; no serious or critical violations |
| Social image | Minor | `og:image` is `logo.webp`; no 1200×630 PNG/JPEG card image or `twitter:image` |
| Sitemap metadata | Minor | No `<lastmod>`; acceptable, optional |

## Findings and recommendations (prioritized)

1. **Legal and policy pages (must-have before indexing and before any commerce).** Add Persian pages for privacy policy (what is collected: mobile number, device fingerprint digest, order data; retention; contact), terms of use and sale (perpetual per-device license, trial rules, offline use), refund policy (consistent with the existing refund-request flow), and contact/company identity. Link them from the footer and add them to the sitemap. These are also prerequisites for e-Namad and merchant acceptance.
2. **Per-page meta descriptions and Open Graph titles.** Each grade page should describe that grade, its availability and price; the catalog and support pages need their own text. Set `og:title` and `og:description` per page through the existing `useSeoMeta`.
3. **Structured data.** Add JSON-LD `Organization` (OAR Nova Games Studio) on all pages, `Product` with `Offer` (`price` 12990000, `priceCurrency` `IRR`, `availability` `PreOrder` for G1 or `OutOfStock`/`PreOrder` for G2–G6, never `InStock` while checkout is disabled), and `BreadcrumbList` on product pages. Validate with the Rich Results test before indexing.
4. **Accessibility landmarks.** Move the site notice and any content outside landmarks into `header`/`main`/`footer` (fixes `region`); fix the heading level jump on `/products` (`heading-order`).
5. **Social card image.** Add a 1200×630 PNG/JPEG brand card for `og:image` and `twitter:image`.
6. **Optional:** `<lastmod>` per sitemap URL from the build.

## Indexing switch (when the owner approves)

All of the following must be true first: items 1–4 done; owner content and price review; TLS, mobile and CDN behaviour accepted (done at launch); error pages verified (done). Then, in one reviewed change: set `YARIZAN_SEO_INDEXING=index` on the storefront service (application) and remove the `yarizan-noindex` middleware from the storefront route (infrastructure). Protected routes stay `noindex` regardless, and the sitemap remains public-only. Submit the sitemap in Google Search Console only after both changes are live.
