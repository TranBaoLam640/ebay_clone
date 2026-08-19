import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  sellerFeedbackApi,
  type SellerFeedbackFields,
  type SellerFeedbackListParams,
} from '../services/seller-feedback-api';

export const sellerFeedbackKeys = {
  awaiting: ['seller-feedback-awaiting'] as const,
  orderItem: (orderId?: string, orderItemId?: string) =>
    ['order-item-seller-feedback', orderId, orderItemId] as const,
  sellerList: (sellerId?: string, params?: SellerFeedbackListParams) =>
    ['seller-feedbacks', sellerId, params] as const,
  sellerSummary: (sellerId?: string) => ['seller-feedback-summary', sellerId] as const,
};

function invalidateFeedbackCaches(
  qc: ReturnType<typeof useQueryClient>,
  input: {
    orderId?: string;
    orderItemId?: string;
    sellerId?: string;
  } = {},
) {
  qc.invalidateQueries({ queryKey: sellerFeedbackKeys.awaiting });
  if (input.orderId && input.orderItemId) {
    qc.invalidateQueries({ queryKey: sellerFeedbackKeys.orderItem(input.orderId, input.orderItemId) });
  }
  if (input.orderId) qc.invalidateQueries({ queryKey: ['order', input.orderId] });
  qc.invalidateQueries({ queryKey: ['orders'] });
  if (input.sellerId) {
    qc.invalidateQueries({ queryKey: ['seller-feedbacks', input.sellerId] });
    qc.invalidateQueries({ queryKey: sellerFeedbackKeys.sellerSummary(input.sellerId) });
  } else {
    qc.invalidateQueries({ queryKey: ['seller-feedbacks'] });
    qc.invalidateQueries({ queryKey: ['seller-feedback-summary'] });
  }
}

export function useAwaitingSellerFeedback() {
  return useQuery({
    queryKey: sellerFeedbackKeys.awaiting,
    queryFn: sellerFeedbackApi.getAwaitingSellerFeedback,
  });
}

export function useOrderItemSellerFeedback(orderId?: string, orderItemId?: string) {
  return useQuery({
    queryKey: sellerFeedbackKeys.orderItem(orderId, orderItemId),
    queryFn: () => sellerFeedbackApi.getOrderItemSellerFeedback(orderId!, orderItemId!),
    enabled: !!orderId && !!orderItemId,
    retry: false,
  });
}

export function useSellerFeedbacks(sellerId?: string, params: SellerFeedbackListParams = {}) {
  return useQuery({
    queryKey: sellerFeedbackKeys.sellerList(sellerId, params),
    queryFn: () => sellerFeedbackApi.getSellerFeedbacks(sellerId!, params),
    enabled: !!sellerId,
  });
}

export function useSellerFeedbackSummary(sellerId?: string) {
  return useQuery({
    queryKey: sellerFeedbackKeys.sellerSummary(sellerId),
    queryFn: () => sellerFeedbackApi.getSellerFeedbackSummary(sellerId!),
    enabled: !!sellerId,
  });
}

export function useSellerFeedbackMutations() {
  const qc = useQueryClient();

  const leave = useMutation({
    mutationFn: (input: {
      orderId: string;
      orderItemId: string;
      payload: SellerFeedbackFields;
      images?: File[];
      sellerId?: string;
    }) =>
      sellerFeedbackApi.leaveSellerFeedback(
        input.orderId,
        input.orderItemId,
        input.payload,
        input.images,
      ),
    onSuccess: (feedback, input) => {
      invalidateFeedbackCaches(qc, {
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        sellerId: feedback.sellerId ?? input.sellerId,
      });
    },
  });

  const respond = useMutation({
    mutationFn: (input: { feedbackId: string; commentText: string; sellerId?: string }) =>
      sellerFeedbackApi.respondToSellerFeedback(input.feedbackId, {
        commentText: input.commentText,
      }),
    onSuccess: (feedback, input) => {
      invalidateFeedbackCaches(qc, { sellerId: feedback.sellerId ?? input.sellerId });
    },
  });

  const addFollowUp = useMutation({
    mutationFn: (input: {
      feedbackId: string;
      commentText: string;
      orderId?: string;
      orderItemId?: string;
      sellerId?: string;
    }) =>
      sellerFeedbackApi.addSellerFeedbackFollowUp(input.feedbackId, {
        commentText: input.commentText,
      }),
    onSuccess: (feedback, input) => {
      if ((feedback.orderId ?? input.orderId) && (feedback.orderItemId ?? input.orderItemId)) {
        qc.invalidateQueries({
          queryKey: sellerFeedbackKeys.orderItem(
            feedback.orderId ?? input.orderId,
            feedback.orderItemId ?? input.orderItemId,
          ),
        });
      }
      const sellerId = feedback.sellerId ?? input.sellerId;
      if (sellerId) qc.invalidateQueries({ queryKey: ['seller-feedbacks', sellerId] });
      else qc.invalidateQueries({ queryKey: ['seller-feedbacks'] });
    },
  });

  const requestRevision = useMutation({
    mutationFn: (input: { feedbackId: string; sellerId?: string }) =>
      sellerFeedbackApi.requestSellerFeedbackRevision(input.feedbackId),
    onSuccess: (feedback, input) => {
      invalidateFeedbackCaches(qc, {
        orderId: feedback.orderId,
        orderItemId: feedback.orderItemId,
        sellerId: feedback.sellerId ?? input.sellerId,
      });
    },
  });

  const respondRevision = useMutation({
    mutationFn: (input: {
      feedbackId: string;
      sellerId?: string;
      orderId?: string;
      orderItemId?: string;
      payload:
        | { decision: 'DECLINE' }
        | { decision: 'ACCEPT'; feedback: SellerFeedbackFields };
    }) => sellerFeedbackApi.respondToSellerFeedbackRevision(input.feedbackId, input.payload),
    onSuccess: (feedback, input) => {
      invalidateFeedbackCaches(qc, {
        orderId: feedback.orderId ?? input.orderId,
        orderItemId: feedback.orderItemId ?? input.orderItemId,
        sellerId: feedback.sellerId ?? input.sellerId,
      });
    },
  });

  return { leave, respond, addFollowUp, requestRevision, respondRevision };
}
