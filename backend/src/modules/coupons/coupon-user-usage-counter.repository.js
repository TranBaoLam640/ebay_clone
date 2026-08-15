import { CouponUserUsageCounter } from './coupon-user-usage-counter.model.js';

export const find = (couponId, buyerId, session) =>
  CouponUserUsageCounter.findOne({ couponId, buyerId })
    .session(session || null)
    .lean();

const incrementExisting = (couponId, buyerId, limit, session) => {
  const filter = { couponId, buyerId };
  if (limit !== null) filter.usageCount = { $lt: limit };
  return CouponUserUsageCounter.findOneAndUpdate(
    filter,
    { $inc: { usageCount: 1 } },
    { session, returnDocument: 'after', runValidators: true },
  ).lean();
};

export const incrementWithinLimit = async (
  couponId,
  buyerId,
  limit,
  legacyUsageCount,
  session,
) => {
  await CouponUserUsageCounter.updateOne(
    { couponId, buyerId },
    { $max: { usageCount: legacyUsageCount } },
    { session },
  );
  let incremented = await incrementExisting(couponId, buyerId, limit, session);
  if (incremented) return incremented;
  if (limit !== null && legacyUsageCount >= limit) return null;
  try {
    await CouponUserUsageCounter.create(
      [{ couponId, buyerId, usageCount: legacyUsageCount }],
      { session },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    if (session?.inTransaction()) {
      error.addErrorLabel?.('TransientTransactionError');
      throw error;
    }
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    incremented = await incrementExisting(couponId, buyerId, limit, session);
    if (incremented) return incremented;
    const current = await find(couponId, buyerId, session);
    if (current && limit !== null && current.usageCount >= limit) return null;
  }
  return null;
};

export const decrement = async (couponId, buyerId, session) => {
  const counter = await CouponUserUsageCounter.findOneAndUpdate(
    { couponId, buyerId, usageCount: { $gt: 0 } },
    { $inc: { usageCount: -1 } },
    { session, returnDocument: 'after' },
  ).lean();
  if (counter?.usageCount === 0)
    await CouponUserUsageCounter.deleteOne(
      { _id: counter._id, usageCount: 0 },
      { session },
    );
  return counter;
};
