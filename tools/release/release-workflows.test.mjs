import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { releaseScopes, releaseWorkflows, eligibility, validateManifest } from './manifest.mjs';

// Static guarantees for each publishing workflow: one scope, one image profile, its own
// protected environment, manual trigger only, write credentials in exactly one job.
const read = (file) =>
  readFileSync(new URL(`../../.github/workflows/${file}`, import.meta.url), 'utf8').replace(
    /\r\n/g,
    '\n',
  );
const values = (text, pattern) => [...text.matchAll(pattern)].map((m) => m[1]);

for (const [scope, { file, environment }] of Object.entries(releaseWorkflows)) {
  test(`${file} publishes only scope ${scope} behind ${environment}`, () => {
    const text = read(file);
    const [image] = releaseScopes[scope];
    const profile = image.split(':')[1];
    assert.deepEqual(values(text, /^ {2}RELEASE_SCOPE: (\S+)$/gm), [scope]);
    assert.deepEqual(values(text, /^ {2}RELEASE_ENVIRONMENT: (\S+)$/gm), [environment]);
    assert.deepEqual(values(text, /^ {4}environment: (\S+)$/gm), [environment]);
    assert.deepEqual([...new Set(values(text, /^ {6}PROFILE: (\S+)$/gm))], [profile]);
    assert.deepEqual(values(text, /YARIZAN_BUILD_PROFILE=(\w+)/g), [profile]);
    assert.ok(text.includes(`eligibility:"${eligibility[image]}"`));
    assert.ok(!/yarizan-api|backend\/Dockerfile|YARIZAN_BUILD_PROFILE=full/.test(text));
    assert.equal(values(text, /^ {6}packages: (write)$/gm).length, 1, 'one job may write packages');
    assert.ok(/^on:\n {2}workflow_dispatch:\n/m.test(text), 'manual dispatch only');
    assert.ok(!/^ {2}(pull_request|pull_request_target|push|schedule|workflow_run):/m.test(text));
    // Scan before publish: the policy gate runs in the credential-free candidate job.
    const candidate = text.slice(text.indexOf('\n  candidate:'), text.indexOf('\n  publish:'));
    assert.ok(candidate.includes('node tools/release/check-scan.mjs'));
    assert.ok(!/packages: write|login|GHCR_TOKEN/.test(candidate));
    const publish = text.slice(text.indexOf('\n  publish:'), text.indexOf('\n  manifest:'));
    assert.ok(publish.includes('--preserve-digests'));
    assert.ok(publish.includes('differs from scanned'));
    // Attestation with push-to-registry reads Docker-format credentials: the push must log in to
    // that file, keep it until the attestation step, then remove it unconditionally.
    const login = publish.indexOf('skopeo login --authfile "$AUTHFILE"');
    const attest = publish.indexOf('actions/attest-build-provenance@');
    const cleanup = publish.indexOf('- name: Remove registry credentials');
    assert.ok(login > 0 && attest > login && cleanup > attest, 'login -> attest -> cleanup order');
    assert.ok(/AUTHFILE: \/home\/runner\/\.docker\/config\.json/.test(publish));
    assert.ok(/- name: Remove registry credentials\n {8}if: always\(\)/.test(publish));
    assert.ok(!publish.slice(0, attest).includes('skopeo logout'), 'no logout before attestation');
  });
}

test('every release scope has exactly one workflow and distinct environments', () => {
  assert.deepEqual(Object.keys(releaseWorkflows).sort(), Object.keys(releaseScopes).sort());
  const environments = Object.values(releaseWorkflows).map((w) => w.environment);
  assert.equal(new Set(environments).size, environments.length);
  assert.ok(
    !Object.values(releaseScopes)
      .flat()
      .some((i) => i === 'yarizan-web:full' || i.startsWith('yarizan-api')),
  );
});

// Execute the actual inline authorization code with a deterministic GitHub API stub.
// No network, credentials, publication or duplicated implementation of the policy.
const storefront = read('release-storefront.yml');
const verifyShell = storefront
  .split('        run: |\n')[1]
  .split('\n  # Build and scan')[0]
  .split('\n')
  .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
  .join('\n');
const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const sha = 'a'.repeat(40);
function verifySource(overrides = {}) {
  return spawnSync(
    bash,
    [
      '-c',
      `
    gh() {
      case "$2" in
        */compare/*) [ "$MOCK_COMPARE" != api-error ] || return 1; printf '%s' "$MOCK_COMPARE" ;;
        */actions/runs*) printf '%s' "$MOCK_CI" ;;
        */environments/*) printf '%s' "$MOCK_REVIEWERS" ;;
        *) echo 'Unexpected API call' >&2; return 1 ;;
      esac
    }
    ${verifyShell}
  `,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        COMMIT: sha,
        REPO: 'osameh15/YariZan',
        DISPATCH_EVENT: 'workflow_dispatch',
        DISPATCH_REF: 'refs/heads/main',
        RELEASE_ENVIRONMENT: 'yarizan-release-public-storefront',
        GITHUB_OUTPUT: '/dev/null',
        MOCK_COMPARE: 'identical',
        MOCK_CI: '1',
        MOCK_REVIEWERS: '1',
        ...overrides,
      },
    },
  );
}
for (const status of ['identical', 'behind']) {
  test(`storefront accepts main-reachable commit (${status})`, () => {
    const result = verifySource({ MOCK_COMPARE: status });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  });
}
for (const status of ['ahead', 'diverged', 'unknown', '', 'api-error']) {
  test(`storefront rejects unmerged or unproven source (${status})`, () => {
    assert.notEqual(verifySource({ MOCK_COMPARE: status }).status, 0);
  });
}
for (const ref of [
  'refs/heads/feat/yarizan-v2-full-web-release',
  'refs/tags/main',
  'refs/pull/7/merge',
  '',
]) {
  test(`storefront rejects dispatch outside main (${ref})`, () => {
    assert.notEqual(verifySource({ DISPATCH_REF: ref }).status, 0);
  });
}
for (const overrides of [
  { DISPATCH_EVENT: 'push' },
  { COMMIT: 'main' },
  { MOCK_CI: '0' },
  { MOCK_REVIEWERS: '0' },
]) {
  test(`storefront fails closed: ${JSON.stringify(overrides)}`, () => {
    assert.notEqual(verifySource(overrides).status, 0);
  });
}
test('storefront binds source checks to trusted context and preserves exact CI and migration metadata', () => {
  assert.ok(storefront.includes('DISPATCH_REF: ${{ github.ref }}'));
  assert.ok(storefront.includes('DISPATCH_EVENT: ${{ github.event_name }}'));
  assert.ok(!storefront.includes('/pulls'));
  assert.ok(storefront.includes('actions/runs?head_sha=$COMMIT'));
  assert.ok(storefront.includes('SCHEMA_MIGRATION_COUNT'));
  const schema = readFileSync(
    new URL('../../backend/src/database/schema-version.ts', import.meta.url),
    'utf8',
  );
  assert.match(schema, /SCHEMA_MIGRATION_COUNT = 10;/);
});

test('current storefront manifest reports migration 10 and rejects stale version 9', () => {
  const digest = 'sha256:' + '1'.repeat(64);
  const manifest = {
    schema: 'yarizan-release-manifest/v1',
    release_scope: 'public-storefront',
    source_commit: sha,
    ci_run_url: 'https://github.com/osameh15/YariZan/actions/runs/123',
    built_at: '2026-10-18T00:00:00Z',
    migrations: 10,
    environment_changes: [],
    route_changes: [],
    images: [
      {
        name: 'yarizan-web',
        profile: 'storefront',
        tag: 'storefront-' + sha.slice(0, 12),
        digest,
        reference: 'ghcr.io/osameh15/yarizan-web@' + digest,
        eligibility: 'public-storefront-candidate',
        scan: {
          tool: 'trivy',
          policy: 'stage-a-zero-high-critical',
          artifact_digest: digest,
          critical: 0,
          high: 0,
          medium: 1,
        },
      },
    ],
  };
  assert.deepEqual(validateManifest(manifest, { expectedMigrations: 10 }), []);
  manifest.migrations = 9;
  assert.ok(
    validateManifest(manifest, { expectedMigrations: 10 }).includes('migrations must equal 10'),
  );
});
