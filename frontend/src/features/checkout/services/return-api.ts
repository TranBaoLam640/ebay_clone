import { apiGet, apiMutate } from '@/services/api-client';

/** Must mirror backend RETURN_REASONS enum order. */
export const RETURN_REASONS = [
  'DAMAGED',
  'DEFECTIVE',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'MISSING_PARTS',
  'CHANGED_MIND',
  'OTHER',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  reason: ReturnReason;
  details?: string;
  status: ReturnStatus;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateReturnInput {
  orderId: string;
  orderItemId: string;
  quantity: number;
  reason: ReturnReason;
  details?: string;
}

function normalize(raw: Record<string, unknown>): ReturnRequest {
  return { ...(raw as unknown as ReturnRequest), id: (raw._id ?? raw.id) as string };
}

export const returnApi = {
  list: async () => (await apiGet<Record<string, unknown>[]>('/returns')).map(normalize),

  create: async (input: CreateReturnInput) =>
    normalize(
      await apiMutate<Record<string, unknown>>('post', '/returns', {
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        quantity: input.quantity,
        reason: input.reason,
        ...(input.details ? { details: input.details } : {}),
      }),
    ),
};
