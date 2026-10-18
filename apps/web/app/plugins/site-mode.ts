import {
  parseSiteMode,
  brochurePageAllowed,
  brochurePageDisabled,
  type SiteMode,
} from '#shared/site-mode';

// The server reads the validated runtime mode; the client receives it through the payload.
// A client without a server value assumes brochure mode (fail closed: public-only, no prices).
export default defineNuxtPlugin(() => {
  const mode = useState<SiteMode>('site-mode', () =>
    import.meta.server ? parseSiteMode(process.env.YARIZAN_SITE_MODE) : 'brochure',
  );
  addRouteMiddleware(
    'site-mode',
    (to) => {
      if (mode.value === 'full' || brochurePageAllowed(to.path)) return;
      const disabled = brochurePageDisabled(to.path);
      return abortNavigation(
        createError({
          statusCode: disabled ? 503 : 404,
          statusMessage: disabled ? 'Service Unavailable' : 'Not Found',
          // Fatal: render the error page on client-side navigation too.
          fatal: true,
        }),
      );
    },
    { global: true },
  );
});
