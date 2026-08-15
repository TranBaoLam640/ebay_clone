import mongoose from 'mongoose';
import { SellerFeedback } from './seller-feedback.model.js';

const publicPipeline = () => [
  {
    $lookup: {
      from: 'users',
      localField: 'buyerId',
      foreignField: '_id',
      pipeline: [{ $project: { _id: 0, fullName: 1, avatarUrl: 1 } }],
      as: 'buyer',
    },
  },
  { $unwind: '$buyer' },
  {
    $project: {
      _id: 0,
      id: '$_id',
      rating: 1,
      comment: 1,
      itemAsDescribedRating: 1,
      communicationRating: 1,
      shippingRating: 1,
      buyer: { fullName: '$buyer.fullName', avatarUrl: '$buyer.avatarUrl' },
      createdAt: 1,
      updatedAt: 1,
    },
  },
];

export const transaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export const create = async (data, session) =>
  (await SellerFeedback.create([data], { session }))[0];

export const updateOwned = (buyerId, _id, data, session) =>
  SellerFeedback.findOneAndUpdate(
    { buyerId, _id },
    { $set: data },
    { returnDocument: 'after', runValidators: true, session },
  );

export const deleteOwned = (buyerId, _id, session) =>
  SellerFeedback.findOneAndDelete({ buyerId, _id }, { session });

export const aggregateForSeller = async (sellerId, session) => {
  const [result] = await SellerFeedback.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(sellerId) } },
    {
      $group: {
        _id: null,
        averageFeedbackRating: { $avg: '$rating' },
        feedbackCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        averageFeedbackRating: { $round: ['$averageFeedbackRating', 2] },
        feedbackCount: 1,
      },
    },
  ]).session(session || null);
  return result || { averageFeedbackRating: 0, feedbackCount: 0 };
};

export const listPublic = async (sellerId, { rating, sort, skip, limit }) => {
  const match = { sellerId: new mongoose.Types.ObjectId(sellerId) };
  if (rating !== undefined) match.rating = rating;
  const sorts = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    rating_desc: { rating: -1, createdAt: -1, _id: -1 },
    rating_asc: { rating: 1, createdAt: -1, _id: -1 },
  };
  const [result] = await SellerFeedback.aggregate([
    { $match: match },
    {
      $facet: {
        items: [
          { $sort: sorts[sort] || sorts.newest },
          { $skip: skip },
          { $limit: limit },
          ...publicPipeline(),
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]);
  return { items: result.items, total: result.total[0]?.value || 0 };
};

export const toPublic = async (feedback, session) => {
  const [item] = await SellerFeedback.aggregate([
    { $match: { _id: feedback._id } },
    ...publicPipeline(),
  ]).session(session || null);
  return item;
};

/** Given a set of order ids, return the subset that already has seller feedback. */
export const feedbackedOrderIds = async (orderIds) => {
  const docs = await SellerFeedback.find({ orderId: { $in: orderIds } })
    .select('orderId')
    .lean();
  return new Set(docs.map((doc) => String(doc.orderId)));
};
