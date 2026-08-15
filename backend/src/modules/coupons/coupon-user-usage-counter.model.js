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
    usageCount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
  },
  { timestamps: true },
);

schema.index({ couponId: 1, buyerId: 1 }, { unique: true });
schema.index({ buyerId: 1, updatedAt: -1 });

export const CouponUserUsageCounter = mongoose.model(
  'CouponUserUsageCounter',
  schema,
);
