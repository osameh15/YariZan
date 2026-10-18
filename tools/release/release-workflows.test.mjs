import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseScopes, releaseWorkflows, eligibility } from './manifest.mjs';

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
