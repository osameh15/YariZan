import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Container acceptance for the web image, matching the infrastructure runtime contract:
// uid/gid 1000, read-only root, cap_drop ALL, /tmp-only tmpfs, no network egress, 384 MiB,
// 0.75 CPU, fail-closed site mode, /healthz, and shutdown inside the 20 s grace period.
// Usage: node tools/release/check-web-image.mjs <image> <brochure|full>
const [image, profile] = process.argv.slice(2);
assert.ok(image && ['brochure', 'full'].includes(profile), 'usage: <image> <brochure|full>');
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hardening = [
  '--read-only',
  '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges:true',
  '--user', '1000:1000',
  '--tmpfs', '/tmp:size=16m,uid=1000,gid=1000,mode=0700',
  '--memory', '384m',
  '--memory-swap', '384m',
  '--cpus', '0.75',
  '--pids-limit', '128',
  '--network', 'none',
];
const results = { image, profile };
const config = JSON.parse(docker('image', 'inspect', image))[0].Config;
assert.equal(config.User, '1000:1000');
assert.deepEqual(config.Cmd, ['node', '.output/server/index.mjs']);
assert.equal(config.Labels['games.oarnova.yarizan.build-profile'], profile);
assert.ok(config.Env.includes('NODE_ENV=production'));
assert.ok(config.Env.includes('NITRO_SHUTDOWN_TIMEOUT=15000'));
assert.ok(!config.Env.some((v) => v.startsWith('YARIZAN_SITE_MODE=')), 'Image must not select a site mode');
console.log(`Image ${profile}: uid 1000, node .output/server/index.mjs, no default site mode`);

// Contents: no package managers, sources, tests, keys, environment files or synthetic secrets.
console.log(
  docker('run', '--rm', ...hardening, '--entrypoint', 'node', image, '-e', [
    "const f=require('fs');",
    "for(const p of ['/usr/local/bin/npm','/usr/local/bin/npx','/usr/local/bin/yarn','/usr/local/lib/node_modules/npm','/app/node_modules','/app/app','/app/tests','/app/server','/app/.env','/app/.local','/app/package.json'])if(f.existsSync(p))throw Error('Unexpected '+p);",
    "for(const p of ['/app','/app/.output','/app/.output/public'])try{f.accessSync(p,f.constants.W_OK);throw Error('Writable '+p)}catch(e){if(e.message.startsWith('Writable'))throw e}",
    "const walk=d=>f.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);",
    "const files=walk('/app/.output');",
    "const bad=files.filter(p=>/\\.(pem|key|map)$|\\.env$/.test(p));if(bad.length)throw Error('Forbidden files '+bad);",
    "const patterns=[/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/1{64}|2{64}|3{64}|4{64}|5{64}/,/local-disposable/,/gh[pousr]_[A-Za-z0-9]{30,}/];",
    "for(const p of files.filter(p=>/\\.(m?js|json|html|css)$/.test(p))){const t=f.readFileSync(p,'utf8');for(const r of patterns)if(r.test(t))throw Error('Secret pattern '+r+' in '+p)}",
    "f.writeFileSync('/tmp/probe','x');",
    "console.log('Contents: '+files.length+' files, no package manager/source/tests/keys/maps/secrets, read-only /app')",
  ].join('')),
);

const containers = new Set();
const start = (env) => {
  const name = 'yarizan-web-check-' + randomUUID();
  containers.add(name);
  docker('run', '-d', '--name', name, ...hardening, ...env.flatMap((e) => ['--env', e]), image);
  return name;
};
const refused = (env, text) => {
  const name = start(env);
  assert.equal(docker('wait', name), '1', `${text} exit code`);
  const output = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
  assert.ok((output.stdout + output.stderr).includes(text), `Missing ${text}`);
  docker('rm', name);
  containers.delete(name);
  console.log(`Startup refused: ${text}`);
};
// Requests run inside the container: it has no network interface besides loopback.
const probe = (name, script) =>
  docker('exec', name, 'node', '-e', `(async()=>{const b='http://127.0.0.1:3200';${script}})().catch(e=>{console.error(e.message);process.exit(1)})`);
try {
  const other = profile === 'brochure' ? 'full' : 'brochure';
  refused([], 'YARIZAN_SITE_MODE_REQUIRED');
  refused(['YARIZAN_SITE_MODE=staging'], 'YARIZAN_SITE_MODE_INVALID');
  refused([`YARIZAN_SITE_MODE=${other}`], 'YARIZAN_SITE_MODE_MISMATCH');
  // No API, database, SMS, payment or signing configuration is supplied.
  const name = start([`YARIZAN_SITE_MODE=${profile}`, 'NUXT_WEB_ORIGIN=https://yarizan.oarnova.games']);
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    try {
      probe(name, "const r=await fetch(b+'/healthz');if(r.status!==200)throw Error('not ready')");
      ready = true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'healthz never became ready');
  console.log(
    probe(name, `
      const h=await fetch(b+'/healthz');
      if(await h.text()!=='ok'||h.headers.get('cache-control')!=='no-store')throw Error('healthz contract');
      const brochure=${JSON.stringify(profile === 'brochure')};
      if(brochure){
        for(const p of ['/','/products','/products/grade-1','/support']){const r=await fetch(b+p);if(r.status!==200)throw Error(p+' '+r.status);const t=await r.text();if(!t.includes('dir="rtl"'))throw Error('rtl '+p)}
        for(const p of ['/account','/login','/zanyari','/checkout']){const r=await fetch(b+p,{headers:{accept:'text/html'}});if(r.status!==503||r.headers.get('cache-control')!=='no-store')throw Error(p+' '+r.status)}
        const a=await fetch(b+'/api/v2/devices/challenges',{method:'POST',body:'{}',headers:{'content-type':'application/json'}});
        if(a.status!==503||a.headers.get('retry-after')!=='3600'||(await a.text())!=='{"error":{"code":"SERVICE_UNAVAILABLE"}}')throw Error('api contract');
        for(let i=0;i<60;i++)await (await fetch(b+['/','/products','/products/grade-1','/support'][i%4])).text();
      }
      console.log('Runtime: healthz ok'+(brochure?', 4 public pages 200, disabled pages 503, API 503 JSON, 60-request load':' with no API'));
    `),
  );
  const stats = docker('stats', '--no-stream', '--format', '{{.MemUsage}}|{{.CPUPerc}}', name);
  results.memory = stats.split('|')[0];
  console.log(`Resource usage after load: ${stats}`);
  const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
  assert.ok(!/PRIVATE KEY|password|Error:/i.test(logs.stdout + logs.stderr), 'Unexpected log content');
  const before = Date.now();
  docker('stop', '--time', '20', name);
  const elapsed = Date.now() - before;
  const state = JSON.parse(docker('inspect', name))[0].State;
  assert.ok(elapsed < 20000, 'Shutdown inside the grace period');
  assert.ok(!state.OOMKilled, 'Not OOM killed');
  console.log(`Graceful stop in ${elapsed} ms, exit code ${state.ExitCode}`);
  docker('rm', name);
  containers.delete(name);
} finally {
  for (const name of containers) spawnSync('docker', ['rm', '-f', name]);
}
