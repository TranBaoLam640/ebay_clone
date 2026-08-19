import mongoose from 'mongoose';
import { ProductReview } from './product-review.model.js';

const publicProjection = {
  _id: 0,
  id: '$_id',
  rating: 1,
  comment: 1,
  productId: 1,
  catalogProductId: 1,
  ePID: 1,
  verifiedPurchase: { $literal: true },
  buyer: {
    id: '$buyer._id',
    displayName: '$buyer.fullName',
    avatarUrl: '$buyer.avatarUrl',
  },
  reviewer: {
    fullName: '$buyer.fullName',
    avatarUrl: '$buyer.avatarUrl',
  },
  purchasedProduct: {
    id: '$purchasedProduct.uuid',
    name: '$purchasedProduct.title',
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
      pipeline: [{ $project: { _id: 1, fullName: 1, avatarUrl: 1 } }],
      as: 'buyer',
    },
  },
  { $unwind: { path: '$buyer', preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: 'products',
      localField: 'productId',
      foreignField: '_id',
      pipeline: [{ $project: { _id: 0, uuid: 1, title: 1 } }],
      as: 'purchasedProduct',
    },
  },
  {
    $unwind: {
      path: '$purchasedProduct',
      preserveNullAndEmptyArrays: true,
    },
  },
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

export const aggregateByCatalogProduct = async (catalogProductId, session) => {
  const [result] = await ProductReview.aggregate([
    {
      $match: {
        catalogProductId: new mongoose.Types.ObjectId(catalogProductId),
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
        oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
        twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        averageRating: { $round: ['$averageRating', 2] },
        reviewCount: 1,
        ratingHistogram: {
          1: '$oneStar',
          2: '$twoStar',
          3: '$threeStar',
          4: '$fourStar',
          5: '$fiveStar',
        },
      },
    },
  ]).session(session || null);
  return (
    result || {
      averageRating: null,
      reviewCount: 0,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  );
};

export const list = async (
  catalogProductId,
  { q, rating, sort, skip, limit },
) => {
  const match = {
    catalogProductId: new mongoose.Types.ObjectId(catalogProductId),
  };
  if (rating !== undefined) match.rating = rating;
  if (q)
    match.comment = {
      $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i',
    };
  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
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

export const recentByCatalogProduct = (catalogProductId, limit = 5) =>
  ProductReview.aggregate([
    {
      $match: {
        catalogProductId: new mongoose.Types.ObjectId(catalogProductId),
      },
    },
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

export const reviewsByOrderItemIds = async (orderItemIds) => {
  const docs = await ProductReview.find({ orderItemId: { $in: orderItemIds } })
    .select('_id orderItemId rating comment createdAt')
    .lean();
  return new Map(
    docs.map((doc) => [
      String(doc.orderItemId),
      {
        id: String(doc._id),
        rating: doc.rating,
        comment: doc.comment ?? null,
        createdAt: doc.createdAt,
      },
    ]),
  );
};
