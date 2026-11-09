import { createCipheriv, createHash, createHmac, generateKeyPairSync, pbkdf2Sync, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [mode, filename] = process.argv.slice(2);
if (mode === 'verify') {
  const result = JSON.parse(readFileSync(filename, 'utf8'));
  if (!verify('sha256', Buffer.from(result.message, 'base64'), { key: result.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(result.signature, 'base64')))
    throw new Error('Legacy CNG signature rejected by Node');
  console.log('PASS independent Node verification of legacy CNG P1363 signature');
} else if (mode === 'generate') {
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
      : JSON.stringify(value);
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const envelope = (payload, domain) => {
    payload = { ...payload, kid: 'disposable-legacy-test', issued_at: '2026-11-09T00:00:00Z' };
    return JSON.stringify({ algorithm: 'ES256-P1363', payload,
      signature: sign('sha256', Buffer.from(domain + canonical(payload)), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url') });
  };
  const device = '10000000-0000-4000-8000-000000000001', customer = '30000000-0000-4000-8000-000000000001';
  const sku = 'YARIZAN-S-COMBINATION-LAND', digest = 'A'.repeat(64);
  const enrollment = envelope({ format: 'YARIZAN-DEVICE-ENROLLMENT-V2', device_id: device,
    device_fingerprint_version: 2, device_fingerprint_digest: digest, device_key_digest: 'C'.repeat(64), profile_enrollment_id: customer }, 'YariZan-Device-Enrollment-V2\n');
  const license = envelope({ format: 'YARIZAN-LICENSE-V2', license_id: '20000000-0000-4000-8000-000000000001',
    customer_id: customer, device_id: device, sku, grade: 0, device_fingerprint_version: 2,
    device_fingerprint_digest: digest, expires_at: null, license_revision: 1 }, 'YariZan-License-V2\n');
  const revoked = envelope({ format: 'YARIZAN-LICENSE-DECISION-V2', license_id: '20000000-0000-4000-8000-000000000001',
    device_id: device, sku, device_fingerprint_version: 2, device_fingerprint_digest: digest,
    decision_version: 1, status: 'REVOKED' }, 'YariZan-License-Decision-V2\n');
  const master = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
  const gameKey = createHmac('sha256', master).update('YariZan-Standalone-Game-Key-V1\n' + sku).digest();
  const nonce = Buffer.from(Array.from({ length: 12 }, (_, i) => i));
  const plain = Buffer.from('YariZan legacy interoperability: سرزمین ترکیب‌ها');
  const cipher = createCipheriv('aes-256-gcm', gameKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const p384 = generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const k256 = generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).publicKey.export({ type: 'spki', format: 'pem' }).toString();
  writeFileSync(filename, JSON.stringify({ publicKey: pem, p384, k256, enrollment, license, revoked,
    fingerprint: createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').toUpperCase(),
    master: master.toString('base64'), gameKey: gameKey.toString('base64'), plain: plain.toString('base64'),
    blob: Buffer.concat([Buffer.from('YZG1'), nonce, cipher.getAuthTag(), encrypted]).toString('base64'),
    pbkdf2: pbkdf2Sync(Buffer.from('legacy-password'), Buffer.from('legacy-salt'), 100000, 32, 'sha256').toString('base64') }));
  console.log('Generated independent Node crypto fixtures; no production credentials used');
} else throw new Error('Usage: interop-fixture.mjs generate|verify FILE');
