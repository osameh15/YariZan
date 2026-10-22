import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateManifest } from './manifest.mjs';

const migrations = Number(
  readFileSync(
    new URL('../../backend/src/database/schema-version.ts', import.meta.url),
    'utf8',
  ).match(/SCHEMA_MIGRATION_COUNT = (\d+)/)[1],
);

// Disposable rollback rehearsal. Everything runs on a private Docker network with a local
// registry; nothing touches GHCR, the VPS or any real data.
//   node tools/release/rollback-rehearsal.mjs <web-brochure-image> <api-image> <manifest-out>
// 1. Push "previous" and "next" releases to a local registry and deploy only by digest.
// 2. Web: previous → next → rollback to previous digest; /healthz after each step.
// 3. API + PostgreSQL volume: one-off migration, previous → next → rollback; the volume,
//    the schema_migrations count and a marker row survive (forward-only schema).
// 4. Write and validate a local release manifest.
const [webImage, apiImage, manifestOut] = process.argv.slice(2);
assert.ok(webImage && apiImage && manifestOut, 'usage: <web-image> <api-image> <manifest-out>');
const run = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 180000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const id = randomUUID().slice(0, 8);
const names = {
  registry: `yz-rr-registry-${id}`,
  network: `yz-rr-net-${id}`,
  volume: `yz-rr-db-${id}`,
};
const containers = new Set([names.registry]);
const registry = 'localhost:5000';
const REGISTRY_IMAGE =
  'registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373';
const POSTGRES_IMAGE =
  'postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24';
const hardening = [
  '--read-only',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges:true',
  '--user',
  '1000:1000',
  '--tmpfs',
  '/tmp:size=16m,uid=1000,gid=1000,mode=0700',
];
const keys = ['1', '2', '3'].map(
  (c, i) => `${['CODE_HMAC_KEY', 'TOKEN_HMAC_KEY', 'MFA_ENCRYPTION_KEY'][i]}=${c.repeat(64)}`,
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, label) {
  for (let i = 0; i < 80; i++) {
    try {
      if (check()) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error(`Timed out: ${label}`);
}
function publish(source, name, release) {
  // A derived image with a release label gives each rehearsal release its own digest.
  const tag = `${registry}/${name}:${release}`;
  execFileSync(
    'docker',
    ['build', '-q', '-t', tag, '--label', `rehearsal.release=${release}`, '-'],
    {
      input: `FROM ${source}\n`,
      encoding: 'utf8',
    },
  );
  run('push', '-q', tag);
  const digest = JSON.parse(run('image', 'inspect', tag))[0]
    .RepoDigests.find((d) => d.startsWith(`${registry}/${name}@`))
    .split('@')[1];
  assert.match(digest, /^sha256:[0-9a-f]{64}$/);
  return { reference: `${registry}/${name}@${digest}`, digest, tag: `${release}` };
}
function start(name, reference, args, command = []) {
  containers.add(name);
  run('rm', '-f', name);
  run('run', '-d', '--name', name, '--network', names.network, ...args, reference, ...command);
  return name;
}
const exec = (name, script) => run('exec', name, 'node', '-e', script);
const runningDigest = (name) => JSON.parse(run('inspect', name))[0].Config.Image;
try {
  run('network', 'create', names.network);
  run('run', '-d', '--name', names.registry, '-p', '127.0.0.1:5000:5000', REGISTRY_IMAGE);
  await until(
    () =>
      spawnSync('docker', [
        'exec',
        names.registry,
        'wget',
        '-q',
        '-O',
        '-',
        'http://127.0.0.1:5000/v2/',
      ]).status === 0,
    'registry',
  );
  const web = {
    previous: publish(webImage, 'yarizan-web', 'previous'),
    next: publish(webImage, 'yarizan-web', 'next'),
  };
  const api = {
    previous: publish(apiImage, 'yarizan-api', 'previous'),
    next: publish(apiImage, 'yarizan-api', 'next'),
  };
  assert.notEqual(web.previous.digest, web.next.digest);
  console.log(`Registry: previous/next releases pushed; deploying by digest only`);

  // Web rollback.
  const webEnv = ['--env', 'YARIZAN_SITE_MODE=brochure', ...hardening];
  const webHealthy = (name) =>
    until(
      () =>
        exec(
          name,
          "fetch('http://127.0.0.1:3200/healthz').then(async r=>{if(await r.text()!=='ok')process.exit(1)}).catch(()=>process.exit(1))",
        ) === '',
      'web healthz',
    );
  for (const [label, step] of [
    ['deploy', 'previous'],
    ['upgrade', 'next'],
    ['rollback', 'previous'],
  ]) {
    const name = start(`yz-rr-web-${id}`, web[step].reference, webEnv);
    await webHealthy(name);
    assert.equal(runningDigest(name), web[step].reference, `web runs ${step} digest`);
    run('stop', '--time', '20', name);
    console.log(`Web ${label}: ${web[step].digest.slice(0, 19)}… healthy`);
  }

  // API + database rollback with a persistent volume.
  const db = start(`yz-rr-db-${id}`, POSTGRES_IMAGE, [
    '--network-alias',
    'db',
    '-v',
    `${names.volume}:/var/lib/postgresql/data`,
    '--env',
    'POSTGRES_USER=yarizan',
    '--env',
    'POSTGRES_PASSWORD=rehearsal-disposable',
    '--env',
    'POSTGRES_DB=yarizan',
  ]);
  await until(
    () =>
      // Over TCP: on first start the image runs a temporary server on the Unix socket only and then
      // restarts it, so a socket check can pass before that restart and race the first migration.
      spawnSync('docker', ['exec', db, 'pg_isready', '-h', '127.0.0.1', '-U', 'yarizan', '-d', 'yarizan'])
        .status === 0,
    'postgres',
  );
  const url = 'postgresql://yarizan:rehearsal-disposable@db:5432/yarizan';
  const apiEnv = [
    '--env',
    'NODE_ENV=test',
    '--env',
    `DATABASE_URL=${url}`,
    ...keys.flatMap((k) => ['--env', k]),
    ...hardening,
  ];
  const oneOff = (reference, command) => {
    const name = `yz-rr-oneoff-${randomUUID().slice(0, 8)}`;
    containers.add(name);
    run('run', '--name', name, '--network', names.network, ...apiEnv, reference, ...command);
    run('rm', name);
    containers.delete(name);
  };
  oneOff(api.previous.reference, ['node', 'dist/src/database/migrate.js']);
  oneOff(api.previous.reference, ['node', 'dist/src/database/seed.js']);
  const psql = (sql) => run('exec', db, 'psql', '-U', 'yarizan', '-d', 'yarizan', '-tAc', sql);
  psql(
    "CREATE TABLE IF NOT EXISTS rehearsal_marker(id text PRIMARY KEY); INSERT INTO rehearsal_marker VALUES('customer-and-financial-record') ON CONFLICT DO NOTHING",
  );
  for (const step of ['previous', 'next', 'previous']) {
    if (step === 'next') oneOff(api.next.reference, ['node', 'dist/src/database/migrate.js']);
    const name = start(`yz-rr-api-${id}`, api[step].reference, apiEnv);
    await until(
      () =>
        exec(
          name,
          "fetch('http://127.0.0.1:3100/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
        ) === '',
      'api ready',
    );
    assert.equal(runningDigest(name), api[step].reference);
    run('stop', '--time', '20', name);
  }
  oneOff(api.previous.reference, ['node', 'dist/src/database/migrate.js', '--verify']);
  assert.equal(psql('SELECT count(*) FROM schema_migrations'), String(migrations));
  assert.equal(psql('SELECT count(*) FROM rehearsal_marker'), '1');
  assert.ok(
    run('volume', 'ls', '-q').split('\n').includes(names.volume),
    'Database volume preserved',
  );
  console.log(
    `API: previous → next → rollback by digest; volume, ${migrations} migrations and marker row preserved`,
  );

  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const short = commit.slice(0, 12);
  const manifest = {
    schema: 'yarizan-release-manifest/v1',
    release_scope: 'local-rehearsal',
    source_commit: commit,
    ci_run_url: 'local-rehearsal',
    built_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    migrations,
    environment_changes: [],
    route_changes: [],
    images: [
      {
        name: 'yarizan-web',
        profile: 'brochure',
        tag: `brochure-${short}`,
        digest: web.previous.digest,
        reference: web.previous.reference,
        eligibility: 'stage-a-brochure-candidate',
        scan: { tool: 'not-scanned-in-rehearsal', critical: 0, high: 0 },
      },
      {
        name: 'yarizan-api',
        tag: short,
        digest: api.previous.digest,
        reference: api.previous.reference,
        eligibility: 'blocked-stage-b',
        scan: { tool: 'not-scanned-in-rehearsal', critical: 0, high: 0 },
      },
    ],
  };
  const errors = validateManifest(manifest, {
    expectedMigrations: migrations,
    allowLocalRegistry: true,
  });
  assert.deepEqual(errors, []);
  writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Rehearsal manifest valid: ${manifestOut}`);
} finally {
  for (const name of containers) spawnSync('docker', ['rm', '-f', name]);
  spawnSync('docker', ['network', 'rm', names.network]);
  // Only the disposable rehearsal volume is removed, after the rehearsal has finished.
  spawnSync('docker', ['volume', 'rm', names.volume]);
}
