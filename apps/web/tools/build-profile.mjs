import { spawnSync } from 'node:child_process';
// Cross-platform `YARIZAN_BUILD_PROFILE=<profile> nuxt build`.
const profile = process.argv[2];
if (!['brochure', 'storefront', 'full'].includes(profile))
  throw new Error('Profile must be brochure, storefront or full');
const result = spawnSync('npx', ['nuxt', 'build'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, YARIZAN_BUILD_PROFILE: profile },
});
process.exit(result.status ?? 1);
