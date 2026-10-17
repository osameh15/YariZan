import { readFileSync } from 'node:fs';
import { validateManifest } from './manifest.mjs';
// Usage: node tools/release/validate-manifest.mjs <manifest.json> [--local]
const [file, flag] = process.argv.slice(2);
const migrations = readFileSync(
  new URL('../../backend/src/database/schema-version.ts', import.meta.url),
  'utf8',
).match(/SCHEMA_MIGRATION_COUNT = (\d+)/)[1];
const errors = validateManifest(JSON.parse(readFileSync(file, 'utf8')), {
  expectedMigrations: Number(migrations),
  allowLocalRegistry: flag === '--local',
});
if (errors.length) {
  console.error('Release manifest invalid:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`Release manifest valid: ${file}`);
