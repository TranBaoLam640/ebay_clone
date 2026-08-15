import { apiGet, apiGetPaged } from '@/services/api-client';
import type {
  Category,
  ProductAvailability,
  ProductDetail,
  ProductListItem,
  ProductQuery,
  ProductReview,
} from '../types/catalog.types';
import type { PaginationMeta } from '@/services/types';

/** Strip undefined values so we don't send empty query params. */
function clean(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  );
}

export const catalogApi = {
  categories: (parentId?: string) => apiGet<Category[]>('/categories', clean({ parentId })),

  category: (id: string) => apiGet<Category>(`/categories/${id}`),

  products: (query: ProductQuery): Promise<{ items: ProductListItem[]; meta: PaginationMeta }> =>
    apiGetPaged<ProductListItem>('/products', clean({ ...query })),

  product: (id: string) => apiGet<ProductDetail>(`/products/${id}`),

  /** Live stock/status for a batch of product uuids (unavailable ones omitted). */
  availability: (ids: string[]) =>
    apiGet<ProductAvailability[]>('/products/availability', { ids: ids.join(',') }),

  reviews: (
    productId: string,
    params: { page?: number; limit?: number; rating?: number; sort?: string },
  ): Promise<{ items: ProductReview[]; meta: PaginationMeta }> =>
    apiGetPaged<ProductReview>(`/products/${productId}/reviews`, clean({ ...params })),
};
