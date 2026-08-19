import mongoose from 'mongoose';
import { SellerFeedback } from './seller-feedback.model.js';

const publicPipeline = (includeTransaction = false) => [
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
      ...(includeTransaction && {
        orderId: 1,
        orderItemId: 1,
        productId: 1,
        sellerId: 1,
      }),
      commentType: 1,
      commentText: 1,
      comment: '$commentText',
      verifiedPurchase: { $literal: true },
      source: { $ifNull: ['$source', 'BUYER'] },
      submittedAt: { $ifNull: ['$submittedAt', '$createdAt'] },
      rating: 1,
      itemAsDescribedRating: 1,
      communicationRating: 1,
      shippingTimeRating: 1,
      shippingAndHandlingChargesRating: 1,
      shippingRating: 1,
      images: 1,
      followUpComment: 1,
      sellerResponse: 1,
      revisionRequest: {
        $cond: [
          { $ifNull: ['$revisionRequest.status', false] },
          {
            status: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$revisionRequest.status', 'PENDING'] },
                    { $lt: ['$revisionRequest.expiresAt', '$$NOW'] },
                  ],
                },
                'EXPIRED',
                '$revisionRequest.status',
              ],
            },
            requestedAt: '$revisionRequest.requestedAt',
            expiresAt: '$revisionRequest.expiresAt',
            respondedAt: '$revisionRequest.respondedAt',
          },
          '$$REMOVE',
        ],
      },
      buyer: { fullName: '$buyer.fullName', avatarUrl: '$buyer.avatarUrl' },
      product: {
        $cond: [
          { $ifNull: ['$product._id', false] },
          { id: '$product.uuid', name: '$product.title' },
          '$$REMOVE',
        ],
      },
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

export const replaceAutomatedWithBuyer = (_id, buyerId, data, session) =>
  SellerFeedback.findOneAndUpdate(
    { _id, buyerId, source: 'AUTOMATED' },
    {
      $set: data,
      $unset: { revisionRequest: '' },
    },
    { returnDocument: 'after', runValidators: true, session },
  );

export const findByOrderItem = (orderId, orderItemId, session) =>
  SellerFeedback.findOne({ orderId, orderItemId })
    .session(session || null)
    .lean()
    .exec();

export const updateOwned = (buyerId, _id, data, session) =>
  SellerFeedback.findOneAndUpdate(
    { buyerId, _id },
    { $set: data },
    { returnDocument: 'after', runValidators: true, session },
  );

export const deleteOwned = (buyerId, _id, session) =>
  SellerFeedback.findOneAndDelete({ buyerId, _id }, { session });

export const findById = (_id, session) =>
  SellerFeedback.findById(_id)
    .session(session || null)
    .lean()
    .exec();

export const respondOnce = (_id, sellerId, commentText, session) =>
  SellerFeedback.findOneAndUpdate(
    {
      _id,
      sellerId,
      sellerResponse: { $exists: false },
    },
    { $set: { sellerResponse: { commentText, createdAt: new Date() } } },
    { returnDocument: 'after', runValidators: true, session },
  );

export const addFollowUp = (_id, buyerId, commentText, now, session) =>
  SellerFeedback.findOneAndUpdate(
    {
      _id,
      buyerId,
      source: 'BUYER',
      followUpComment: { $exists: false },
    },
    { $set: { followUpComment: { commentText, createdAt: now } } },
    { returnDocument: 'after', runValidators: true, session },
  );

export const createRevisionRequest = (_id, sellerId, revisionRequest) =>
  SellerFeedback.findOneAndUpdate(
    {
      _id,
      sellerId,
      revisionRequest: { $exists: false },
    },
    { $set: { revisionRequest } },
    { returnDocument: 'after', runValidators: true },
  );

export const acceptRevisionRequest = (_id, buyerId, feedback, now, session) =>
  SellerFeedback.findOneAndUpdate(
    {
      _id,
      buyerId,
      'revisionRequest.status': 'PENDING',
      'revisionRequest.expiresAt': { $gte: now },
    },
    {
      $set: {
        ...feedback,
        source: 'BUYER',
        submittedAt: now,
        'revisionRequest.status': 'ACCEPTED',
        'revisionRequest.respondedAt': now,
      },
    },
    { returnDocument: 'after', runValidators: true, session },
  );

export const declineRevisionRequest = (_id, buyerId, now, session) =>
  SellerFeedback.findOneAndUpdate(
    {
      _id,
      buyerId,
      'revisionRequest.status': 'PENDING',
      'revisionRequest.expiresAt': { $gte: now },
    },
    {
      $set: {
        'revisionRequest.status': 'DECLINED',
        'revisionRequest.respondedAt': now,
      },
    },
    { returnDocument: 'after', runValidators: true, session },
  );

export const expireRevisionRequest = (_id, now) =>
  SellerFeedback.findOneAndUpdate(
    {
      _id,
      'revisionRequest.status': 'PENDING',
      'revisionRequest.expiresAt': { $lt: now },
    },
    { $set: { 'revisionRequest.status': 'EXPIRED' } },
    { returnDocument: 'after', runValidators: true },
  ).lean();

export const aggregateForSeller = async (sellerId, session) => {
  const [result] = await SellerFeedback.aggregate([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(sellerId),
        source: 'BUYER',
      },
    },
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
        averageFeedbackRating: {
          $ifNull: [{ $round: ['$averageFeedbackRating', 2] }, 0],
        },
        feedbackCount: 1,
      },
    },
  ]).session(session || null);
  return result || { averageFeedbackRating: 0, feedbackCount: 0 };
};

export const listPublic = async (
  sellerId,
  { rating, commentType, sort, skip, limit },
) => {
  const match = {
    sellerId: new mongoose.Types.ObjectId(sellerId),
    source: 'BUYER',
  };
  if (rating !== undefined) match.rating = rating;
  if (commentType) match.commentType = commentType;
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
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              pipeline: [{ $project: { _id: 1, uuid: 1, title: 1 } }],
              as: 'product',
            },
          },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          ...publicPipeline(false),
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
    {
      $lookup: {
        from: 'products',
        localField: 'productId',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 1, uuid: 1, title: 1 } }],
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    ...publicPipeline(true),
  ]).session(session || null);
  return item;
};

export const summaryForSeller = async (sellerId) => {
  const [result] = await SellerFeedback.aggregate([
    {
      $match: {
        sellerId: new mongoose.Types.ObjectId(sellerId),
        source: 'BUYER',
      },
    },
    {
      $group: {
        _id: null,
        totalFeedbackCount: { $sum: 1 },
        positiveCount: {
          $sum: { $cond: [{ $eq: ['$commentType', 'POSITIVE'] }, 1, 0] },
        },
        neutralCount: {
          $sum: { $cond: [{ $eq: ['$commentType', 'NEUTRAL'] }, 1, 0] },
        },
        negativeCount: {
          $sum: { $cond: [{ $eq: ['$commentType', 'NEGATIVE'] }, 1, 0] },
        },
        itemAsDescribedRating: { $avg: '$itemAsDescribedRating' },
        communicationRating: { $avg: '$communicationRating' },
        shippingTimeRating: { $avg: '$shippingTimeRating' },
        shippingAndHandlingChargesRating: {
          $avg: '$shippingAndHandlingChargesRating',
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalFeedbackCount: 1,
        counts: {
          POSITIVE: '$positiveCount',
          NEUTRAL: '$neutralCount',
          NEGATIVE: '$negativeCount',
        },
        averageDetailedSellerRatings: {
          itemAsDescribed: {
            $ifNull: [{ $round: ['$itemAsDescribedRating', 2] }, null],
          },
          communication: {
            $ifNull: [{ $round: ['$communicationRating', 2] }, null],
          },
          shippingTime: {
            $ifNull: [{ $round: ['$shippingTimeRating', 2] }, null],
          },
          shippingAndHandlingCharges: {
            $ifNull: [
              { $round: ['$shippingAndHandlingChargesRating', 2] },
              null,
            ],
          },
        },
        positiveFeedbackPercentage: {
          $let: {
            vars: {
              ratedCount: { $add: ['$positiveCount', '$negativeCount'] },
            },
            in: {
              $cond: [
                { $gt: ['$$ratedCount', 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ['$positiveCount', '$$ratedCount'] },
                        100,
                      ],
                    },
                    1,
                  ],
                },
                null,
              ],
            },
          },
        },
      },
    },
  ]);
  return {
    totalFeedbackCount: result?.totalFeedbackCount || 0,
    feedbackCount: result?.totalFeedbackCount || 0,
    counts: result?.counts || { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 },
    positiveFeedbackPercentage: result?.positiveFeedbackPercentage ?? null,
    averageDetailedSellerRatings: result?.averageDetailedSellerRatings || {
      itemAsDescribed: null,
      communication: null,
      shippingTime: null,
      shippingAndHandlingCharges: null,
    },
  };
};

/** Given a set of order item ids, return the subset that already has seller feedback. */
export const feedbackedOrderItemIds = async (orderItemIds) => {
  const docs = await SellerFeedback.find({ orderItemId: { $in: orderItemIds } })
    .select('orderItemId')
    .lean();
  return new Set(docs.map((doc) => String(doc.orderItemId)));
};

/** Given a set of order ids, return the subset that already has seller feedback. */
export const feedbackedOrderIds = async (orderIds) => {
  const docs = await SellerFeedback.find({ orderId: { $in: orderIds } })
    .select('orderId')
    .lean();
  return new Set(docs.map((doc) => String(doc.orderId)));
};
