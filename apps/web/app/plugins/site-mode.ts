import {
  parseSiteMode,
  brochurePageAllowed,
  brochurePageDisabled,
  type SiteMode,
} from '#shared/site-mode';
import { fetchCapabilities, pageServed, type CapabilityId } from '#shared/capabilities';
import { backendBase } from '#shared/proxy-policy';

// The server reads the validated runtime mode; the client receives it through the payload.
// A client without a server value assumes brochure mode (fail closed: public-only, no prices).
export default defineNuxtPlugin(async () => {
  const mode = useState<SiteMode>('site-mode', () =>
    import.meta.server ? parseSiteMode(process.env.YARIZAN_SITE_MODE) : 'brochure',
  );
  // Backend capabilities, read on the server for the full application only. The client receives
  // them through the payload; a client without them assumes none (fail closed).
  const capabilities = useState<CapabilityId[]>('api-capabilities', () => []);
  if (import.meta.server && mode.value === 'full')
    capabilities.value = await fetchCapabilities(backendBase(useRuntimeConfig().apiBase));
  addRouteMiddleware(
    'site-mode',
    (to) => {
      if (mode.value === 'full' && pageServed(to.path, capabilities.value)) return;
      if (mode.value !== 'full' && brochurePageAllowed(to.path)) return;
      const disabled = mode.value === 'full' || brochurePageDisabled(to.path);
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
