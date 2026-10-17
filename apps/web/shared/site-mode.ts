// Release mode of the public website. "brochure" is the approved Stage A public mode:
// informational pages only, no API, no accounts, no commerce. "full" is the complete
// application and stays behind the Backend production gates.
export const siteModes = ['brochure', 'full'] as const;
export type SiteMode = (typeof siteModes)[number];

export class SiteModeError extends Error {}

export function parseSiteMode(value: unknown): SiteMode {
  if (value === undefined || value === '')
    throw new SiteModeError('YARIZAN_SITE_MODE_REQUIRED: set brochure or full explicitly');
  if (value !== 'brochure' && value !== 'full')
    throw new SiteModeError('YARIZAN_SITE_MODE_INVALID: expected brochure or full');
  return value;
}

// The runtime mode must equal the profile the image was built with. A full build cannot
// pretend to be a brochure site, and a brochure build cannot be switched to full.
export function assertSiteMode(runtime: unknown, buildProfile: unknown): SiteMode {
  const mode = parseSiteMode(runtime);
  if (mode !== buildProfile)
    throw new SiteModeError('YARIZAN_SITE_MODE_MISMATCH: runtime mode differs from build profile');
  return mode;
}

// Reviewed public allowlist for brochure mode. Paths must match exactly: no trailing
// slash, no case variants, no aliases such as /products/yarizan-g1.
export const brochurePages = [/^\/$/, /^\/products$/, /^\/products\/grade-[1-6]$/, /^\/support$/];
const staticAsset = /^\/(?:_nuxt|brand|fonts)\/[A-Za-z0-9._\-/]+$/;
// Functionality that exists in the full application and is deliberately unavailable.
const disabledPage =
  /^\/(?:account|login|connect|zanyari|checkout|payment|reset-password|support-reset)(?:\/|$)/i;

export type BrochureDecision =
  | 'page'
  | 'asset'
  | 'health'
  | 'internal-error'
  | 'api-disabled'
  | 'page-disabled'
  | 'method-not-allowed'
  | 'not-found';

export function brochureDecision(method: string, rawPath: string): BrochureDecision {
  const path = rawPath.split('?')[0] ?? '';
  // Encoded, dot, duplicate-slash and backslash forms are refused before any routing so
  // that no normalization can turn them into a permitted or a protected route.
  const suspicious = /[%\\;]|\/\/|\/\.|[^\x21-\x7e]/.test(path) || !path.startsWith('/');
  if (/^\/api(?:\/|$)/i.test(path)) return 'api-disabled';
  if (suspicious) return 'not-found';
  const read = method === 'GET' || method === 'HEAD';
  if (path === '/healthz') return read ? 'health' : 'method-not-allowed';
  // Nuxt renders error pages through this internal route; it only renders the error view.
  if (path === '/__nuxt_error') return read ? 'internal-error' : 'method-not-allowed';
  if (staticAsset.test(path)) return read ? 'asset' : 'method-not-allowed';
  if (disabledPage.test(path)) return 'page-disabled';
  if (brochurePages.some((page) => page.test(path))) return read ? 'page' : 'method-not-allowed';
  return 'not-found';
}

export function brochurePageAllowed(path: string) {
  return brochurePages.some((page) => page.test(path));
}
export function brochurePageDisabled(path: string) {
  return disabledPage.test(path);
}
