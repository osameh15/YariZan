# Initial YariZan articles

Four original Persian drafts are included in migration 017. They remain private until an authorized Admin reviews and publishes each one at `/zanyari/blog`.

1. [Choosing an educational game](choosing-an-educational-game.md)
2. [Three number games at home](number-games-at-home.md)
3. [Getting started with YariZan on Windows](getting-started-with-yarizan.md)
4. [Helping without giving away the answer](helping-without-giving-the-answer.md)

These are AI-assisted editorial drafts for owner review. They make no invented personal-experience, testimonial or learning-outcome claims. External sources are linked where used. The Windows guide describes the current product flow without hardcoding prices or availability.

The database is authoritative after migration: editing or unpublishing a post in Admin is never overwritten by application startup. Publication records the first publication time; published URLs remain fixed. Unpublished articles return 404, are marked noindex and disappear from the sitemap immediately.

The editor accepts paragraphs separated by blank lines, `##` headings, `-` lists, and standalone `[label](https://source.example)` or `[label](/products)` links. HTML is rendered as text. SEO title and description default to the article title and summary.

Production indexing is enabled only by the infrastructure configuration. Previews default to noindex; account, Admin, API and transactional pages remain noindex. After deployment, submit `https://yarizan.oarnova.games/sitemap.xml` in the existing `sc-domain:oarnova.games` Search Console property, which covers this subdomain. Submission helps discovery; Google decides whether and when to index.

Two additional drafts are included in migration 019, with original covers and no automatic publication:

5. [Pattern games at home](pattern-games-at-home.md)
6. [More, less and equal](more-less-and-equal-games.md)

Migration 021 adds two further original Persian drafts, each with a newly generated cover:

- [Place value](place-value-with-household-objects.md)
- [Shapes and colours](shape-and-colour-pattern-games.md)
