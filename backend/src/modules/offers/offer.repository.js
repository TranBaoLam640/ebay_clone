import { Offer } from './offer.model.js';

export const create = (data) => Offer.create(data);
export const createWithSession = (data, session) =>
  Offer.create([data], { session });

// The buyer's own offers, newest first (My Offers page).
export const listByBuyer = (buyerId) =>
  Offer.find({ buyerId }).sort({ createdAt: -1 }).lean();

export const findOwned = (buyerId, offerId) =>
  Offer.findOne({ _id: offerId, buyerId }).lean();

export const findBlockingByConversation = (conversationId, session) =>
  Offer.findOne({
    conversationId,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  })
    .sort({ createdAt: -1, _id: -1 })
    .session(session || null)
    .lean();

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

export const findById = (offerId, session) =>
  Offer.findById(offerId)
    .session(session || null)
    .lean();

export const updatePendingStatus = (offerId, status, session) =>
  Offer.findOneAndUpdate(
    { _id: offerId, status: 'PENDING', expiresAt: { $gt: new Date() } },
    { $set: { status } },
    { returnDocument: 'after', session },
  ).lean();

export const retractPendingByCreator = (offerId, userId, session) =>
  Offer.findOneAndUpdate(
    {
      _id: offerId,
      createdBy: userId,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    },
    { $set: { status: 'WITHDRAWN' } },
    { returnDocument: 'after', session },
  ).lean();

export const consumeAccepted = (offerId, buyerId, session) =>
  Offer.findOneAndUpdate(
    {
      _id: offerId,
      buyerId,
      status: 'ACCEPTED',
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { status: 'PURCHASED', usedAt: new Date() } },
    { returnDocument: 'after', session },
  ).lean();

export const attachOrder = (offerId, orderId, session) =>
  Offer.updateOne({ _id: offerId }, { $set: { orderId } }, { session });
