import type { SiteMode } from '#shared/site-mode';
// publicOnly: brochure or storefront; no Backend, no accounts, no commerce.
// storefront: public-only with owner-approved informational prices.
export function useSiteMode() {
  const mode = useState<SiteMode | undefined>('site-mode');
  return {
    mode,
    publicOnly: computed(() => mode.value !== 'full'),
    storefront: computed(() => mode.value === 'storefront'),
  };
}
