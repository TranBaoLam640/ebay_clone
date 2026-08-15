import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auctionApi } from '../services/auction-api';
import { useAuth } from '@/features/auth/hooks/use-auth';

/** Invalidate every live auction query for a product after a state change. */
function useInvalidateAuction(uuid: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['bid-status', uuid] });
    qc.invalidateQueries({ queryKey: ['availability'] });
    qc.invalidateQueries({ queryKey: ['bid-history', uuid] });
    qc.invalidateQueries({ queryKey: ['my-bids'] });
    // Buy It Now creates a PENDING_PAYMENT order — refresh the orders list too.
    qc.invalidateQueries({ queryKey: ['orders'] });
  };
}

export function usePlaceBid(uuid: string) {
  const invalidate = useInvalidateAuction(uuid);
  return useMutation({
    mutationFn: (maxBid: number) => auctionApi.placeBid(uuid, maxBid),
    onSuccess: invalidate,
  });
}

export function useBuyNow(uuid: string) {
  const invalidate = useInvalidateAuction(uuid);
  return useMutation({
    mutationFn: () => auctionApi.buyNow(uuid),
    onSuccess: invalidate,
  });
}

/**
 * Public bid history, polled while the auction panel is on screen. The response
 * is personalised (the viewer's own rows come back unmasked), so the viewer id
 * is part of the cache key — otherwise a logout would keep serving the previous
 * user's name from cache. The key stays prefixed by uuid for invalidation.
 */
export function useBidHistory(uuid: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['bid-history', uuid, user?.id ?? null],
    queryFn: () => auctionApi.bidHistory(uuid),
    enabled,
    refetchInterval: enabled ? 5000 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}
