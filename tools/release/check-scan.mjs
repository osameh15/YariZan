import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateScan } from './scan-policy.mjs';
// Usage: node tools/release/check-scan.mjs <trivy.json> <expected-artifact-reference> <summary-out.json>
// Writes the summary in every case (evidence stays visible) and exits 1 unless the policy passes.
const [file, expected, out] = process.argv.slice(2);
let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  report = undefined;
}
const summary = evaluateScan(report, expected);
writeFileSync(out, JSON.stringify(summary, null, 2) + '\n');
console.log(
  `Scan policy ${summary.policy}: ${summary.verdict} (critical=${summary.critical} high=${summary.high} medium=${summary.medium} low=${summary.low} unknown=${summary.unknown})`,
);
if (summary.verdict !== 'pass') {
  console.error('Release blocked:\n- ' + summary.reasons.join('\n- '));
  process.exit(1);
}
