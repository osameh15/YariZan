# Blog and dashboard design

The existing YariZan screens and owner screenshots are the visual reference: warm paper, dark brown text, teal actions, 48px controls, restrained borders and Persian RTL typography. The changes keep those tokens and distinguish a clear primary action from supporting links. No fabricated learning scores or activity metrics are shown.

- Article pages: a real cover image, alt text, image dimensions, social preview and BlogPosting image metadata; previous/next links include only published articles. Images are included in the sitemap.
- Admin: searchable keyboard-operated article combobox; shared custom status select; direct links from the dashboard; the back link points to `/zanyari`. Uploaded images have private previews and become public only when a published article references them.
- Customer overview: context-sensitive next action, actual product/device/profile counts, product library, recent orders, shortcuts, help and published reading suggestions. Existing security, device and purchase operations retain their behavior.
- Homepage: the latest three published articles use the same editorial cards as the blog. Public-only fallback profiles do not query the API.

Uploads: JPG/PNG/WebP up to 8 MiB in the browser, resized and compressed before transfer. The authenticated upload endpoint alone permits a 512 KiB JSON envelope; other request limits remain unchanged. The server verifies and re-encodes images as WebP, strips metadata and bounds pixels and output size. Data is stored in PostgreSQL, so existing encrypted database backups include uploads. Draft-only uploaded images require Admin authentication. Migration 018 attaches the four generated covers without changing publication status or article text.

## Original cover illustrations

Generated using the built-in image generation tool. Deliverables are under `apps/web/public/blog-covers/`:

1. `choosing-an-educational-game.webp`
2. `number-games-at-home.webp`
3. `getting-started-with-yarizan.webp`
4. `helping-without-giving-the-answer.webp`

Shared prompt: “Use case: illustration-story. Asset type: wide editorial cover for a Persian educational games blog, landscape 3:2 composition, will be cropped to 16:9. Elegant contemporary hand-painted paper illustration, warm ivory background, restrained teal, ochre, terracotta and soft sage, fine paper grain, thoughtful human expressions and generous negative space. Family-friendly, calm and minimal, not a plastic 3D render or clip art. Keep all meaningful subjects inside the central 75 percent. No words, letters, numbers, logos, watermarks or UI text. Original illustration.”

Individual prompts:

1. “A parent and elementary-school child sitting together at a wooden table, thoughtfully choosing between a small colourful shape puzzle, wooden building blocks and a simple illustrated game card. Focus on curiosity and choosing together, tasteful home setting, a small green plant, balanced composition.”
2. “An overhead view of a child's and parent's hands arranging large wooden counters into small groups on a warm wooden table, alongside colourful pencils and blank rounded cards. Three distinct small groups invite counting and sorting. Welcoming practical home activity, beautiful tactile materials, simple and uncluttered.”
3. “A parent helping an elementary-school child set up a laptop on a tidy home desk. The screen shows a simple non-branded abstract learning game made only of coloured shapes, with no text or operating-system logo. A small blank notebook and plant nearby, approachable and reassuring.”
4. “An elementary-school child patiently considering a wooden shape puzzle at a table while a parent sits beside them, pointing gently at one piece without placing it. The child's hand reaches toward a possible solution, warm encouraging expressions, quiet collaborative scene, space around the subjects.”

## Footer

The footer uses the original horizontal logo from the brand kit, shorter navigation groups, four published article links, and separate telephone and email contact cards. The official trust seal and contact addresses are preserved.
