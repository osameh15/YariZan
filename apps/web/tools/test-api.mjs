import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../backend/package.json', import.meta.url));
const { Pool } = require('pg');
const root = fileURLToPath(new URL('../../../', import.meta.url));
process.env.NODE_ENV = 'test';
const base = new URL(
  process.env.DATABASE_URL ??
    'postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan_phase2_test',
);
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname));
base.pathname = '/yarizan_phase3_web_test';
process.env.DATABASE_URL = base.toString();
process.env.BROWSER_ORIGIN = 'http://localhost:3200';
process.env.PORT = '3100';
for (const [name, value] of [
  ['CODE_HMAC_KEY', '1'],
  ['TOKEN_HMAC_KEY', '2'],
  ['MFA_ENCRYPTION_KEY', '3'],
])
  process.env[name] ??= value.repeat(64);
const operator = new Pool({ connectionString: new URL('/postgres', base).toString() });
if (
  !(await operator.query("SELECT 1 FROM pg_database WHERE datname='yarizan_phase3_web_test'"))
    .rowCount
)
  await operator.query('CREATE DATABASE yarizan_phase3_web_test');
await operator.end();
process.chdir(path.join(root, 'backend'));
const { Database } = await import(
  new URL('../../../backend/dist/src/database/database.js', import.meta.url)
);
const { migrate } = await import(
  new URL('../../../backend/dist/src/database/migrate.js', import.meta.url)
);
const { seed } = await import(
  new URL('../../../backend/dist/src/database/seed.js', import.meta.url)
);
const db = new Database();
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/yarizan_phase3_web_test');
await db.query('DROP SCHEMA public CASCADE');
await db.query('CREATE SCHEMA public');
await migrate(db);
await seed(db);
await db.onModuleDestroy();
const { createApp } = await import(new URL('../../../backend/dist/src/main.js', import.meta.url));
const app = await createApp();
const { Signing } = await import(
  new URL('../../../backend/dist/src/signing/signing.js', import.meta.url)
);
const signing = app.get(Signing);
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../.local/web-public-root.json', import.meta.url),
  JSON.stringify({ kid: signing.keys.kid, publicKey: signing.keys.publicKey }),
);

await app.listen(3100, '127.0.0.1');
console.log('Isolated Phase 3 API ready; disposable database only; production gate closed');
