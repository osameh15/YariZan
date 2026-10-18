// Disposable full-stack integration rehearsal. Synthetic only: never production, never public.
//
//   node tools/integration/full-stack-rehearsal.mjs <api-image> <full-web-image> <evidence-dir>
//
// Topology mirrors infrastructure apps/yarizan/compose.yaml: internal "db" and "app" networks,
// plus one "probe" bridge network whose ports are published on 127.0.0.1 only and stands in for
// Traefik (browser routes reach the web; desktop routes reach the API directly).
// Containers run with the production hardening flags (read-only, cap-drop ALL, no-new-privileges,
// uid 1000, tmpfs /tmp, memory limits). The API runs NODE_ENV=development in this disposable
// network so that its synthetic signing root persists in a throwaway directory for the desktop
// checks; fake SMS and fake ZarinPal only. Nothing here is a production approval.
//
// Requires: docker, backend/ built (npm ci && npm run build), .NET 9 for the desktop checks.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  createDecipheriv,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
} from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogDrift } from '../release/catalog-drift.mjs';
import { approvedPricing } from '../../apps/web/shared/approved-pricing.ts';

const [apiImage, webImage, evidenceArg] = process.argv.slice(2);
assert.ok(
  apiImage && webImage && evidenceArg,
  'usage: <api-image> <full-web-image> <evidence-dir>',
);
const repo = fileURLToPath(new URL('../../', import.meta.url));
const backendRequire = createRequire(path.join(repo, 'backend/package.json'));
const argon2 = backendRequire('argon2');
const { seal, hash } = backendRequire('./dist/src/security/crypto.js');
const { canonical } = backendRequire('./dist/src/signing/signing.js');

const evidence = path.resolve(evidenceArg);
const id = randomUUID().slice(0, 8);
const names = {
  db: `yz-int-db-${id}`,
  api: `yz-int-api-${id}`,
  web: `yz-int-web-${id}`,
  dbNet: `yz-int-db-net-${id}`,
  appNet: `yz-int-app-net-${id}`,
  probeNet: `yz-int-probe-${id}`,
};
const ports = { api: 13100, web: 13200 };
const webOrigin = `http://localhost:${ports.web}`;
const apiRoot = `http://127.0.0.1:${ports.api}/`;
const local = path.join(evidence, 'api-local');
const keys = {
  CODE_HMAC_KEY: randomBytes(32).toString('hex'),
  TOKEN_HMAC_KEY: randomBytes(32).toString('hex'),
  MFA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  MOBILE_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  OTP_HMAC_KEY: randomBytes(32).toString('hex'),
};
const dbPassword = randomBytes(18).toString('hex');
// The API writes its synthetic signing key and fake SMS outbox (mode 0600) into a bind mount
// that this runner must read, so on Linux it runs as the runner's own non-root uid/gid.
const apiUser =
  process.getuid && process.getuid() !== 0
    ? `${process.getuid()}:${process.getgid()}`
    : '1000:1000';
// The infrastructure's pinned PostgreSQL 17.11 image. The digest is immutable, so the Docker Hub
// fallback (used only if the ECR mirror throttles) yields byte-identical content.
const POSTGRES_DIGEST = 'sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24';
const POSTGRES_SOURCES = [
  `public.ecr.aws/docker/library/postgres:17.11-alpine@${POSTGRES_DIGEST}`,
  `docker.io/library/postgres@${POSTGRES_DIGEST}`,
];
async function pullPostgres() {
  for (const reference of POSTGRES_SOURCES)
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (spawnSync('docker', ['pull', '-q', reference], { stdio: 'ignore' }).status === 0)
        return reference;
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  throw new Error('PostgreSQL 17.11 image could not be pulled by digest');
}
const log = [];
const step = (message) => {
  log.push(message);
  console.log('✔ ' + message);
};
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const hardening = [
  '--read-only',
  '--cap-drop',
  'ALL',
  '--security-opt',
  'no-new-privileges:true',
  '--tmpfs',
  '/tmp:size=16m,uid=1000,gid=1000,mode=0700',
];
const dbUrl = `postgresql://postgres:${dbPassword}@db:5432/yarizan`;
const apiEnv = [
  'NODE_ENV=development',
  'PORT=3100',
  `DATABASE_URL=${dbUrl}`,
  `MIGRATION_DATABASE_URL=${dbUrl}`,
  `BROWSER_ORIGIN=${webOrigin}`,
  'COMMERCE_MODE=fake',
  'SMS_PROVIDER=fake',
  'SMS_FAKE_OUTBOX=.local/sms-outbox.jsonl',
  'SMS_ALLOW_LIVE=false',
  ...Object.entries(keys).map(([k, v]) => `${k}=${v}`),
].flatMap((e) => ['-e', e]);
const sql = (query) =>
  docker(
    'exec',
    names.db,
    'psql',
    '-U',
    'postgres',
    '-d',
    'yarizan',
    '-v',
    'ON_ERROR_STOP=1',
    '-tAc',
    query,
  );

async function waitFor(url, label, tries = 120) {
  for (let n = 0; n < tries; n++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not ready yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(label + ' never became ready');
}

// HTTP helpers: browser routes go through the web, desktop routes straight to the API.
async function call(base, route, { body, method, browser, bearer } = {}) {
  const headers = { Accept: 'application/json', Origin: webOrigin };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (browser) Object.assign(headers, { Cookie: browser.cookie, 'X-CSRF-Token': browser.csrf });
  if (bearer) headers.Authorization = 'Bearer ' + bearer;
  const send = () =>
    fetch(base + route, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
  let r;
  try {
    r = await send();
  } catch (error) {
    // A pooled keep-alive connection that the server closed while idle (for example during the
    // long desktop stage) fails before the request is sent; retry exactly once on a new socket.
    if (!/other side closed|ECONNRESET/.test(String(error?.cause?.message ?? error?.cause?.code)))
      throw error;
    r = await send();
  }
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, body: json, headers: r.headers };
}
const web = (route, options) => call(`${webOrigin}/api/v2/`, route, options);
const api = (route, options) => call(`${apiRoot}api/v2/`, route, options);
const expectOk = (r, label) => {
  assert.ok(r.status < 300, `${label}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
const expectError = (r, code, label) => {
  assert.ok(r.status >= 400, `${label}: expected ${code}, got ${r.status}`);
  assert.equal(r.body?.error?.code, code, label);
};
// Session cookie (yz_customer or yz_admin) plus the synchronizer token from the response body.
const session = (r) => ({
  cookie: r.headers
    .getSetCookie()
    .find((c) => /^yz_(?:customer|admin)=/.test(c))
    .split(';')[0],
  csrf: r.body.csrf_token,
});
const mutation = (expected_revision = 1) => ({
  request_id: randomUUID(),
  reason: 'Synthetic integration rehearsal operation',
  expected_revision,
  evidence_ref: 'synthetic-integration-rehearsal',
});

// Fake SMS: the API appends AES-256-GCM sealed lines {challengeId, code}; only this test reads them.
async function otp(challengeId) {
  const file = path.join(local, 'sms-outbox.jsonl');
  for (let n = 0; n < 200; n++) {
    if (existsSync(file))
      for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
        try {
          const raw = Buffer.from(line.trim(), 'base64url');
          const d = createDecipheriv(
            'aes-256-gcm',
            Buffer.from(keys.MOBILE_ENCRYPTION_KEY, 'hex'),
            raw.subarray(0, 12),
          );
          d.setAuthTag(raw.subarray(12, 28));
          const m = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString());
          if (m.challengeId === challengeId) return m.code;
        } catch {
          /* partial line */
        }
      }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('synthetic SMS not delivered');
}

// Synthetic desktop device: software P-256 key, random fingerprint, key-proof challenges.
function device() {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
    fingerprint: hash(randomBytes(32)),
  };
}
async function proof(key, purpose, pairing_id) {
  const fields = {
    fingerprint_version: 2,
    fingerprint_digest: key.fingerprint,
    device_public_key: key.publicKey,
  };
  const c = expectOk(
    await api('devices/challenges', {
      body: { ...fields, purpose, ...(pairing_id ? { pairing_id } : {}) },
    }),
    'challenge',
  );
  const transcript = { ...fields, challenge_id: c.challenge_id, nonce: c.nonce };
  return {
    ...fields,
    challenge_id: c.challenge_id,
    challenge_signature: sign(
      'sha256',
      Buffer.from('YariZan-Device-Challenge-V2\n' + canonical(transcript)),
      {
        key: key.privateKey,
        dsaEncoding: 'ieee-p1363',
      },
    ).toString('base64url'),
  };
}
let mobileSeed = 10000000 + Math.floor(Math.random() * 80000000);
async function enroll() {
  const key = device();
  const p = expectOk(await api('device-pairings', { body: await proof(key, 'PAIR') }), 'pairing');
  const sent = expectOk(
    await web('auth/claim/otp/request', {
      body: {
        pairing_id: p.pairing_id,
        pairing_secret: p.pairing_secret,
        mobile: '091' + ++mobileSeed,
      },
    }),
    'claim OTP',
  );
  const claim = await web('auth/claim', {
    body: {
      pairing_id: p.pairing_id,
      pairing_secret: p.pairing_secret,
      password: 'Synthetic!Integration12345',
      otp: { challenge_id: sent.challenge_id, code: await otp(sent.challenge_id) },
    },
  });
  expectOk(claim, 'claim');
  const enrolled = expectOk(
    await api(`device-pairings/${p.pairing_id}/pickup`, {
      body: await proof(key, 'CONFIRM', p.pairing_id),
    }),
    'pickup',
  );
  return { key, enrolled, browser: session(claim) };
}

const containers = [names.web, names.api, names.db];
const networks = [names.probeNet, names.appNet, names.dbNet];
try {
  mkdirSync(local, { recursive: true });
  chmodSync(local, 0o777); // the API container runs as uid 1000
  for (const net of [names.dbNet, names.appNet]) docker('network', 'create', '--internal', net);
  docker('network', 'create', names.probeNet);

  docker(
    'run',
    '-d',
    '--name',
    names.db,
    '--network',
    names.dbNet,
    '--network-alias',
    'db',
    '--memory',
    '512m',
    '-e',
    'POSTGRES_DB=yarizan',
    '-e',
    'POSTGRES_USER=postgres',
    '-e',
    `POSTGRES_PASSWORD=${dbPassword}`,
    await pullPostgres(),
  );
  for (let n = 0; n < 60; n++) {
    if (
      spawnSync('docker', [
        'exec',
        names.db,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'yarizan',
      ]).status === 0
    )
      break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  // The loop waits for TCP readiness: the image's temporary init server listens on the socket only.
  assert.match(sql('SELECT version()'), /PostgreSQL 17\.11/);
  step('PostgreSQL 17.11 on an internal network with no published port');

  // One-off migration and reviewed production bootstrap with approved price initialization.
  const oneOff = (...command) =>
    docker(
      'run',
      '--rm',
      '--network',
      names.dbNet,
      ...hardening,
      '--user',
      apiUser,
      ...apiEnv,
      apiImage,
      ...command,
    );
  oneOff('node', 'dist/src/database/migrate.js');
  const bootstrap = oneOff(
    'node',
    'dist/src/database/production-bootstrap.js',
    `--initialize-prices=${approvedPricing.revision}`,
  );
  assert.match(bootstrap, /"products_created":6/);
  assert.match(
    bootstrap,
    /"initialized":\["YARIZAN-G1","YARIZAN-G2","YARIZAN-G3","YARIZAN-G4","YARIZAN-G5","YARIZAN-G6"\]/,
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM product_prices WHERE source='BOOTSTRAP' AND amount_irr=12990000 AND ended_at IS NULL",
    ),
    '6',
  );
  assert.equal(
    sql("SELECT count(*) FROM products WHERE publication_status='hidden' AND NOT sale_enabled"),
    '6',
  );
  step(
    'Migrations (10) and production bootstrap: six hidden products, six audited approved prices',
  );

  docker(
    'run',
    '-d',
    '--name',
    names.api,
    '--network',
    names.appNet,
    '--network-alias',
    'api',
    ...hardening,
    '--user',
    apiUser,
    '--memory',
    '512m',
    '-v',
    `${local}:/app/.local`,
    '-p',
    `127.0.0.1:${ports.api}:3100`,
    ...apiEnv,
    apiImage,
  );
  docker('network', 'connect', names.dbNet, names.api);
  docker('network', 'connect', names.probeNet, names.api);
  await waitFor(`${apiRoot}ready`, 'API');
  docker(
    'run',
    '-d',
    '--name',
    names.web,
    '--network',
    names.appNet,
    ...hardening,
    '--user',
    '1000:1000',
    '--memory',
    '384m',
    '-p',
    `127.0.0.1:${ports.web}:3200`,
    '-e',
    'YARIZAN_SITE_MODE=full',
    '-e',
    'NUXT_API_BASE=http://api:3100/api/v2/',
    '-e',
    `NUXT_WEB_ORIGIN=${webOrigin}`,
    webImage,
  );
  docker('network', 'connect', names.probeNet, names.web);
  await waitFor(`${webOrigin}/healthz`, 'web');
  step('API and full web started from their production images with hardened runtime flags');

  // 1. Public catalog before and after Admin publication through the web proxy.
  assert.deepEqual(expectOk(await web('products'), 'products'), []);
  // Each stage signs in a separate synthetic owner (own mobile): permissioned Admin operations
  // need SMS MFA within five minutes, and the real OTP cooldown refuses rapid re-sends to one phone.
  const adminPassword = 'Synthetic!IntegrationAdmin1';
  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
  let admins = 0;
  const adminSession = async () => {
    const adminId = randomUUID(),
      adminName = `integration-owner-${id}-${++admins}`,
      adminMobile = '0912' + String(1000000 + Math.floor(Math.random() * 8999999));
    sql(
      `INSERT INTO admins(id,username,password_hash,mfa_ciphertext,mobile_ciphertext,mobile_last4) VALUES('${adminId}','${adminName}','${passwordHash}','${seal(randomBytes(20).toString('hex'), keys.MFA_ENCRYPTION_KEY)}','${seal(adminMobile, keys.MOBILE_ENCRYPTION_KEY)}','${adminMobile.slice(-4)}')`,
    );
    sql(`INSERT INTO admin_user_roles VALUES('${adminId}','owner')`);
    const challenge = expectOk(
      await web('admin/auth/login', { body: { username: adminName, password: adminPassword } }),
      'admin login',
    );
    const verified = await web('admin/auth/sms/verify', {
      body: { challenge_id: challenge.challenge_id, code: await otp(challenge.challenge_id) },
    });
    expectOk(verified, 'admin SMS MFA');
    return session(verified);
  };
  let admin = await adminSession();
  step('Admin signed in through the web with password and synthetic SMS second factor');

  for (const p of approvedPricing.products) {
    const launch = p.launch === 'launch-candidate';
    expectOk(
      await web(`admin/products/${p.sku}`, {
        method: 'PATCH',
        browser: admin,
        body: {
          ...mutation(1),
          price_irr: p.price_irr,
          publication_status: launch ? 'published' : 'coming_soon',
          sale_enabled: launch,
          trial_enabled: launch,
          activation_enabled: launch,
        },
      }),
      'publish ' + p.sku,
    );
  }
  const catalog = expectOk(await web('products'), 'products');
  writeFileSync(path.join(evidence, 'live-catalog.json'), JSON.stringify(catalog, null, 2));
  assert.deepEqual(catalogDrift(approvedPricing, catalog), []);
  assert.deepEqual(
    catalog.map((p) => [p.sku, p.price_irr, p.publication_status, p.sale_enabled]),
    [
      ['YARIZAN-G1', 12990000, 'published', true],
      ...[2, 3, 4, 5, 6].map((g) => [`YARIZAN-G${g}`, 12990000, 'coming_soon', false]),
    ],
  );
  assert.equal(sql("SELECT count(*) FROM product_prices WHERE sku='YARIZAN-G1'"), '2');
  assert.equal(
    sql("SELECT source FROM product_prices WHERE sku='YARIZAN-G1' AND ended_at IS NULL"),
    'ADMIN',
  );
  step(
    'Admin published G1 and Coming Soon G2-G6; live catalog equals the approved pricing revision (no drift)',
  );

  // 2. Negative and forbidden paths.
  expectError(
    await web('devices/challenges', { body: {} }),
    'NOT_FOUND',
    'desktop route through web',
  );
  expectError(
    await web('orders', { body: { request_id: randomUUID(), sku: 'YARIZAN-G1' } }),
    'UNAUTHENTICATED',
    'anonymous order',
  );
  expectError(await api('admin/customers'), 'UNAUTHENTICATED', 'anonymous admin');
  const forged = await web(
    'payments/zarinpal/return?Authority=FAKE-00000000-0000-4000-8000-000000000000&Status=OK',
  );
  assert.ok(
    forged.status >= 400 || forged.body?.paid !== true,
    'forged browser callback never pays',
  );
  step(
    'Desktop routes absent from the web proxy; anonymous orders, Admin and forged callbacks refused',
  );

  // 3. Desktop journey with the production C# client code (pairing, OTP account, credentials,
  //    trial, G1 purchase, automatic activation, restart, offline license, revocation, reset).
  admin = await adminSession();
  const fixture = path.join(evidence, 'desktop-fixture.json');
  const signingPem = readFileSync(path.join(local, 'development-signing.pem'), 'utf8');
  const publicKey = createPublicKey(signingPem).export({ type: 'spki', format: 'pem' }).toString();
  const kid =
    'disposable-development-' +
    hash(createPublicKey(signingPem).export({ type: 'spki', format: 'der' })).slice(0, 16);
  writeFileSync(
    fixture,
    JSON.stringify({
      provisioning: true,
      commerce: true,
      sms_fixture_path: path.join(local, 'sms-outbox.jsonl'),
      mobile_key: keys.MOBILE_ENCRYPTION_KEY,
      apiBase: apiRoot,
      origin: webOrigin,
      kid,
      publicKey,
      adminCookie: admin.cookie,
      adminCsrf: admin.csrf,
    }),
  );
  for (const project of [
    'tests/BackendInterop',
    ...(process.platform === 'win32' ? ['tests/ProvisioningChecks'] : []),
  ]) {
    const out = execFileSync(
      'dotnet',
      ['run', '--project', path.join(repo, project), '-c', 'Release', '--', fixture],
      {
        encoding: 'utf8',
        timeout: 600000,
      },
    );
    writeFileSync(path.join(evidence, path.basename(project) + '.txt'), out);
    assert.match(out, /DOTNET_PROVISIONING \d+ passed, 0 failed/);
  }
  step(
    'Desktop journey with the production C# client: pairing, OTP account, purchase, automatic activation, offline restart',
  );

  // 4. Browser checkout with coupon, simulated gateway, fulfillment, history and Admin finance.
  admin = await adminSession();
  const buyer = await enroll();
  const campaign = expectOk(
    await web('admin/commerce/campaigns', {
      browser: admin,
      body: {
        ...mutation(),
        name: 'Integration campaign',
        starts_at: new Date(Date.now() - 60000).toISOString(),
        ends_at: new Date(Date.now() + 86400000).toISOString(),
        enabled: true,
        max_redemptions: 10,
        max_per_customer: 1,
      },
    }),
    'campaign',
  );
  const code = 'INT-' + randomBytes(4).toString('hex').toUpperCase();
  expectOk(
    await web('admin/commerce/coupons', {
      browser: admin,
      body: {
        ...mutation(),
        campaign_id: campaign.id,
        code,
        type: 'percent',
        value: 10,
        max_discount_irr: null,
        min_order_irr: null,
        enabled: true,
        max_redemptions: 10,
        max_per_customer: 1,
        skus: ['YARIZAN-G1'],
      },
    }),
    'coupon',
  );
  expectError(
    await web('discounts/quote', {
      browser: buyer.browser,
      body: { sku: 'YARIZAN-G1', coupon: 'NOT-A-CODE' },
    }),
    'COUPON_UNAVAILABLE',
    'bad coupon',
  );
  const quote = expectOk(
    await web('discounts/quote', {
      browser: buyer.browser,
      body: { sku: 'YARIZAN-G1', coupon: code },
    }),
    'quote',
  );
  assert.deepEqual(
    [quote.subtotal_irr, quote.discount_irr, quote.total_irr].map(Number),
    [12990000, 1299000, 11691000],
  );
  expectError(
    await web('orders', {
      browser: buyer.browser,
      body: { request_id: randomUUID(), sku: 'YARIZAN-G1', total_irr: 1 },
    }),
    'INVALID_REQUEST',
    'client price',
  );
  expectError(
    await web('orders', {
      browser: buyer.browser,
      body: { request_id: randomUUID(), sku: 'YARIZAN-G2' },
    }),
    'PRODUCT_NOT_AVAILABLE',
    'Coming Soon purchase',
  );
  const request = { request_id: randomUUID(), sku: 'YARIZAN-G1', coupon: code };
  const order = expectOk(await web('orders', { browser: buyer.browser, body: request }), 'order');
  assert.equal(
    expectOk(await web('orders', { browser: buyer.browser, body: request }), 'order retry').id,
    order.id,
  );
  assert.equal(Number(order.total_irr), 11691000);
  expectOk(
    await web(`orders/${order.id}/payments`, {
      browser: buyer.browser,
      body: { request_id: randomUUID() },
    }),
    'payment',
  );
  expectOk(
    await web(`orders/${order.id}/simulate`, {
      browser: buyer.browser,
      body: { outcome: 'SUCCESS' },
    }),
    'simulate',
  );
  let state = '';
  for (let n = 0; n < 120 && state !== 'FULFILLED'; n++) {
    state = expectOk(
      await web(`orders/${order.id}`, { browser: buyer.browser }),
      'order read',
    ).state;
    if (state !== 'FULFILLED') await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(state, 'FULFILLED');
  // Signed license pickup by the device credential, exactly once per entitlement.
  const auth = expectOk(
    await api('devices/authenticate', { body: await proof(buyer.key, 'AUTH') }),
    'device auth',
  );
  const first = expectOk(
    await api('desktop/licenses/pickup', { bearer: auth.credential, body: { sku: 'YARIZAN-G1' } }),
    'license',
  );
  const second = expectOk(
    await api('desktop/licenses/pickup', { bearer: auth.credential, body: { sku: 'YARIZAN-G1' } }),
    'license again',
  );
  assert.equal(first.payload.license_id, second.payload.license_id);
  assert.equal(first.payload.sku, 'YARIZAN-G1');
  assert.equal(
    sql(
      `SELECT count(*) FROM order_fulfillments f JOIN order_items i ON i.id=f.order_item_id WHERE i.order_id='${order.id}'`,
    ),
    '1',
  );
  const history = expectOk(
    await web('account/orders', { browser: buyer.browser }),
    'order history',
  );
  assert.ok(JSON.stringify(history).includes(order.id));
  const finance = expectOk(await web('admin/commerce/finance', { browser: admin }), 'finance');
  writeFileSync(path.join(evidence, 'admin-finance.json'), JSON.stringify(finance, null, 2));
  const adminOrder = expectOk(
    await web(`admin/commerce/orders/${order.id}`, { browser: admin }),
    'admin order',
  );
  assert.ok(adminOrder.transitions.length > 0 && adminOrder.reconciliation.length > 0);
  step(
    'Coupon checkout (10%: 1,169,100 Toman), simulated verification, one signed license, order history and Admin finance',
  );

  writeFileSync(
    path.join(evidence, 'summary.json'),
    JSON.stringify({ result: 'passed', steps: log }, null, 2),
  );
  console.log(`Full-stack rehearsal passed: ${log.length} stages`);
} finally {
  for (const [name, file] of [
    [names.api, 'api.log'],
    [names.web, 'web.log'],
  ]) {
    const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
    writeFileSync(path.join(evidence, file), (logs.stdout ?? '') + (logs.stderr ?? ''));
  }
  // Remove only what this rehearsal created.
  for (const name of containers) spawnSync('docker', ['rm', '-f', name]);
  for (const net of networks) spawnSync('docker', ['network', 'rm', net]);
}
