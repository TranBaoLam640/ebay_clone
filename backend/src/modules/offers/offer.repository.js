import { Offer } from './offer.model.js';

export const create = (data) => Offer.create(data);

// The buyer's own offers, newest first (My Offers page).
export const listByBuyer = (buyerId) =>
  Offer.find({ buyerId }).sort({ createdAt: -1 }).lean();

export const findOwned = (buyerId, offerId) =>
  Offer.findOne({ _id: offerId, buyerId }).lean();

/**
 * Withdraw a still-pending offer. Atomic guard on status: PENDING so a
 * concurrent withdraw/expire can't double-transition. Returns the updated doc
 * or null when it was not pending (or not owned).
 */
export const withdrawIfPending = (buyerId, offerId) =>
  Offer.findOneAndUpdate(
    { _id: offerId, buyerId, status: 'PENDING' },
    { $set: { status: 'WITHDRAWN' } },
    { returnDocument: 'after' },
  ).lean();
