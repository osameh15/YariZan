// YariZan release manifest: the application → infrastructure handoff record for one release.
// Deployment uses only the digest references recorded here, never mutable tags.
export const schema = 'yarizan-release-manifest/v1';
export const registries = ['ghcr.io/osameh15/', 'localhost:5000/'];
export const eligibility = {
  'yarizan-web:brochure': 'stage-a-brochure-candidate',
  'yarizan-web:full': 'blocked-stage-b',
  'yarizan-api:': 'blocked-stage-b',
};
// A published release names exactly one approved scope. Only Stage A exists: it may contain the
// brochure web image and nothing else. A Stage B (full web + API) scope needs its own reviewed
// change and owner approval; until then the validator rejects any manifest that tries to carry it.
export const releaseScopes = {
  'stage-a-brochure': ['yarizan-web:brochure'],
};
// Local rollback rehearsals exercise every image against a throwaway registry and never publish.
export const rehearsalScope = 'local-rehearsal';
const digest = /^sha256:[0-9a-f]{64}$/;
const commit = /^[0-9a-f]{40}$/;

export function validateManifest(m, { expectedMigrations, allowLocalRegistry = false } = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (m?.schema !== schema) fail('schema');
  if (!commit.test(m?.source_commit ?? '')) fail('source_commit must be a full 40-hex SHA');
  if (!/^https:\/\/github\.com\/osameh15\/YariZan\/actions\/runs\/\d+$/.test(m?.ci_run_url ?? ''))
    if (!(allowLocalRegistry && m?.ci_run_url === 'local-rehearsal')) fail('ci_run_url');
  if (Number.isNaN(Date.parse(m?.built_at ?? '')) || !/Z$/.test(m?.built_at ?? ''))
    fail('built_at must be an ISO UTC timestamp');
  if (!Number.isInteger(m?.migrations) || m.migrations !== expectedMigrations)
    fail(`migrations must equal ${expectedMigrations}`);
  if (!Array.isArray(m?.environment_changes)) fail('environment_changes');
  if (!Array.isArray(m?.route_changes)) fail('route_changes');
  if (!Array.isArray(m?.images) || m.images.length === 0) fail('images');
  const scope = m?.release_scope;
  const scoped = releaseScopes[scope];
  if (!scoped && !(allowLocalRegistry && scope === rehearsalScope))
    fail(`release_scope must be one of: ${Object.keys(releaseScopes).join(', ')}`);
  if (scoped) {
    const keys = (m?.images ?? []).map(
      (i) => `${i.name}:${i.name === 'yarizan-web' ? i.profile : ''}`,
    );
    if (keys.length !== scoped.length || !scoped.every((k) => keys.includes(k)))
      fail(`release_scope ${scope} must contain exactly: ${scoped.join(', ')}`);
  }
  const seen = new Set();
  for (const [index, image] of (m?.images ?? []).entries()) {
    const at = `images[${index}]`;
    if (!['yarizan-web', 'yarizan-api'].includes(image.name)) fail(`${at}.name`);
    const profile = image.name === 'yarizan-web' ? image.profile : '';
    if (image.name === 'yarizan-web' && !['brochure', 'full'].includes(profile))
      fail(`${at}.profile`);
    if (image.name === 'yarizan-api' && image.profile !== undefined) fail(`${at}.profile`);
    const key = `${image.name}:${profile ?? ''}`;
    if (seen.has(key)) fail(`${at} duplicate`);
    seen.add(key);
    if (!digest.test(image.digest ?? '')) fail(`${at}.digest must be sha256:<64 hex>`);
    const allowed = registries.filter((r) => allowLocalRegistry || r.startsWith('ghcr.io'));
    const reference = image.reference ?? '';
    if (!allowed.some((registry) => reference === `${registry}${image.name}@${image.digest}`))
      fail(`${at}.reference must be <registry>/${image.name}@<digest> (no mutable tag)`);
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(image.tag ?? '')) fail(`${at}.tag`);
    if (!image.tag?.endsWith(m.source_commit?.slice(0, 12) ?? '-')) fail(`${at}.tag commit`);
    if (image.eligibility !== eligibility[key])
      fail(`${at}.eligibility must be ${eligibility[key]}`);
    const scan = image.scan ?? {};
    if (
      typeof scan.tool !== 'string' ||
      !Number.isInteger(scan.critical) ||
      !Number.isInteger(scan.high)
    )
      fail(`${at}.scan`);
  }
  return errors;
}
