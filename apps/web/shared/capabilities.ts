// Production capabilities reported by the Backend (GET commerce/capabilities). The full site shows an
// entry point only when the Backend serves it; the Backend still enforces every route itself, so this
// only keeps the interface honest. Anything unknown or unreadable counts as disabled (fail closed).
export const capabilityIds = [
  'PRODUCTION_CORE',
  'CUSTOMER_AUTH',
  'ADMIN_AUTH',
  'DESKTOP_PROVISIONING',
  'TRIALS_AND_LICENSES',
  'LIVE_COMMERCE',
] as const;
export type CapabilityId = (typeof capabilityIds)[number];

export function parseCapabilities(value: unknown): CapabilityId[] {
  const list = (value as { enabled_capabilities?: unknown } | null)?.enabled_capabilities;
  if (!Array.isArray(list)) return [];
  return capabilityIds.filter((id) => list.includes(id));
}

// Pages of the full application and the capabilities each needs.
const pageCapabilities: [RegExp, CapabilityId[]][] = [
  [/^\/zanyari(?:\/|$)/i, ['ADMIN_AUTH']],
  [/^\/(?:checkout|payment)(?:\/|$)/i, ['CUSTOMER_AUTH', 'LIVE_COMMERCE']],
  [/^\/connect(?:\/|$)/i, ['CUSTOMER_AUTH', 'DESKTOP_PROVISIONING']],
  [/^\/(?:account|login|reset-password|support-reset)(?:\/|$)/i, ['CUSTOMER_AUTH']],
];
export function requiredCapabilities(path: string): CapabilityId[] {
  const clean = path.split('?')[0] ?? '';
  return pageCapabilities.find(([pattern]) => pattern.test(clean))?.[1] ?? [];
}
export function pageServed(path: string, enabled: readonly CapabilityId[]) {
  return requiredCapabilities(path).every((id) => enabled.includes(id));
}

// One short-lived cached read per server process: capabilities change only with a redeploy.
let cached: { at: number; value: Promise<CapabilityId[]> } | undefined;
export function fetchCapabilities(apiBase: string | URL, now = Date.now()) {
  if (!cached || now - cached.at > 30_000) {
    const value = fetch(new URL('commerce/capabilities', apiBase), {
      signal: AbortSignal.timeout(3000),
      headers: { accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(parseCapabilities)
      .catch(() => [] as CapabilityId[]);
    cached = { at: now, value };
    // A failed read is not cached for the full window.
    value.then((v) => {
      if (!v.length && cached?.value === value) cached = undefined;
    });
  }
  return cached.value;
}
