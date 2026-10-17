import { z } from 'zod';
import { productSchema } from '#shared/domain';
import { catalogSnapshot, type PublicProduct } from '#shared/catalog-snapshot';
export function useCatalog() {
  // Brochure mode never calls the API: it renders the reviewed static snapshot.
  if (useSiteMode().brochure.value)
    return useAsyncData<PublicProduct[]>('catalog', async () => [...catalogSnapshot.products]);
  return useFetch('/api/v2/products', {
    transform: (data): PublicProduct[] => z.array(productSchema).parse(data),
    key: 'catalog',
    getCachedData: (_key, app) => (app.isHydrating ? app.payload.data.catalog : undefined),
    retry: 0,
    timeout: 12000,
  });
}
