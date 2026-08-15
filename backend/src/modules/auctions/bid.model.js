import mongoose from 'mongoose';

/**
 * Append-only record of every accepted bid on an auction. Written after the
 * auction-state compare-and-swap commits (Phase 2), so a crash between the two
 * can lose a history row but never corrupts the authoritative auction state.
 *
 * - `maxBid`     the bidder's hidden proxy ceiling at the time of this bid.
 * - `amountAtBid` the displayed current bid this bid produced (what the row
 *                 shows publicly once the leader hides their max).
 * - `outcome`    LEADING if this bid took the lead, OUTBID if it was instantly
 *                beaten by a standing higher max.
 */
const schema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    maxBid: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    amountAtBid: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    outcome: {
      type: String,
      enum: ['LEADING', 'OUTBID'],
      required: true,
    },
  },
  { timestamps: true },
);

schema.index({ productId: 1, createdAt: -1 });
schema.index({ bidderId: 1, productId: 1, createdAt: -1 });

export const Bid = mongoose.model('Bid', schema);
