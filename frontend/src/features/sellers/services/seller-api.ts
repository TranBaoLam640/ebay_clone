import { apiGet, apiGetPaged, apiMutate } from '@/services/api-client';
import type { PaginationMeta } from '@/services/types';

export interface SellerProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  description: string;
  averageFeedbackRating: number;
  feedbackCount: number;
}

export interface SellerFeedback {
  id: string;
  rating: number;
  comment: string | null;
  itemAsDescribedRating: number | null;
  communicationRating: number | null;
  shippingRating: number | null;
  buyer: { fullName: string; avatarUrl: string | null };
  createdAt: string;
  updatedAt: string;
}

/** Payload to rate the seller for a delivered order (one feedback per order). */
export interface CreateSellerFeedbackInput {
  rating: number;
  comment?: string;
}

export const sellerApi = {
  profile: (id: string) => apiGet<SellerProfile>(`/sellers/${id}`),

  feedbacks: (
    id: string,
    params: { page?: number; limit?: number },
  ): Promise<{ items: SellerFeedback[]; meta: PaginationMeta }> =>
    apiGetPaged<SellerFeedback>(`/sellers/${id}/feedbacks`, params),

  /** Rate the seller of a delivered order. */
  createFeedback: (orderId: string, input: CreateSellerFeedbackInput) =>
    apiMutate<SellerFeedback>('post', `/orders/${orderId}/seller-feedback`, {
      rating: input.rating,
      ...(input.comment ? { comment: input.comment } : {}),
    }),
};
