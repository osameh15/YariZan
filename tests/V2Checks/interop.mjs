import fs from 'node:fs';
import { verify, sign, generateKeyPairSync } from 'node:crypto';
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const envelope = JSON.parse(input.envelope);
const message = Buffer.from('YariZan-License-V2\n' + canonical(envelope.payload));
const verified = verify('sha256', message, { key: input.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(envelope.signature, 'base64url'));
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
envelope.signature = sign('sha256', message, { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
console.log(JSON.stringify({ verified, canonical_matches: canonical(JSON.parse(input.unicode)) === input.canonical,
  publicKey: publicKey.export({ type: 'spki', format: 'pem' }), envelope }));
