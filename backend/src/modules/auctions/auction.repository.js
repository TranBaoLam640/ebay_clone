import { Product } from '../products/product.model.js';

// Full auction state for a product, or null if it is not an auction listing.
export const findAuctionState = (productId) =>
  Product.findOne({ _id: productId, listingType: 'AUCTION' })
    .select(
      'uuid title sellerId listingType offersEnabled price status auction',
    )
    .lean();

/**
 * Commit a computed bid outcome with an optimistic compare-and-swap: the update
 * only applies if `auction.version` still equals what we read (and the auction
 * is still open and unexpired). Of any number of racing bids that read the same
 * version, exactly one update matches — the rest match zero documents and the
 * caller re-reads the fresh state and recomputes. This serializes concurrent
 * bids without locks or transactions (mirrors product.repository.deductStock).
 *
 * Returns the updated product, or null when another writer won the race or the
 * auction has since closed/expired.
 */
export const commitBid = (productId, expectedVersion, next, now) =>
  Product.findOneAndUpdate(
    {
      _id: productId,
      'auction.version': expectedVersion,
      'auction.status': 'OPEN',
      'auction.endsAt': { $gt: now },
    },
    {
      $set: {
        'auction.currentBid': next.currentBid,
        'auction.leaderMaxBid': next.leaderMaxBid,
        'auction.currentBidderId': next.currentBidderId,
        'auction.reserveMet': next.reserveMet,
      },
      $inc: { 'auction.bidCount': 1, 'auction.version': 1 },
    },
    { returnDocument: 'after' },
  ).lean();

const winnerFields = {
  'auction.winnerId': {
    $cond: [
      {
        $and: [
          '$auction.reserveMet',
          { $ne: ['$auction.currentBidderId', null] },
        ],
      },
      '$auction.currentBidderId',
      '$$REMOVE',
    ],
  },
  'auction.finalPrice': {
    $cond: [
      {
        $and: [
          '$auction.reserveMet',
          { $ne: ['$auction.currentBidderId', null] },
        ],
      },
      '$auction.currentBid',
      '$$REMOVE',
    ],
  },
};

/**
 * Atomically claim an ended OPEN auction and mark it CLOSED, computing the
 * winner (only when a leader exists and the reserve is met). Because the filter
 * requires status OPEN, exactly one racer — across every pod's sweep and every
 * lazy-close-on-read — succeeds; all others get null. Idempotent by nature.
 */
export const closeAuctionAtomic = (productId, now) =>
  Product.findOneAndUpdate(
    {
      _id: productId,
      listingType: 'AUCTION',
      'auction.status': 'OPEN',
      'auction.endsAt': { $lte: now },
    },
    [
      {
        $set: {
          'auction.status': 'CLOSED',
          ...winnerFields,
          'auction.version': { $add: ['$auction.version', 1] },
        },
      },
    ],
    { returnDocument: 'after', updatePipeline: true },
  ).lean();

/**
 * The fields a Buy It Now close writes, given the buy-now price. Declared once so
 * the update pipeline (which passes the `$auction.buyNowPrice` path, resolved at
 * write time) and the after-image reconstruction below (which passes the value
 * read back from the same atomic write) cannot drift apart.
 *
 * `reserveMet` is deliberately left alone: a buy-out is not a bid, so on a reserve
 * listing the reserve genuinely was never met and the closed record says so.
 */
const buyNowClose = (buyerId, buyNowPrice) => ({
  status: 'CLOSED',
  winnerId: buyerId,
  // The buyer becomes the leader of record, so leaderMaxBid must move with them —
  // left untouched it would attribute the displaced bidder's hidden ceiling to
  // the buyer.
  currentBidderId: buyerId,
  leaderMaxBid: buyNowPrice,
  currentBid: buyNowPrice,
  finalPrice: buyNowPrice,
});

/**
 * Atomic Buy It Now: claim a still-open auction that is still offering BIN and
 * close it with the buyer as winner at the buy-now price. The `$or` restates
 * `proxy-engine.isBuyNowAvailable` as a filter — zero bids, or a reserve listing
 * whose reserve no bid has met yet — and the `$expr` enforces the same
 * buy-out-beats-the-standing-bid rule, which only became reachable once BIN could
 * outlive the first bid.
 *
 * BIN and a racing bid stay mutually exclusive without a version token, because
 * every way the race can go leaves exactly one writer matching: this close flips
 * status to CLOSED, so a racing bid's `status: OPEN` guard misses; and a bid that
 * lands first either bumps bidCount past 0 (no-reserve case) or, if it meets the
 * reserve, flips reserveMet true — either way this filter misses on re-evaluation
 * at write time. A bid that lands first *without* meeting the reserve is not a
 * race at all: BIN is still legitimately on offer, so it may still be claimed.
 *
 * Takes the *before* image so the caller learns who was leading at the instant of
 * the claim — a separate read beforehand would miss a bid landing in between and
 * notify the wrong bidder (or nobody). The after image is reconstructed from it;
 * every field the pipeline writes is either a constant or the buy-now price read
 * back from this same document, so the reconstruction is exact.
 *
 * Returns { product, priorLeaderId }, or null if unavailable.
 */
export const buyNowAtomic = async (productId, buyerId, now) => {
  const before = await Product.findOneAndUpdate(
    {
      _id: productId,
      listingType: 'AUCTION',
      'auction.status': 'OPEN',
      'auction.endsAt': { $gt: now },
      'auction.buyNowPrice': { $gt: 0 },
      // Buying out must beat the live bid — otherwise a low buy-now price on a
      // reserve listing would let a buyer take the item for less than a standing
      // bid and drag currentBid downward.
      $expr: { $gt: ['$auction.buyNowPrice', '$auction.currentBid'] },
      $or: [
        { 'auction.bidCount': 0 },
        // `$ne: null` also excludes a missing field — i.e. a real reserve only.
        // `$ne: true` (not `false`) matches the projection in product.repository,
        // so a doc with an unset reserveMet can't be offered BIN and then refused.
        {
          'auction.reservePrice': { $ne: null },
          'auction.reserveMet': { $ne: true },
        },
      ],
    },
    [
      {
        $set: {
          ...prefixAuction(buyNowClose(buyerId, '$auction.buyNowPrice')),
          'auction.version': { $add: ['$auction.version', 1] },
        },
      },
    ],
    { returnDocument: 'before', updatePipeline: true },
  ).lean();
  if (!before) return null;

  const auction = before.auction;
  return {
    product: {
      ...before,
      auction: {
        ...auction,
        ...buyNowClose(buyerId, auction.buyNowPrice),
        version: auction.version + 1,
      },
    },
    priorLeaderId: auction.currentBidderId ?? null,
  };
};

// { a: 1 } → { 'auction.a': 1 }, for dotted $set paths on the embedded auction.
const prefixAuction = (fields) =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [`auction.${key}`, value]),
  );

// Ended auctions still marked OPEN — the sweep's close candidates.
export const findClosableIds = (now) =>
  Product.find({
    listingType: 'AUCTION',
    'auction.status': 'OPEN',
    'auction.endsAt': { $lte: now },
  })
    .select('_id')
    .lean();
