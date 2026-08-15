import { CouponUsage } from './coupon-usage.model.js';

export const countByBuyer = (couponId, buyerId, session) =>
  CouponUsage.countDocuments({ couponId, buyerId }).session(session || null);

export const countByCoupon = (couponId, session) =>
  CouponUsage.countDocuments({ couponId }).session(session || null);

export const create = async (data, session) =>
  (await CouponUsage.create([data], { session }))[0];

export const findByCheckoutGroup = (couponId, checkoutGroupId, session) =>
  CouponUsage.findOne({ couponId, checkoutGroupId })
    .session(session || null)
    .lean();

export const removeByCheckoutGroup = (couponId, checkoutGroupId, session) =>
  CouponUsage.findOneAndDelete(
    { couponId, checkoutGroupId },
    { session, returnDocument: 'before' },
  ).lean();
