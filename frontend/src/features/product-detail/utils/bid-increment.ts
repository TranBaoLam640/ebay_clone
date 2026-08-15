/**
 * Client mirror of the server VND bid-increment table (auctions/increment.js).
 * Used only to render the min-next-bid hint/placeholder; the server remains
 * authoritative and returns the exact minimum in a 422 if a bid is too low.
 */
export function bidIncrement(currentBid: number): number {
  if (currentBid < 100_000) return 5_000;
  if (currentBid < 1_000_000) return 20_000;
  if (currentBid < 10_000_000) return 100_000;
  if (currentBid < 100_000_000) return 500_000;
  return 1_000_000;
}

/** Minimum a challenger may bid next: current bid + its bracket increment. */
export function minNextBid(currentBid: number): number {
  return currentBid + bidIncrement(currentBid);
}
