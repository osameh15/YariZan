import { z } from 'zod';
import { productSchema } from '#shared/domain';
export function useCatalog() {
  return useFetch('/api/v2/products', {
    transform: (data) => z.array(productSchema).parse(data),
    key: 'catalog',
    getCachedData: (_key, app) => (app.isHydrating ? app.payload.data.catalog : undefined),
    retry: 0,
    timeout: 12000,
  });
}
