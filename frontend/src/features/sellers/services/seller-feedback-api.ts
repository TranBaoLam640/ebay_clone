import { apiGet, apiGetPaged, apiMutate } from '@/services/api-client';
import type { PaginationMeta } from '@/services/types';

export type SellerFeedbackCommentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type SellerFeedbackSource = 'BUYER' | 'AUTOMATED';
export type SellerFeedbackRevisionStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface SellerFeedbackImage {
  key: string;
  url: string;
}

export interface SellerFeedbackResponse {
  commentText: string;
  createdAt: string;
}

export interface SellerFeedbackRevisionRequest {
  status: SellerFeedbackRevisionStatus;
  requestedAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export interface SellerFeedbackFollowUpComment {
  commentText: string;
  createdAt: string;
}

export interface SellerFeedback {
  id: string;
  orderId?: string;
  orderItemId?: string;
  buyerId?: string;
  sellerId?: string;
  productId?: string;
  commentType: SellerFeedbackCommentType;
  commentText?: string | null;
  comment?: string | null;
  itemAsDescribedRating?: number | null;
  communicationRating?: number | null;
  shippingTimeRating?: number | null;
  shippingAndHandlingChargesRating?: number | null;
  images?: SellerFeedbackImage[];
  followUpComment?: SellerFeedbackFollowUpComment | null;
  sellerResponse?: SellerFeedbackResponse | null;
  verifiedPurchase?: boolean;
  source: SellerFeedbackSource;
  submittedAt?: string;
  feedbackDeadline?: string;
  revisionRequest?: SellerFeedbackRevisionRequest;
  buyer?: { fullName: string; avatarUrl: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface AwaitingSellerFeedbackItem {
  orderId: string;
  orderItemId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  title: string | null;
  image: string | null;
  unitPrice: number | null;
  itemSubtotal: number | null;
  product: { id: string; title: string; primaryImage: string | null } | null;
  seller: { id: string; displayName: string; avatarUrl: string | null } | null;
  eligibleForSellerFeedback: boolean;
  feedbackDeadline: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface SellerFeedbackSummary {
  sellerId: string;
  totalFeedbackCount: number;
  counts: Record<SellerFeedbackCommentType, number>;
  averageDetailedSellerRatings: {
    itemAsDescribed: number | null;
    communication: number | null;
    shippingTime: number | null;
    shippingAndHandlingCharges: number | null;
  };
}

export interface SellerFeedbackFields {
  commentType: SellerFeedbackCommentType;
  commentText?: string;
  itemAsDescribedRating?: number;
  communicationRating?: number;
  shippingTimeRating?: number;
  shippingAndHandlingChargesRating?: number;
}

export interface OrderItemSellerFeedbackResult {
  exists: boolean;
  feedback?: SellerFeedback;
}

export interface SellerFeedbackListParams {
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'rating_desc' | 'rating_asc';
}

function appendField(form: FormData, key: keyof SellerFeedbackFields, value: unknown) {
  if (value !== undefined && value !== null && value !== '') {
    form.append(key, String(value));
  }
}

function toFeedbackBody(payload: SellerFeedbackFields, images?: File[]) {
  if (!images?.length) return payload;
  const form = new FormData();
  appendField(form, 'commentType', payload.commentType);
  appendField(form, 'commentText', payload.commentText);
  appendField(form, 'itemAsDescribedRating', payload.itemAsDescribedRating);
  appendField(form, 'communicationRating', payload.communicationRating);
  appendField(form, 'shippingTimeRating', payload.shippingTimeRating);
  appendField(
    form,
    'shippingAndHandlingChargesRating',
    payload.shippingAndHandlingChargesRating,
  );
  images.forEach((image) => form.append('images', image));
  return form;
}

export const sellerFeedbackApi = {
  getAwaitingSellerFeedback: () =>
    apiGet<AwaitingSellerFeedbackItem[]>('/seller-feedbacks/awaiting'),

  getOrderItemSellerFeedback: (orderId: string, orderItemId: string) =>
    apiGet<OrderItemSellerFeedbackResult>(
      `/orders/${orderId}/items/${orderItemId}/seller-feedback`,
    ),

  leaveSellerFeedback: (
    orderId: string,
    orderItemId: string,
    payload: SellerFeedbackFields,
    images?: File[],
  ) =>
    apiMutate<SellerFeedback>(
      'post',
      `/orders/${orderId}/items/${orderItemId}/seller-feedback`,
      toFeedbackBody(payload, images),
    ),

  getSellerFeedbacks: (
    sellerId: string,
    params: SellerFeedbackListParams = {},
  ): Promise<{ items: SellerFeedback[]; meta: PaginationMeta }> =>
    apiGetPaged<SellerFeedback>(`/sellers/${sellerId}/feedbacks`, { ...params }),

  getSellerFeedbackSummary: (sellerId: string) =>
    apiGet<SellerFeedbackSummary>(`/sellers/${sellerId}/feedback-summary`),

  respondToSellerFeedback: (feedbackId: string, payload: { commentText: string }) =>
    apiMutate<SellerFeedback>('post', `/seller-feedbacks/${feedbackId}/response`, payload),

  addSellerFeedbackFollowUp: (feedbackId: string, payload: { commentText: string }) =>
    apiMutate<SellerFeedback>('post', `/seller-feedbacks/${feedbackId}/follow-up`, payload),

  requestSellerFeedbackRevision: (feedbackId: string) =>
    apiMutate<SellerFeedback>('post', `/seller-feedbacks/${feedbackId}/revision-request`, {}),

  respondToSellerFeedbackRevision: (
    feedbackId: string,
    payload:
      | { decision: 'DECLINE' }
      | { decision: 'ACCEPT'; feedback: SellerFeedbackFields },
  ) =>
    apiMutate<SellerFeedback>(
      'post',
      `/seller-feedbacks/${feedbackId}/revision-request/respond`,
      payload,
    ),
};
