import { generateKeyPairSync, randomUUID, randomBytes, sign, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { Pool } = require('pg');
const { hash: hashPassword } = require('argon2');
const { canonical } = await import(
  new URL('../../../backend/dist/src/signing/signing.js', import.meta.url)
);
const { seal, totp } = await import(
  new URL('../../../backend/dist/src/security/crypto.js', import.meta.url)
);
const base = 'http://127.0.0.1:3100/api/v2';
export const password = 'SyntheticWeb!Password12345';
const database = new URL(
  process.env.DATABASE_URL ??
    'postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test',
);
database.pathname = '/yarizan_phase3_web_test';
export async function sql(query, args = []) {
  const pool = new Pool({ connectionString: database.toString() });
  try {
    return await pool.query(query, args);
  } finally {
    await pool.end();
  }
}
export async function call(route, body, auth) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3200',
      ...(typeof auth === 'string'
        ? { Authorization: 'Bearer ' + auth }
        : auth
          ? { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf }
          : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  return { status: response.status, body: result, headers: response.headers };
}
export function device(fingerprint) {
  const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    ...keys,
    fingerprint:
      fingerprint ?? createHash('sha256').update(randomBytes(32)).digest('hex').toUpperCase(),
    publicKey: keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
  };
}
export async function proof(key, purpose, pairing_id) {
  const fields = {
    fingerprint_version: 2,
    fingerprint_digest: key.fingerprint,
    device_public_key: key.publicKey,
  };
  const challenge = await call('/devices/challenges', {
    ...fields,
    purpose,
    ...(pairing_id ? { pairing_id } : {}),
  });
  assert.equal(challenge.status, 201);
  const transcript = {
    ...fields,
    challenge_id: challenge.body.challenge_id,
    nonce: challenge.body.nonce,
  };
  return {
    ...fields,
    challenge_id: challenge.body.challenge_id,
    challenge_signature: sign(
      'sha256',
      Buffer.from('YariZan-Device-Challenge-V2\n' + canonical(transcript)),
      { key: key.privateKey, dsaEncoding: 'ieee-p1363' },
    ).toString('base64url'),
  };
}
export async function pairing(key = device()) {
  const response = await call('/device-pairings', await proof(key, 'PAIR'));
  assert.equal(response.status, 201);
  return { key, ...response.body };
}
export async function customer() {
  const p = await pairing();
  assert.equal(
    (
      await call('/auth/claim', {
        pairing_id: p.pairing_id,
        pairing_secret: p.pairing_secret,
        password,
      })
    ).status,
    201,
  );
  const pickup = await call(
    `/device-pairings/${p.pairing_id}/pickup`,
    await proof(p.key, 'CONFIRM', p.pairing_id),
  );
  assert.equal(pickup.status, 201);
  return { key: p.key, ...pickup.body };
}
export async function admin(role = 'owner') {
  const secret = randomBytes(20).toString('hex'),
    id = randomUUID(),
    username = 'web-test-' + id;
  await sql('INSERT INTO admins(id,username,password_hash,mfa_ciphertext) VALUES($1,$2,$3,$4)', [
    id,
    username,
    await hashPassword(password, { type: 2, memoryCost: 65536, timeCost: 3, parallelism: 1 }),
    seal(secret, process.env.MFA_ENCRYPTION_KEY ?? '3'.repeat(64)),
  ]);
  await sql('INSERT INTO admin_user_roles VALUES($1,$2)', [id, role]);
  return { username, password, code: totp(secret, Math.floor(Date.now() / 30000)) };
}
export async function adminSession() {
  const a = await admin(),
    r = await call('/admin/auth/login', {
      username: a.username,
      password: a.password,
      mfa_code: a.code,
    });
  assert.equal(r.status, 201);
  return {
    cookie: r.headers
      .getSetCookie()
      .find((v) => v.startsWith('yz_admin='))
      .split(';')[0],
    csrf: r.body.csrf_token,
  };
}
export async function issue(e) {
  const a = await adminSession();
  const result = await call(
    '/admin/licenses/issue',
    {
      request_id: randomUUID(),
      reason: 'Synthetic browser ownership fixture',
      expected_revision: 1,
      evidence_ref: 'synthetic-independent-evidence-001',
      device_id: e.device_id,
      sku: 'YARIZAN-G1',
    },
    a,
  );
  assert.equal(result.status, 201);
}
