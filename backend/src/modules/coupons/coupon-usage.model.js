import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkoutGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CheckoutGroup',
      required: true,
    },
    orderIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
      required: true,
      validate: {
        validator: (value) => value.length > 0,
        message: 'Coupon usage must reference at least one order',
      },
    },
    usedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true },
);

schema.index({ couponId: 1, buyerId: 1, usedAt: -1 });
schema.index({ couponId: 1, checkoutGroupId: 1 }, { unique: true });
schema.index({ checkoutGroupId: 1 }, { unique: true });

export const CouponUsage = mongoose.model('CouponUsage', schema);
