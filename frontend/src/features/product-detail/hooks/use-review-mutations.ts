import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewApi, type CreateReviewInput } from '../services/review-api';

/** Create/update/delete review mutations; invalidate affected product caches. */
export function useReviewMutations() {
  const qc = useQueryClient();

  const invalidate = (productId: string) => {
    qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
    qc.invalidateQueries({ queryKey: ['product', productId] });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const create = useMutation({
    mutationFn: (input: CreateReviewInput) => reviewApi.create(input),
    onSuccess: (_data, input) => {
      invalidate(input.productId);
      qc.invalidateQueries({ queryKey: ['order', input.orderId] });
    },
  });

  return { create };
}
