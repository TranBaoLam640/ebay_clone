import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { catalogApi } from '../services/catalog-api';
import type { ProductQuery } from '../types/catalog.types';

export function useCategories(parentId?: string) {
  return useQuery({
    queryKey: ['categories', parentId ?? 'root'],
    queryFn: () => catalogApi.categories(parentId),
    // Categories rarely change — cache long and keep between renders so the
    // header menu / homepage tiles never re-flash a skeleton.
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => catalogApi.products(query),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => catalogApi.product(id!),
    enabled: !!id,
  });
}

export function useProductReviews(
  productId: string | undefined,
  params: {
    page?: number;
    limit?: number;
    q?: string;
    rating?: number;
    sort?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: ['product-reviews', productId, params],
    queryFn: () => catalogApi.reviews(productId!, params),
    enabled: !!productId && enabled,
    placeholderData: keepPreviousData,
  });
}
