#!/usr/bin/env node
// Owner-side comparison of the MeliPayamak panel patterns with the repository registry.
// No network access, no provider call, no chargeable send. You copy what the panel shows; the tool
// compares it character by character with backend/src/accounts/sms-templates.ts and writes a
// redacted evidence file (hashes and verdicts only) to tools/sms-test/evidence/ (git-ignored).
//
//   node tools/sms-test/compare-patterns.mjs                  interactive, one pattern at a time
//   node tools/sms-test/compare-patterns.mjs --file <path>    read "<bodyId><TAB><text>" lines
//   node tools/sms-test/compare-patterns.mjs --list           print the expected registry only
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const registryFile = path.join(here, '../../backend/src/accounts/sms-templates.ts');

/** Parses the reviewed registry source (prettier-formatted object literals). */
export function parseRegistry(source) {
  const templates = [];
  for (const m of source.matchAll(/export const (\w+): SmsTemplate = \{([\s\S]*?)\n\};/g)) {
    const body = m[2];
    const field = (re) => body.match(re)?.[1];
    templates.push({
      name: m[1],
      bodyId: field(/bodyId: "(\d+)"/),
      verification: field(/verification: "(\w+)"/),
      variables: (field(/variables: \[([^\]]*)\]/) ?? '').match(/"[^"]*"/g)?.length ?? 0,
      text: field(/providerText:\s*"([^"]*)"/),
    });
  }
  if (!templates.length || templates.some((t) => !t.bodyId || !t.text))
    throw new Error('Registry could not be parsed; compare manually against sms-templates.ts');
  return templates;
}

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const codePoint = (ch) =>
  ch === undefined ? 'end of text' : 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
// Look-alike characters that commonly differ between a panel and a transcription.
const NOTES = {
  'ي': 'Arabic Yeh (ي) instead of Persian Yeh (ی)',
  'ك': 'Arabic Kaf (ك) instead of Persian Keheh (ک)',
  '‌': 'zero-width non-joiner (half space)',
  ' ': 'no-break space',
  '‏': 'right-to-left mark',
  '‎': 'left-to-right mark',
};

/** Exact comparison; only surrounding whitespace and line endings are ignored. */
export function compareText(expected, panel) {
  const a = [...expected.trim()];
  const b = [...panel.replace(/\r\n/g, '\n').trim()];
  const limit = Math.max(a.length, b.length);
  for (let i = 0; i < limit; i++)
    if (a[i] !== b[i])
      return {
        matches: false,
        position: i,
        expected: codePoint(a[i]),
        panel: codePoint(b[i]),
        note: NOTES[b[i]] ?? NOTES[a[i]] ?? null,
      };
  return { matches: true };
}

export function placeholders(text) {
  return new Set(text.match(/\{\d+\}/g) ?? []).size;
}

export function evaluate(template, input) {
  const text = compareText(template.text, input.text);
  const record = {
    pattern: template.name,
    body_id: template.bodyId,
    registry_verification: template.verification,
    panel_body_id_matches: input.bodyId === template.bodyId,
    approved_in_panel: input.approved,
    placeholders_expected: template.variables,
    placeholders_in_panel: placeholders(input.text),
    text_matches: text.matches,
    registry_text_sha256: sha256(template.text.trim()),
    panel_text_sha256: sha256(input.text.replace(/\r\n/g, '\n').trim()),
  };
  if (!text.matches) record.first_difference = text;
  record.verified =
    record.panel_body_id_matches &&
    record.approved_in_panel === true &&
    record.placeholders_in_panel === record.placeholders_expected &&
    record.text_matches;
  return record;
}

async function main() {
  const templates = parseRegistry(readFileSync(registryFile, 'utf8'));
  if (process.argv.includes('--list')) {
    for (const t of templates)
      console.log(`${t.bodyId}\t${t.name}\t${t.verification}\t{${t.variables} placeholder}\n\t${t.text}`);
    return;
  }
  const fileArg = process.argv.indexOf('--file');
  const fromFile =
    fileArg > 0
      ? new Map(
          readFileSync(process.argv[fileArg + 1], 'utf8')
            .split(/\r?\n/)
            .filter((l) => l.includes('\t'))
            .map((l) => [l.slice(0, l.indexOf('\t')).trim(), l.slice(l.indexOf('\t') + 1)]),
        )
      : null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q) => (await rl.question(q)).trim();
  const yesNo = async (q) => {
    for (;;) {
      const a = (await ask(q + ' Type y or n, then Enter: ')).toLowerCase();
      if (a === 'y' || a === 'yes') return true;
      if (a === 'n' || a === 'no') return false;
    }
  };
  console.log('No SMS is sent and nothing leaves this computer. Open the MeliPayamak panel now.');
  const results = [];
  for (const t of templates) {
    console.log(`\n=== ${t.name} (registry Body ID ${t.bodyId}, ${t.verification}) ===`);
    if (t.verification === 'PANEL_VERIFIED' && !(await yesNo('Already panel-verified. Compare again?')))
      continue;
    const bodyId = fromFile
      ? t.bodyId
      : await ask('Body ID shown in the panel for this pattern: ');
    const text = fromFile ? (fromFile.get(t.bodyId) ?? '') : await ask('Paste the panel text exactly: ');
    const approved = await yesNo('Does the panel show this pattern as approved (تایید شده)?');
    const r = evaluate(t, { bodyId, text, approved });
    results.push(r);
    console.log(r.verified ? 'MATCH' : 'DIFFERENT', JSON.stringify(r.first_difference ?? {}));
    if (!r.panel_body_id_matches) console.log('Body ID differs from the registry.');
    if (r.placeholders_in_panel !== r.placeholders_expected) console.log('Placeholder count differs.');
  }
  rl.close();
  const out = path.join(here, 'evidence');
  mkdirSync(out, { recursive: true });
  const file = path.join(out, `sms-pattern-comparison-${Date.now()}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        kind: 'sms-pattern-panel-comparison',
        at: new Date().toISOString(),
        chargeable_sends: 0,
        patterns: results,
        all_verified: results.length > 0 && results.every((r) => r.verified),
      },
      null,
      2,
    ),
  );
  console.log('\nRedacted evidence:', path.relative(process.cwd(), file));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
