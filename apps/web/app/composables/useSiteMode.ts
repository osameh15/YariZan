import type { SiteMode } from '#shared/site-mode';
import type { CapabilityId } from '#shared/capabilities';
// publicOnly: no customer accounts or commerce: the brochure and storefront profiles, and the full
// application while the Backend has not enabled customer authentication.
// storefront: public-only with prices (owner-approved snapshot, or the live catalog when full).
// live: the full application, whose catalog and prices come from the Backend.
export function useSiteMode() {
  const mode = useState<SiteMode | undefined>('site-mode');
  const capabilities = useState<CapabilityId[]>('api-capabilities', () => []);
  const has = (id: CapabilityId) => mode.value === 'full' && capabilities.value.includes(id);
  const publicOnly = computed(() => !has('CUSTOMER_AUTH'));
  return {
    mode,
    live: computed(() => mode.value === 'full'),
    publicOnly,
    storefront: computed(
      () => mode.value === 'storefront' || (mode.value === 'full' && publicOnly.value),
    ),
    admin: computed(() => has('ADMIN_AUTH')),
    desktop: computed(() => has('DESKTOP_PROVISIONING')),
  };
}
