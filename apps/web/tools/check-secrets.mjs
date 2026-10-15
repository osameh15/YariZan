import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const files = execFileSync(
  'git',
  [
    'ls-files',
    '-z',
    'apps/web',
    'src/YariZan.Core/V2/DeviceProvisioning.cs',
    'tests/ProvisioningChecks',
  ],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
let checked = 0;
for (const file of files) {
  if (/(?:^|\/)(?:\.env$|\.local\/|node_modules\/)|public\/.*\.(?:pem|key)$/.test(file))
    throw new Error('Forbidden tracked web material: ' + file);
  if (!/\.(?:[cm]?ts|[cm]?js|vue|json|md|css|cs|csproj)$/.test(file)) continue;
  const text = readFileSync(path.join(root, file), 'utf8');
  if (/-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}/.test(text))
    throw new Error('Tracked private material: ' + file);
  checked++;
}
console.log(
  `Web/provisioning secret scan: ${checked} tracked text files; no private key blocks or GitHub credential patterns`,
);
