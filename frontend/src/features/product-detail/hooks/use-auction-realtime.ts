import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAvailability } from '@/features/catalog/hooks/use-availability';
import type { AuctionInfo, AuctionStatus } from '@/features/catalog/types/catalog.types';
import { auctionApi } from '../services/auction-api';
import { minNextBid } from '../utils/bid-increment';

const POLL_MS = 5000;

/** Merged public + per-buyer live auction view for the buy box and banner. */
export interface AuctionRealtime {
  currentBid: number;
  bidCount: number;
  endsAt: string;
  status: AuctionStatus;
  minNextBid: number;
  hasReserve: boolean;
  reserveMet: boolean;
  buyNowAvailable: boolean;
  buyNowPrice: number | null;
  youAreHighBidder: boolean;
  won: boolean;
  hasBid: boolean;
  yourMaxBid: number | null;
  finalPrice: number | null;
}

/**
 * Live auction state via the shared 5s availability poll (public fields) plus an
 * authenticated bid-status poll (per-buyer high/outbid/won). Both refetch every
 * 5s and on window focus, so a competing bid flips this buyer's banner within one
 * cycle. Falls back to the seed `AuctionInfo` before the first poll resolves.
 */
export function useAuctionRealtime(
  uuid: string,
  seed: AuctionInfo | undefined,
  isAuction: boolean,
  isAuthenticated: boolean,
): AuctionRealtime | null {
  const availability = useAvailability(isAuction ? [uuid] : [], isAuction);
  const live = availability.map.get(uuid)?.auction;

  const statusQuery = useQuery({
    queryKey: ['bid-status', uuid],
    queryFn: () => auctionApi.bidStatus(uuid),
    enabled: isAuction && isAuthenticated,
    refetchInterval: isAuction && isAuthenticated ? POLL_MS : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  return useMemo(() => {
    if (!isAuction) return null;
    const status = statusQuery.data;
    // Prefer the authenticated status (has per-buyer fields); else the public
    // availability poll; else the seed snapshot from the detail payload.
    const base = live ?? seed;
    if (!status && !base) return null;

    const currentBid = status?.currentBid ?? base?.currentBid ?? 0;
    return {
      currentBid,
      bidCount: status?.bidCount ?? base?.bidCount ?? 0,
      endsAt: status?.endsAt ?? base?.endsAt ?? new Date().toISOString(),
      status: status?.status ?? base?.status ?? 'OPEN',
      minNextBid: status?.minNextBid ?? minNextBid(currentBid),
      hasReserve: status?.hasReserve ?? base?.hasReserve ?? false,
      reserveMet: status?.reserveMet ?? base?.reserveMet ?? true,
      buyNowAvailable: status?.buyNowAvailable ?? base?.buyNowAvailable ?? false,
      buyNowPrice: status?.buyNowPrice ?? base?.buyNowPrice ?? null,
      youAreHighBidder: status?.youAreHighBidder ?? false,
      won: status?.won ?? false,
      hasBid: status?.hasBid ?? false,
      yourMaxBid: status?.yourMaxBid ?? null,
      finalPrice: status?.finalPrice ?? null,
    };
  }, [isAuction, statusQuery.data, live, seed]);
}
