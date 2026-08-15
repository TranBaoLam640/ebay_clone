import { useQuery } from '@tanstack/react-query';
import { auctionApi } from '@/features/product-detail/services/auction-api';

/** The buyer's auctions, refetched while the page is open so status stays live. */
export function useMyBids() {
  return useQuery({
    queryKey: ['my-bids'],
    queryFn: auctionApi.myBids,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
}
