// Production copy guard. Fails on customer-visible text that must never ship:
//   - unresolved placeholders and draft markers, lorem ipsum;
//   - obsolete contacts (old personal domain, Telegram handle, old support address);
//   - support numbers, mailboxes or the eNamad code hard-coded outside shared/contact.ts;
//   - the local acceptance test price label used anywhere but the conditional local-only paths.
// With --build it also scans the built output (.output, .output-storefront, .output-brochure).
// With --require-approval it fails unless the legal policies are owner-approved (shared/legal.ts);
// the full-application production release runs it so unapproved legal text cannot reach the cutover.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const failures = [];

const forbidden = [
  [/\[نیاز به تأیید مالک/, 'unresolved owner placeholder'],
  [/پیش‌نویس:/, 'draft notice'],
  [/lorem ipsum/i, 'lorem ipsum'],
  [/support@osameh|t\.me\/osameh|@osameh_ir|telegram/i, 'obsolete contact'],
];
// Facts that may only be written in their single source of truth.
const single = [
  [/09188764024|09369642754|۰۹۱۸-۸۷۶-۴۰۲۴|۰۹۳۶-۹۶۴-۲۷۵۴/, 'support number', 'shared/contact.ts'],
  [/support@oarnova\.games|info@oarnova\.games/, 'studio mailbox', 'shared/contact.ts'],
  [/y2Y8bAJfRaMrTmiR3giBPYylZqSIoUvX/, 'eNamad code', 'shared/contact.ts'],
];
// The developer portfolio is an owner-approved footer link, not an obsolete support contact.
// Check its exact URL and sole occurrence in the reviewed SOURCE layout, which is the authority
// for all generated output profiles. Build chunks duplicate/minify that same link, so a naive
// global osameh.dev ban on built assets incorrectly rejects an approved production build.
const portfolioDomain = /osameh\.dev/i;
const portfolioSource = 'app/layouts/default.vue';
const portfolioHref = 'href="https://osameh.dev"';

async function* files(dir, exts) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.nuxt', '.local', 'test-results'].includes(e.name))
        yield* files(p, exts);
    } else if (exts.some((x) => e.name.endsWith(x))) yield p;
  }
}

async function scan(dir, exts, label) {
  for await (const file of files(dir, exts)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const text = await readFile(file, 'utf8');
    for (const [re, what] of forbidden)
      if (re.test(text)) failures.push(`${label} ${rel}: ${what}`);
    if (label === 'source') {
      // The personal domain is allowed only as the single explicit developer-portfolio footer link.
      // Any other source occurrence, including a support address or a second link, is rejected.
      if (portfolioDomain.test(text)) {
        const occurrences = text.match(/osameh\.dev/gi) ?? [];
        if (rel !== portfolioSource || occurrences.length !== 1 || !text.includes(portfolioHref))
          failures.push(`source ${rel}: personal domain outside the approved footer link`);
      }
      for (const [re, what, home] of single)
        if (re.test(text) && rel !== home) failures.push(`source ${rel}: ${what} outside ${home}`);
    }
  }
}

await scan(path.join(root, 'app'), ['.vue', '.ts'], 'source');
await scan(path.join(root, 'server'), ['.ts'], 'source');
await scan(path.join(root, 'shared'), ['.ts'], 'source');
if (args.has('--build'))
  for (const out of ['.output', '.output-storefront', '.output-brochure']) {
    const dir = path.join(root, out);
    if (await stat(dir).catch(() => null))
      await scan(dir, ['.html', '.js', '.mjs', '.json'], 'build');
  }
if (args.has('--require-approval')) {
  const legal = await readFile(path.join(root, 'shared/legal.ts'), 'utf8');
  const approved =
    /approved:\s*true/.test(legal) && /approvedOn:\s*'\d{4}-\d{2}-\d{2}'/.test(legal);
  if (!approved) failures.push('legal policies are not owner-approved (shared/legal.ts)');
}

if (failures.length) {
  for (const f of failures) console.error('FAIL ' + f);
  process.exit(1);
}
console.log(`Production copy guard: OK${args.has('--build') ? ' (source and build output)' : ''}`);
