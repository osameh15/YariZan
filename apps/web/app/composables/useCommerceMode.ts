import type { ApiResult } from '#shared/api';
type Capabilities = ApiResult<'/api/v2/commerce/capabilities', 'get'>;
/**
 * The actual payment capability of this deployment, so customer copy never claims more or less than
 * is true. `test` covers the local sandbox and the in-browser simulator only: their labels must never
 * appear in a live or payment-disabled production site.
 */
export function useCommerceMode() {
  const { publicOnly } = useSiteMode();
  const capabilities = useState<Capabilities | null>('commerce-capabilities', () => null);
  const loaded = useState('commerce-capabilities-loaded', () => false);
  if (!publicOnly.value && !loaded.value && import.meta.client) {
    loaded.value = true;
    useApi()
      .get('/api/v2/commerce/capabilities')
      .then((c) => (capabilities.value = c))
      .catch(() => (capabilities.value = null));
  }
  const sandbox = computed(() => capabilities.value?.sandbox === true);
  const simulated = computed(() => capabilities.value?.mode === 'fake');
  // Live means an enabled checkout that is neither the local sandbox nor the simulator.
  const live = computed(
    () => capabilities.value?.checkout_enabled === true && !sandbox.value && !simulated.value,
  );
  return {
    capabilities,
    live,
    sandbox,
    simulated,
    /** Local test checkout (sandbox or simulator), never production. */
    test: computed(() => sandbox.value || simulated.value),
    checkout: computed(() => capabilities.value?.checkout_enabled === true),
  };
}
