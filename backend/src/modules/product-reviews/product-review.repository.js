import mongoose from 'mongoose';
import { ProductReview } from './product-review.model.js';

const publicProjection = {
  _id: 0,
  id: '$_id',
  rating: 1,
  comment: 1,
  reviewer: {
    fullName: '$reviewer.fullName',
    avatarUrl: '$reviewer.avatarUrl',
  },
  createdAt: 1,
  updatedAt: 1,
};

const publicPipeline = () => [
  {
    $lookup: {
      from: 'users',
      localField: 'buyerId',
      foreignField: '_id',
      pipeline: [{ $project: { _id: 0, fullName: 1, avatarUrl: 1 } }],
      as: 'reviewer',
    },
  },
  { $unwind: '$reviewer' },
  { $project: publicProjection },
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
  (await ProductReview.create([data], { session }))[0];

export const updateOwned = (buyerId, _id, data, session) =>
  ProductReview.findOneAndUpdate({ buyerId, _id }, data, {
    returnDocument: 'after',
    runValidators: true,
    session,
  });

export const deleteOwned = (buyerId, _id, session) =>
  ProductReview.findOneAndDelete({ buyerId, _id }, { session });

export const aggregate = async (productId, session) => {
  const [result] = await ProductReview.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        averageRating: { $round: ['$averageRating', 2] },
        reviewCount: 1,
      },
    },
  ]).session(session || null);
  return result || { averageRating: 0, reviewCount: 0 };
};

export const list = async (productId, { rating, sort, skip, limit }) => {
  const match = { productId: new mongoose.Types.ObjectId(productId) };
  if (rating !== undefined) match.rating = rating;
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    rating_desc: { rating: -1, createdAt: -1 },
    rating_asc: { rating: 1, createdAt: -1 },
  };
  const [result] = await ProductReview.aggregate([
    { $match: match },
    {
      $facet: {
        items: [
          { $sort: sortMap[sort] || sortMap.newest },
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

export const recent = (productId, limit = 5) =>
  ProductReview.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    ...publicPipeline(),
  ]);

export const toPublic = async (review, session) => {
  const [item] = await ProductReview.aggregate([
    { $match: { _id: review._id } },
    ...publicPipeline(),
  ]).session(session || null);
  return item;
};

/** Given a set of order item ids, return the subset that already has a review. */
export const reviewedOrderItemIds = async (orderItemIds) => {
  const docs = await ProductReview.find({ orderItemId: { $in: orderItemIds } })
    .select('orderItemId')
    .lean();
  return new Set(docs.map((doc) => String(doc.orderItemId)));
};
