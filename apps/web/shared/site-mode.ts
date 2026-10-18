// Release mode of the website.
//  - brochure: Stage A maintenance/rollback site; informational pages only, no prices.
//  - storefront: public storefront; the same public-only boundary as brochure (no API, no
//    accounts, no commerce, no Admin) plus owner-approved informational prices.
//  - full: the complete application; stays behind the Backend production gates.
export const siteModes = ['brochure', 'storefront', 'full'] as const;
export type SiteMode = (typeof siteModes)[number];

export class SiteModeError extends Error {}

export function parseSiteMode(value: unknown): SiteMode {
  if (value === undefined || value === '')
    throw new SiteModeError(
      'YARIZAN_SITE_MODE_REQUIRED: set brochure, storefront or full explicitly',
    );
  if (!siteModes.includes(value as SiteMode))
    throw new SiteModeError('YARIZAN_SITE_MODE_INVALID: expected brochure, storefront or full');
  return value as SiteMode;
}
// Both public-only profiles share one route boundary.
export function isPublicOnly(mode: SiteMode) {
  return mode !== 'full';
}

// The runtime mode must equal the profile the image was built with. A full build cannot
// pretend to be a brochure site, and a brochure build cannot be switched to full.
export function assertSiteMode(runtime: unknown, buildProfile: unknown): SiteMode {
  const mode = parseSiteMode(runtime);
  if (mode !== buildProfile)
    throw new SiteModeError('YARIZAN_SITE_MODE_MISMATCH: runtime mode differs from build profile');
  return mode;
}

// Reviewed public allowlist for the public-only profiles (brochure and storefront). Paths must match exactly: no trailing
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
  // Crawler policy files are public in every profile (they default to disallow-all).
  if (path === '/robots.txt' || path === '/sitemap.xml')
    return read ? 'asset' : 'method-not-allowed';
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
