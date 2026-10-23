import { generateKeyPairSync, randomUUID, randomBytes, sign, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { Pool } = require('pg');
const { hash: hashPassword } = require('argon2');
const { canonical } = await import(
  new URL('../../../backend/dist/src/signing/signing.js', import.meta.url)
);
const { solvePow } = await import(
  new URL('../../../backend/dist/src/security/abuse.js', import.meta.url)
);
const { seal, unseal } = await import(
  new URL('../../../backend/dist/src/security/crypto.js', import.meta.url)
);
const base = 'http://127.0.0.1:3100/api/v2';
export const nextMobile = () => '09' + String(100000000 + Math.floor(Math.random() * 899999999));
export async function smsCode(id) {
  for (let n = 0; n < 200; n++) {
    try {
      const { readFile } = await import('node:fs/promises');
      const data = await readFile(
        new URL('../../../backend/.local/web-sms-outbox.jsonl', import.meta.url),
        'utf8',
      );
      for (const line of data.trim().split('\n').reverse()) {
        try {
          const m = JSON.parse(unseal(line, '4'.repeat(64)));
          if (m.challengeId === id) return m.code;
        } catch {
          /* concurrent fixture append */
        }
      }
    } catch {
      /* delivery has not completed */
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error('Fake SMS delivery missing');
}
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
// Price history is append-only: close the current row and append a new one in one transaction.
export async function setPrice(sku, amountIrr) {
  const pool = new Pool({ connectionString: database.toString() });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      'UPDATE product_prices SET ended_at=clock_timestamp() WHERE sku=$1 AND ended_at IS NULL',
      [sku],
    );
    await c.query(
      "INSERT INTO product_prices(id,sku,amount_irr,effective_at,source,pricing_revision) VALUES(gen_random_uuid(),$1,$2,clock_timestamp(),'BOOTSTRAP','pricing-2026-10-18-r9')",
      [sku, String(amountIrr)],
    );
    await c.query('COMMIT');
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
    await pool.end();
  }
}
export async function call(route, body, auth) {
  if (route === '/auth/claim' && body?.password && !body.otp) {
    const owner = await sql(
      "SELECT 1 FROM pairings p JOIN customers c ON c.device_id=p.device_id AND c.generation=p.generation AND c.state='ACTIVE' WHERE p.id=$1",
      [body.pairing_id],
    );
    if (!owner.rowCount) {
      const mobile = nextMobile();
      // G5: public OTP requests carry a solved proof of work, as the browser does.
      const issued = await call('/auth/challenge', { purpose: 'CLAIM', mobile });
      const sent = await call('/auth/claim/otp/request', {
        pairing_id: body.pairing_id,
        pairing_secret: body.pairing_secret,
        mobile,
        pow: {
          challenge: issued.body.challenge,
          counter: solvePow(issued.body.challenge, issued.body.bits),
        },
      });
      assert.equal(sent.status, 201);
      body = {
        ...body,
        otp: { challenge_id: sent.body.challenge_id, code: await smsCode(sent.body.challenge_id) },
      };
    }
  }

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
  const mobile = nextMobile();
  await sql('UPDATE admins SET mobile_ciphertext=$2,mobile_last4=$3 WHERE id=$1', [
    id,
    seal(mobile, '4'.repeat(64)),
    mobile.slice(-4),
  ]);
  return { username, password, mobile };
}
export async function adminSession() {
  const a = await admin();
  const sent = await call('/admin/auth/login', { username: a.username, password: a.password });
  assert.equal(sent.status, 201);
  const r = await call('/admin/auth/sms/verify', {
    challenge_id: sent.body.challenge_id,
    code: await smsCode(sent.body.challenge_id),
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
