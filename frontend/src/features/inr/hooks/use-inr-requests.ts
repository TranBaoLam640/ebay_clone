import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inrApi } from '../services/inr-api';
import type { CreateInrRequestInput, InrListQuery, InrTrackingEvidenceInput } from '../types/inr.types';

export const inrKeys = {
  all: ['inr-requests'] as const,
  buyerList: (query: InrListQuery) => ['inr-requests', 'buyer', query] as const,
  sellerList: (query: InrListQuery) => ['inr-requests', 'seller', query] as const,
  detail: (requestId?: string) => ['inr-requests', 'detail', requestId] as const,
  carriers: ['inr-requests', 'carriers'] as const,
};

export function useBuyerInrRequests(query: InrListQuery = {}) {
  return useQuery({
    queryKey: inrKeys.buyerList(query),
    queryFn: () => inrApi.listBuyer(query),
  });
}

export function useSellerInrRequests(query: InrListQuery = {}) {
  return useQuery({
    queryKey: inrKeys.sellerList(query),
    queryFn: () => inrApi.listSeller(query),
  });
}

export function useInrRequest(requestId?: string) {
  return useQuery({
    queryKey: inrKeys.detail(requestId),
    queryFn: () => inrApi.get(requestId!),
    enabled: !!requestId,
  });
}

export function useCarriers() {
  return useQuery({
    queryKey: inrKeys.carriers,
    queryFn: inrApi.carriers,
    staleTime: 10 * 60_000,
  });
}

export function useInrActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: inrKeys.all });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['order'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return {
    create: useMutation({
      mutationFn: (input: CreateInrRequestInput) => inrApi.create(input),
      onSuccess: invalidate,
    }),
    close: useMutation({
      mutationFn: (requestId: string) => inrApi.close(requestId),
      onSuccess: invalidate,
    }),
    updateTrackingEvidence: useMutation({
      mutationFn: ({ requestId, input }: { requestId: string; input: InrTrackingEvidenceInput }) =>
        inrApi.updateTrackingEvidence(requestId, input),
      onSuccess: invalidate,
    }),
  };
}
