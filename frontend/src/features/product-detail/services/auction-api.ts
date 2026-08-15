import { apiGet, apiMutate } from '@/services/api-client';
import type { AuctionStatus, ListingType } from '@/features/catalog/types/catalog.types';

/** Authenticated per-buyer auction status driving the banner + buy box. */
export interface BidStatus {
  listingType: ListingType;
  status: AuctionStatus;
  currentBid: number;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  minNextBid: number;
  hasReserve: boolean;
  reserveMet: boolean;
  buyNowAvailable: boolean;
  buyNowPrice?: number | null;
  finalPrice?: number | null;
  youAreHighBidder: boolean;
  won: boolean;
  hasBid: boolean;
  yourMaxBid: number | null;
}

/** Buy It Now response: an auction snapshot plus the created win order's id, so
 *  the client can route the buyer straight into checkout. */
export interface BuyNowResult extends BidStatus {
  orderId: string | null;
}

export interface PlaceBidResult extends BidStatus {
  outcome: 'LEADING' | 'OUTBID';
}

export interface BidHistoryRow {
  /** Masked for everyone except the signed-in viewer's own rows. */
  maskedBidder: string;
  isYou: boolean;
  amount: number;
  isLeader: boolean;
  createdAt: string;
}

export interface BidHistory {
  bidCount: number;
  bidderCount: number;
  bids: BidHistoryRow[];
}

export interface MyBid {
  productUuid: string;
  productTitle: string;
  productImage: string | null;
  yourMaxBid: number;
  currentBid: number;
  bidCount: number;
  endsAt: string;
  status: AuctionStatus;
  youAreHighBidder: boolean;
  won: boolean;
  endedReserveNotMet: boolean;
  finalPrice: number | null;
}

export type OfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export interface MyOffer {
  id: string;
  productUuid: string | null;
  productTitle: string | null;
  productImage: string | null;
  amount: number;
  quantity: number;
  message: string | null;
  status: OfferStatus;
  expiresAt: string;
  createdAt: string;
}

export const auctionApi = {
  bidStatus: (uuid: string) => apiGet<BidStatus>(`/products/${uuid}/bid-status`),

  bidHistory: (uuid: string) => apiGet<BidHistory>(`/products/${uuid}/bids`),

  placeBid: (uuid: string, maxBid: number) =>
    apiMutate<PlaceBidResult>('post', `/products/${uuid}/bids`, { maxBid }),

  buyNow: (uuid: string) =>
    apiMutate<BuyNowResult>('post', `/products/${uuid}/buy-now`, {}),

  createOffer: (
    uuid: string,
    payload: { amount: number; quantity?: number; message?: string },
  ) => apiMutate<MyOffer>('post', `/products/${uuid}/offers`, payload),

  myBids: () => apiGet<MyBid[]>('/me/bids'),

  myOffers: () => apiGet<MyOffer[]>('/me/offers'),

  withdrawOffer: (offerId: string) =>
    apiMutate<{ id: string; status: OfferStatus }>(
      'delete',
      `/me/offers/${offerId}`,
    ),
};
