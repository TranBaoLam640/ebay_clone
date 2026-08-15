import { bidIncrement } from './increment.js';

/**
 * eBay-style automatic (proxy) bidding — pure functions, no I/O, so the whole
 * concurrency-critical decision is deterministic and unit-testable in isolation.
 *
 * A bidder never bids "one amount"; they enter the maximum they are willing to
 * pay (`maxBid`, hidden) and the system bids for them, as little as necessary,
 * to keep them in the lead. The displayed price is
 *   min(second-highest max + increment, highest max).
 */

/**
 * Derive the live status of an auction at `now` without writing anything. An
 * auction whose `endsAt` has passed reads as CLOSED even before the sweep or a
 * lazy close persists it — so bids past the deadline are refused immediately.
 */
export const deriveStatus = (auction, now) => {
  if (auction.status === 'CLOSED') return 'CLOSED';
  if (now < auction.startsAt) return 'SCHEDULED';
  if (now >= auction.endsAt) return 'CLOSED';
  return 'OPEN';
};

/**
 * Lowest max a *challenger* may enter next (also the buy-box placeholder value):
 * the start price when there are no bids yet, otherwise current bid + increment.
 * A self-raise (already leading) has a different rule handled in computeProxy.
 */
export const minRequiredBid = (auction) => {
  if (!auction.currentBidderId) return auction.currentBid;
  return auction.currentBid + bidIncrement(auction.currentBid);
};

/**
 * Whether an auction's reserve (if any) is met at a given leader max. No reserve
 * always counts as met (the auction can always produce a winner).
 */
export const isReserveMet = (auction, leaderMaxBid) => {
  if (auction.reservePrice == null) return true;
  return leaderMaxBid != null && leaderMaxBid >= auction.reservePrice;
};

/**
 * Whether Buy It Now is still offered. eBay's rule: BIN disappears with the
 * first bid, *except* on a reserve listing, where it stays until a bid meets the
 * reserve — until then no bid has reached the seller's floor, so the instant-buy
 * offer is still the best outcome on the table.
 *
 * Buying out must also beat the live bid. That is free while BIN only outlives a
 * bidless auction (any sane buy-now price exceeds the start price), but once bids
 * can stand underneath it, a buy-now price below the current bid would sell the
 * item for less than someone has already bid.
 *
 * This is the canonical rule. Two query layers necessarily restate it in Mongo
 * terms — `auction.repository.buyNowAtomic` (the claim filter) and
 * `product.repository` (the catalog projection) — and must be kept in step.
 */
export const isBuyNowAvailable = (auction, status) =>
  status === 'OPEN' &&
  auction.buyNowPrice > 0 &&
  auction.buyNowPrice > auction.currentBid &&
  (auction.bidCount === 0 ||
    (auction.reservePrice != null && !auction.reserveMet));

/**
 * Compute the outcome of `bidderId` placing `maxBid` against the current auction
 * state. Pure: returns the next displayed state, this bid's outcome, the price
 * to record for *this* bidder's own history row (`amountAtBid`), whether the
 * leader changed, and who (if anyone) was displaced — the caller commits it with
 * a version-guarded compare-and-swap and sends the outbid notification.
 *
 * `amountAtBid` is the price this bidder personally reached, which is not always
 * the auction's next displayed price: an instantly-outbid challenger only ever
 * reached their own max, while the displayed price belongs to the leader's
 * counter-auto-bid.
 *
 * `auction` is the embedded state: { currentBid, leaderMaxBid, currentBidderId,
 * reservePrice?, startPrice }.
 */
export const computeProxy = (auction, bidderId, maxBid) => {
  const { currentBid, reservePrice } = auction;
  const leaderMaxBid = auction.leaderMaxBid ?? null;
  const leaderId = auction.currentBidderId
    ? String(auction.currentBidderId)
    : null;
  const bidder = String(bidderId);
  const hasReserve = reservePrice != null;

  // Proxy reserve rule: the moment the leader's hidden max reaches the reserve,
  // auto-bid them straight up to the reserve (never above their max). This can
  // jump the displayed price several increments at once and flips reserveMet.
  const withReserve = (displayed, leaderMax) => {
    if (!hasReserve) return { displayed, reserveMet: true };
    if (leaderMax >= reservePrice)
      return {
        displayed: Math.min(Math.max(displayed, reservePrice), leaderMax),
        reserveMet: true,
      };
    return { displayed, reserveMet: false };
  };

  const invalid = (reason, minRequired) => ({
    valid: false,
    reason,
    minRequired,
  });

  // Case 1 — no prior leader: first bid takes the lead at the start price.
  if (leaderId === null) {
    if (maxBid < currentBid) return invalid('BELOW_MIN', currentBid);
    const r = withReserve(currentBid, maxBid);
    return {
      valid: true,
      next: {
        currentBid: r.displayed,
        leaderMaxBid: maxBid,
        currentBidderId: bidderId,
        reserveMet: r.reserveMet,
      },
      outcome: 'LEADING',
      amountAtBid: r.displayed,
      leaderChanged: true,
      displacedBidderId: null,
    };
  }

  // Case 2 — self-raise: already leading, just lift the hidden max. The
  // displayed price does NOT rise (no bidding war against yourself), except a
  // reserve jump if this raise first clears the reserve.
  if (leaderId === bidder) {
    if (maxBid <= leaderMaxBid)
      return invalid(
        'BELOW_CURRENT_MAX',
        leaderMaxBid + bidIncrement(leaderMaxBid),
      );
    const r = withReserve(currentBid, maxBid);
    return {
      valid: true,
      next: {
        currentBid: r.displayed,
        leaderMaxBid: maxBid,
        currentBidderId: auction.currentBidderId,
        reserveMet: r.reserveMet,
      },
      outcome: 'LEADING',
      amountAtBid: r.displayed,
      leaderChanged: false,
      displacedBidderId: null,
    };
  }

  // Challenger vs a standing leader — must at least meet current bid + increment.
  const minRequired = currentBid + bidIncrement(currentBid);
  if (maxBid < minRequired) return invalid('BELOW_MIN', minRequired);

  // Case 3 — challenger's max beats the leader's max: new leader, priced one
  // increment above the old leader's max but capped at the challenger's max.
  if (maxBid > leaderMaxBid) {
    const displayed = Math.min(
      leaderMaxBid + bidIncrement(leaderMaxBid),
      maxBid,
    );
    const r = withReserve(displayed, maxBid);
    return {
      valid: true,
      next: {
        currentBid: r.displayed,
        leaderMaxBid: maxBid,
        currentBidderId: bidderId,
        reserveMet: r.reserveMet,
      },
      outcome: 'LEADING',
      amountAtBid: r.displayed,
      leaderChanged: true,
      displacedBidderId: auction.currentBidderId,
    };
  }

  // Case 4 — challenger's max does not beat the leader's max (equal max = the
  // earlier bidder keeps the tie): instantly outbid; the leader's displayed
  // price rises to one increment above the challenger's max, capped at the
  // leader's max.
  const displayed = Math.min(maxBid + bidIncrement(maxBid), leaderMaxBid);
  const r = withReserve(displayed, leaderMaxBid);
  return {
    valid: true,
    next: {
      currentBid: r.displayed,
      leaderMaxBid,
      currentBidderId: auction.currentBidderId,
      reserveMet: r.reserveMet,
    },
    outcome: 'OUTBID',
    // The challenger's own row records the amount they actually reached — their
    // max. The higher `r.displayed` price is the leader's counter-auto-bid and
    // belongs to the leader's row, not this one.
    amountAtBid: maxBid,
    leaderChanged: false,
    displacedBidderId: null,
  };
};
