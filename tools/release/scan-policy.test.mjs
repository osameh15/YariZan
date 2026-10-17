import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluateScan } from './scan-policy.mjs';

const artifact = 'localhost:5000/yarizan-web@sha256:' + 'a'.repeat(64);
const report = (...severities) => ({
  SchemaVersion: 2,
  ArtifactName: artifact,
  Results: [
    {
      Target: 'node_modules',
      Vulnerabilities: severities.map((Severity, i) => ({
        VulnerabilityID: `CVE-0-${i}`,
        Severity,
      })),
    },
  ],
});

test('clean candidate and medium/low findings pass and stay counted', () => {
  assert.equal(evaluateScan(report(), artifact).verdict, 'pass');
  const r = evaluateScan(report('MEDIUM', 'LOW', 'LOW'), artifact);
  assert.deepEqual([r.verdict, r.medium, r.low], ['pass', 1, 2]);
});
test('a synthetic HIGH or CRITICAL finding rejects the release', () => {
  for (const severity of ['HIGH', 'CRITICAL']) {
    const r = evaluateScan(report('MEDIUM', severity), artifact);
    assert.equal(r.verdict, 'fail', severity);
    assert.ok(r.reasons.some((x) => x.includes(severity)));
  }
});
test('unfixed HIGH findings are not exempt', () => {
  const r = report('HIGH');
  r.Results[0].Vulnerabilities[0].FixedVersion = '';
  assert.equal(evaluateScan(r, artifact).verdict, 'fail');
});
test('scan of another artifact, empty or malformed report fails closed', () => {
  const other = report();
  other.ArtifactName = 'localhost:5000/yarizan-web@sha256:' + 'b'.repeat(64);
  for (const bad of [
    other,
    {},
    undefined,
    { SchemaVersion: 2, ArtifactName: artifact },
    { ...report(), SchemaVersion: 1 },
  ])
    assert.equal(evaluateScan(bad, artifact).verdict, 'fail');
  const broken = report();
  broken.Results[0].Vulnerabilities = 'x';
  assert.equal(evaluateScan(broken, artifact).verdict, 'fail');
});
test('CLI exits non-zero on HIGH/CRITICAL and still writes evidence', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'yz-scan-'));
  try {
    const cli = new URL('./check-scan.mjs', import.meta.url).pathname.replace(
      /^\/([A-Za-z]:)/,
      '$1',
    );
    for (const [name, data, ok] of [
      ['clean', report('LOW'), true],
      ['high', report('HIGH'), false],
      ['critical', report('CRITICAL'), false],
      ['garbage', 'not json', false],
    ]) {
      const input = path.join(dir, name + '.json');
      const out = path.join(dir, name + '-summary.json');
      writeFileSync(input, typeof data === 'string' ? data : JSON.stringify(data));
      let code = 0;
      try {
        execFileSync(process.execPath, [cli, input, artifact, out], { stdio: 'pipe' });
      } catch (e) {
        code = e.status;
      }
      assert.equal(code === 0, ok, name);
      assert.equal(JSON.parse(readFileSync(out, 'utf8')).verdict, ok ? 'pass' : 'fail');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
