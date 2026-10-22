import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRegistry, compareText, evaluate } from './compare-patterns.mjs';

const templates = parseRegistry(
  readFileSync(new URL('../../backend/src/accounts/sms-templates.ts', import.meta.url), 'utf8'),
);

test('parses all seven registry patterns with one placeholder each', () => {
  assert.equal(templates.length, 7);
  assert.deepEqual(
    templates.map((t) => t.bodyId).sort(),
    ['559372', '559397', '559421', '559422', '559424', '562280', '562281'],
  );
  for (const t of templates) assert.equal(t.variables, 1);
});

test('an exact panel copy verifies; surrounding whitespace is ignored', () => {
  const t = templates.find((x) => x.bodyId === '559422');
  const r = evaluate(t, { bodyId: '559422', text: '  ' + t.text + '\r\n', approved: true });
  assert.equal(r.verified, true);
  assert.equal(r.registry_text_sha256, r.panel_text_sha256);
});

test('look-alike letters, wrong Body ID, missing approval and extra placeholders never verify', () => {
  const t = templates.find((x) => x.bodyId === '559424');
  const arabicYeh = t.text.replace('ی', 'ي');
  const diff = compareText(t.text, arabicYeh);
  assert.equal(diff.matches, false);
  assert.equal(diff.panel, 'U+064A');
  assert.match(diff.note, /Arabic Yeh/);
  assert.equal(evaluate(t, { bodyId: '559425', text: t.text, approved: true }).verified, false);
  assert.equal(evaluate(t, { bodyId: '559424', text: t.text, approved: false }).verified, false);
  assert.equal(
    evaluate(t, { bodyId: '559424', text: t.text + ' {1}', approved: true }).verified,
    false,
  );
});
