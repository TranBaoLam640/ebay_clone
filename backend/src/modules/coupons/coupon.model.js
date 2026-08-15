import mongoose from 'mongoose';

const nullablePositiveInteger = {
  type: Number,
  default: null,
  min: 1,
  validate: {
    validator: (value) => value === null || Number.isInteger(value),
    message: 'Value must be a positive integer or null',
  },
};

const schema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 100,
    },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator(value) {
          return (
            Number.isInteger(value) &&
            (this.discountType !== 'PERCENTAGE' || value <= 100)
          );
        },
        message: 'Percentage discounts cannot exceed 100',
      },
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },
    maxDiscount: {
      type: Number,
      min: 1,
      default: null,
      validate: {
        validator(value) {
          return (
            value === null ||
            (Number.isInteger(value) && this.discountType === 'PERCENTAGE')
          );
        },
        message: 'Maximum discount is available only for percentage coupons',
      },
    },
    startsAt: { type: Date, required: true },
    expiresAt: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return this.startsAt instanceof Date && value > this.startsAt;
        },
        message: 'Coupon expiration must be after its start',
      },
    },
    usageLimit: nullablePositiveInteger,
    perUserLimit: nullablePositiveInteger,
    usageCount: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator(value) {
          return (
            Number.isInteger(value) &&
            (this.usageLimit === null || value <= this.usageLimit)
          );
        },
        message: 'Usage count cannot exceed the coupon usage limit',
      },
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true },
);

schema.index({ code: 1 }, { unique: true });
schema.index({ status: 1, startsAt: 1, expiresAt: 1 });

export const Coupon = mongoose.model('Coupon', schema);
