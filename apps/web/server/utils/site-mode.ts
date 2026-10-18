import { assertSiteMode, type SiteMode } from '#shared/site-mode';

// Replaced at build time by nitro.replace (nuxt.config.ts); the runtime environment cannot change it.
declare const __YARIZAN_BUILD_PROFILE__: string;

let validated: SiteMode | undefined;
export function serverSiteMode(): SiteMode {
  validated ??= assertSiteMode(process.env.YARIZAN_SITE_MODE, __YARIZAN_BUILD_PROFILE__);
  return validated;
}
