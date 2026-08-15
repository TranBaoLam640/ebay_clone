import { Bid } from './bid.model.js';

// Aggregation `$match` does NOT auto-cast strings to ObjectId the way Mongoose
// query helpers (find/exists/distinct) do, so ids reaching an aggregation must
// be coerced explicitly. Accepts a hex string or an existing ObjectId.
const oid = (value) => new Bid.base.Types.ObjectId(value);

// Append an accepted bid to the history (after the auction-state CAS commits).
export const create = (data) => Bid.create(data);

/**
 * Public bid history for an auction, newest first. Bidder identity is redacted
 * by the service; this returns the raw rows plus the bidder id (for masking and
 * the distinct-bidder count).
 */
export const listByProduct = (productId, limit = 50) =>
  Bid.find({ productId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('bidderId maxBid amountAtBid outcome createdAt')
    .lean();

// Distinct bidders on an auction (the "N bidders" summary line).
export const distinctBidderCount = async (productId) =>
  (await Bid.distinct('bidderId', { productId })).length;

// Whether a buyer has placed any bid on an auction (drives the outbid banner
// even after they lose the lead).
export const existsForBidder = (productId, bidderId) =>
  Bid.exists({ productId, bidderId });

// The buyer's own highest max on an auction (safe to show to themselves).
export const myMaxOnProduct = async (productId, bidderId) => {
  const [row] = await Bid.aggregate([
    { $match: { productId: oid(productId), bidderId: oid(bidderId) } },
    { $group: { _id: null, max: { $max: '$maxBid' } } },
  ]);
  return row?.max ?? null;
};

/**
 * The buyer's own bidding activity: the latest bid per auction they have bid on,
 * with their highest max on each. Drives the My Bids page.
 */
export const myBidsSummary = (bidderId) =>
  Bid.aggregate([
    { $match: { bidderId: oid(bidderId) } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$productId',
        yourMaxBid: { $max: '$maxBid' },
        lastBidAt: { $first: '$createdAt' },
        bidCount: { $sum: 1 },
      },
    },
    { $sort: { lastBidAt: -1 } },
  ]);
