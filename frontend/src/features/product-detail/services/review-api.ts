import { apiMutate } from '@/services/api-client';
import type { ProductReview } from '@/features/catalog/types/catalog.types';

/** Payload to submit a review — ties it to a purchased, delivered order item. */
export interface CreateReviewInput {
  productId: string;
  orderId: string;
  orderItemId: string;
  rating: number;
  comment?: string;
}

export const reviewApi = {
  /** Create a review for an exact delivered order item. */
  create: ({ orderId, orderItemId, rating, comment }: CreateReviewInput) =>
    apiMutate<ProductReview>(
      'post',
      `/orders/${orderId}/items/${orderItemId}/product-review`,
      {
      rating,
      ...(comment ? { comment } : {}),
      },
    ),

  /** Update an existing review the user owns. */
  update: (reviewId: string, data: { rating?: number; comment?: string }) =>
    apiMutate<ProductReview>('patch', `/product-reviews/${reviewId}`, data),

  /** Delete a review the user owns. */
  remove: (reviewId: string) =>
    apiMutate<{ deleted: boolean }>('delete', `/product-reviews/${reviewId}`),
};
