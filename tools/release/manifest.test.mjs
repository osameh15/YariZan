import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from './manifest.mjs';

const sha = 'a'.repeat(40);
const d = (c) => 'sha256:' + c.repeat(64);
const valid = () => ({
  schema: 'yarizan-release-manifest/v1',
  source_commit: sha,
  ci_run_url: 'https://github.com/osameh15/YariZan/actions/runs/123',
  built_at: '2026-10-16T12:00:00Z',
  migrations: 9,
  environment_changes: ['YARIZAN_SITE_MODE (web, required)'],
  route_changes: [],
  images: [
    {
      name: 'yarizan-web',
      profile: 'brochure',
      tag: 'brochure-' + sha.slice(0, 12),
      digest: d('1'),
      reference: 'ghcr.io/osameh15/yarizan-web@' + d('1'),
      eligibility: 'stage-a-brochure-candidate',
      scan: { tool: 'trivy', critical: 0, high: 0 },
    },
    {
      name: 'yarizan-api',
      tag: sha.slice(0, 12),
      digest: d('2'),
      reference: 'ghcr.io/osameh15/yarizan-api@' + d('2'),
      eligibility: 'blocked-stage-b',
      scan: { tool: 'trivy', critical: 0, high: 0 },
    },
  ],
});
const opts = { expectedMigrations: 9 };

test('accepts a complete digest-pinned manifest', () => {
  assert.deepEqual(validateManifest(valid(), opts), []);
});
test('rejects mutable tags, malformed or mismatched digests', () => {
  for (const reference of [
    'ghcr.io/osameh15/yarizan-web:latest',
    'ghcr.io/osameh15/yarizan-web:brochure-aaaaaaaaaaaa',
    'ghcr.io/osameh15/yarizan-web@' + d('3'),
    'docker.io/osameh15/yarizan-web@' + d('1'),
    'localhost:5000/yarizan-web@' + d('1'),
  ]) {
    const m = valid();
    m.images[0].reference = reference;
    assert.ok(
      validateManifest(m, opts).some((e) => e.includes('reference')),
      reference,
    );
  }
  const m = valid();
  m.images[0].digest = 'sha256:1234';
  assert.ok(validateManifest(m, opts).some((e) => e.includes('digest')));
});
test('rejects wrong migration count, short commit and missing evidence', () => {
  const m = valid();
  m.migrations = 8;
  m.source_commit = 'abc1234';
  m.ci_run_url = 'https://example.com/run';
  delete m.images[1].scan;
  const errors = validateManifest(m, opts);
  for (const field of ['migrations', 'source_commit', 'ci_run_url', 'scan'])
    assert.ok(
      errors.some((e) => e.includes(field)),
      field,
    );
});
test('never classifies full application images as deployable', () => {
  const m = valid();
  m.images[1].eligibility = 'stage-a-brochure-candidate';
  assert.ok(validateManifest(m, opts).some((e) => e.includes('blocked-stage-b')));
  const w = valid();
  w.images[0].profile = 'full';
  assert.ok(validateManifest(w, opts).some((e) => e.includes('eligibility')));
});
test('local rehearsal registry is accepted only when explicitly allowed', () => {
  const m = valid();
  m.ci_run_url = 'local-rehearsal';
  for (const image of m.images)
    image.reference = image.reference.replace('ghcr.io/osameh15/', 'localhost:5000/');
  assert.ok(validateManifest(m, opts).length > 0);
  assert.deepEqual(validateManifest(m, { ...opts, allowLocalRegistry: true }), []);
});
