import { z } from 'zod';
import { productSchema } from '#shared/domain';
import { publicCatalog, type PublicProduct } from '#shared/catalog-snapshot';
export function useCatalog() {
  // Public-only profiles never call the API: they render the reviewed static snapshot.
  const { publicOnly, storefront } = useSiteMode();
  if (publicOnly.value)
    return useAsyncData<PublicProduct[]>('catalog', async () => [
      ...publicCatalog(storefront.value ? 'storefront' : 'brochure').products,
    ]);
  return useFetch('/api/v2/products', {
    transform: (data): PublicProduct[] => z.array(productSchema).parse(data),
    key: 'catalog',
    getCachedData: (_key, app) => (app.isHydrating ? app.payload.data.catalog : undefined),
    retry: 0,
    timeout: 12000,
  });
}
