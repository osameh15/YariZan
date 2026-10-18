import type { SiteMode } from '#shared/site-mode';
export function useSiteMode() {
  const mode = useState<SiteMode | undefined>('site-mode');
  return { mode, brochure: computed(() => mode.value !== 'full') };
}
