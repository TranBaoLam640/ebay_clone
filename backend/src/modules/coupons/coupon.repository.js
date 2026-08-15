import { Coupon } from './coupon.model.js';

export const findByCode = (code, session) =>
  Coupon.findOne({ code: code.toUpperCase() })
    .session(session || null)
    .lean();

export const consumeAvailableFromFloor = (couponId, usageFloor, session) =>
  Coupon.findOneAndUpdate(
    {
      _id: couponId,
      $expr: {
        $or: [
          { $eq: ['$usageLimit', null] },
          {
            $lt: [
              { $max: [{ $ifNull: ['$usageCount', 0] }, usageFloor] },
              '$usageLimit',
            ],
          },
        ],
      },
    },
    [
      {
        $set: {
          usageCount: {
            $add: [{ $max: [{ $ifNull: ['$usageCount', 0] }, usageFloor] }, 1],
          },
        },
      },
    ],
    { session, returnDocument: 'after', updatePipeline: true },
  ).lean();

export const decrementUsage = (couponId, session) =>
  Coupon.findOneAndUpdate(
    { _id: couponId, usageCount: { $gt: 0 } },
    { $inc: { usageCount: -1 } },
    { session, returnDocument: 'after' },
  ).lean();
