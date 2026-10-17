// Stage A release vulnerability policy: the exact candidate artifact must have zero HIGH and zero
// CRITICAL findings (fixed or unfixed). Any other outcome, including an unreadable scan or a scan of
// a different artifact, fails closed. There is no exception list; an exception needs a separately
// reviewed policy change.
export const policy = 'stage-a-zero-high-critical';
const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

export function evaluateScan(report, expectedArtifact) {
  const reasons = [];
  const counts = Object.fromEntries(severities.map((s) => [s.toLowerCase(), 0]));
  if (report?.SchemaVersion !== 2) reasons.push('scan report must be Trivy JSON schema version 2');
  if (typeof expectedArtifact !== 'string' || report?.ArtifactName !== expectedArtifact)
    reasons.push(`scan target ${report?.ArtifactName ?? '<missing>'} is not ${expectedArtifact}`);
  if (!Array.isArray(report?.Results) || report.Results.length === 0)
    reasons.push('scan report has no results; an empty scan is not evidence');
  for (const result of Array.isArray(report?.Results) ? report.Results : []) {
    const found = result?.Vulnerabilities ?? [];
    if (!Array.isArray(found)) {
      reasons.push('malformed vulnerability list');
      continue;
    }
    for (const v of found) {
      const severity = severities.includes(v?.Severity) ? v.Severity : 'UNKNOWN';
      counts[severity.toLowerCase()]++;
    }
  }
  if (counts.critical > 0) reasons.push(`${counts.critical} CRITICAL finding(s)`);
  if (counts.high > 0) reasons.push(`${counts.high} HIGH finding(s)`);
  return {
    policy,
    artifact: expectedArtifact,
    ...counts,
    verdict: reasons.length ? 'fail' : 'pass',
    reasons,
  };
}
