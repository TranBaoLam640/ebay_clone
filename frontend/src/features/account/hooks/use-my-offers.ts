import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auctionApi } from '@/features/product-detail/services/auction-api';

export function useMyOffers() {
  return useQuery({
    queryKey: ['my-offers'],
    queryFn: auctionApi.myOffers,
    refetchOnWindowFocus: true,
  });
}

export function useWithdrawOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => auctionApi.withdrawOffer(offerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-offers'] }),
  });
}
