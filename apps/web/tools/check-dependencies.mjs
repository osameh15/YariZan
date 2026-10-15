import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run through npm run audit:dependencies');
function audit(args) {
  const childEnv = { ...process.env };
  // npm 12 exports object configuration as an invalid child string; reload it from npmrc. Audit never runs scripts.
  for (const key of Object.keys(childEnv))
    if (/^npm_config_allow_scripts$/i.test(key)) delete childEnv[key];
  const result = spawnSync(
    process.execPath,
    [npm, 'audit', '--json', '--ignore-scripts', ...args],
    {
      encoding: 'utf8',
      env: childEnv,
      timeout: 60000,
    },
  );
  assert.ok(!result.error, 'Dependency audit must reach the registry');
  const data = JSON.parse(result.stdout);
  if (!data.metadata?.vulnerabilities)
    throw new Error(
      'AUDIT_UNAVAILABLE: ' +
        String(data.error?.code ?? data.message ?? Object.keys(data).join(',')),
    );
  return data;
}
const runtime = audit(['--omit=dev']);
assert.equal(runtime.metadata.vulnerabilities.high, 0);
assert.equal(runtime.metadata.vulnerabilities.critical, 0);
const all = audit([]),
  known = new Set([
    'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
    'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
  ]);
const roots = [];
for (const value of Object.values(all.vulnerabilities ?? {}))
  for (const via of value.via)
    if (typeof via === 'object') {
      assert.ok(
        known.has(via.url),
        'New dependency advisory requires independent review: ' + via.url,
      );
      assert.notEqual(via.severity, 'critical');
      roots.push({ name: via.name, url: via.url, severity: via.severity });
    }
const deployed = JSON.parse(await readFile('.output/server/package.json', 'utf8'));
for (const name of ['nuxt', 'braces', 'node-forge', 'listhen', 'micromatch'])
  assert.ok(
    !deployed.dependencies?.[name],
    'Unexpected vulnerable/development runtime dependency: ' + name,
  );
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = dir + '/' + entry.name;
    if (entry.isDirectory()) await scan(file);
    else if (/\.(?:m?js|json)$/.test(file)) {
      const text = await readFile(file, 'utf8');
      assert.ok(
        !/node-forge|micromatch|listhen/.test(text),
        'Development-only crypto/glob package entered runtime: ' + file,
      );
      assert.ok(
        !/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----|SyntheticWeb!Password|adminCookie|synthetic-independent-evidence/.test(
          text,
        ),
        'Test credential/key shortcut entered runtime: ' + file,
      );
    }
  }
}
await scan('.output');
await mkdir('.local', { recursive: true });
await writeFile(
  '.local/dependency-audit.json',
  JSON.stringify(
    {
      runtime: runtime.metadata.vulnerabilities,
      full: all.metadata.vulnerabilities,
      unpatchedBuildAdvisories: roots,
    },
    null,
    2,
  ),
);
console.log(
  'Runtime high/critical audit: zero; deployed artifact excludes development crypto/glob packages and synthetic provisioning secrets.',
);
if (roots.length)
  console.warn(
    'UNPATCHED_BUILD_DEPENDENCIES: ' +
      roots.map((v) => v.name + ' ' + v.url).join('; ') +
      ' — full audit remains nonzero; commercial acceptance blocked pending review.',
  );
