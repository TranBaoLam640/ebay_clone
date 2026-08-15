import { SellerProfile } from './seller-profile.model.js';

const publicFields =
  '_id displayName avatarUrl description averageFeedbackRating feedbackCount';

export const findActiveById = (sellerId) =>
  SellerProfile.findOne({ _id: sellerId, status: 'ACTIVE' })
    .select(publicFields)
    .lean()
    .exec();

export const findById = (sellerId, session) =>
  SellerProfile.findById(sellerId)
    .lean()
    .session(session || null)
    .exec();

export const activeById = (sellerId, session) =>
  SellerProfile.findOne({ _id: sellerId, status: 'ACTIVE' })
    .lean()
    .session(session || null)
    .exec();

export const updateFeedbackAggregate = (sellerId, aggregate, session) =>
  SellerProfile.findByIdAndUpdate(sellerId, aggregate, {
    returnDocument: 'after',
    runValidators: true,
    session,
  })
    .lean()
    .exec();
