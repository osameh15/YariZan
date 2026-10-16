import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../app/', import.meta.url));
let checked = 0;
for (const file of await readdir(root, { recursive: true })) {
  if (!/\.(vue|ts|css)$/.test(file)) continue;
  const text = await readFile(path.join(root, file), 'utf8');
  if (/\?{3,}|\uFFFD/u.test(text)) throw Error('Corrupted UI copy: ' + file);
  checked++;
}
console.log('UI copy encoding guard: ' + checked + ' source files checked');
