import { apiGet, apiGetPaged, apiMutate } from '@/services/api-client';
import type {
  Carrier,
  CreateInrRequestInput,
  InrBuyerRequest,
  InrListQuery,
  InrPage,
  InrSellerRequest,
  InrTrackingEvidenceInput,
} from '../types/inr.types';

export const inrApi = {
  carriers: () => apiGet<Carrier[]>('/carriers'),

  create: (input: CreateInrRequestInput) =>
    apiMutate<InrBuyerRequest>('post', '/inr-requests', input),

  listBuyer: async (query: InrListQuery = {}): Promise<InrPage<InrBuyerRequest>> =>
    apiGetPaged<InrBuyerRequest>('/inr-requests', { ...query }),

  listSeller: async (query: InrListQuery = {}): Promise<InrPage<InrSellerRequest>> =>
    apiGetPaged<InrSellerRequest>('/inr-requests/seller', { ...query }),

  get: (requestId: string) => apiGet<InrBuyerRequest | InrSellerRequest>(`/inr-requests/${requestId}`),

  close: (requestId: string) =>
    apiMutate<InrBuyerRequest>('patch', `/inr-requests/${requestId}/close`),

  updateTrackingEvidence: (requestId: string, input: InrTrackingEvidenceInput) =>
    apiMutate<InrSellerRequest>('patch', `/inr-requests/${requestId}/tracking-evidence`, input),
};
