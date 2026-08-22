import mongoose from 'mongoose';
import {
  REFUND_METHODS,
  REFUND_SOURCE_TYPES,
  REFUND_STATUSES,
} from './refund.constants.js';

const schema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    checkoutGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CheckoutGroup',
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
    },
    sourceType: { type: String, enum: REFUND_SOURCE_TYPES, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    currency: { type: String, enum: ['VND'], required: true, default: 'VND' },
    method: { type: String, enum: REFUND_METHODS, required: true },
    status: { type: String, enum: REFUND_STATUSES, required: true },
    providerRefundId: String,
    failureReason: String,
    processingClaimToken: String,
    processingClaimedAt: Date,
    completedAt: Date,
    failedAt: Date,
  },
  { timestamps: true },
);

schema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
schema.index({ paymentId: 1, createdAt: -1 });
schema.index({ sellerId: 1, createdAt: -1 });

schema.pre('validate', function () {
  if (this.status === 'COMPLETED' && !this.completedAt)
    this.invalidate('completedAt', 'Completed refunds require completedAt');
  if (this.status !== 'COMPLETED' && this.completedAt)
    this.invalidate(
      'completedAt',
      'Only completed refunds can have completedAt',
    );
  if (this.status === 'FAILED') {
    if (!this.failedAt)
      this.invalidate('failedAt', 'Failed refunds require failedAt');
    if (!this.failureReason)
      this.invalidate('failureReason', 'Failed refunds require failureReason');
  }
  if (this.status !== 'FAILED' && (this.failedAt || this.failureReason))
    this.invalidate(
      'failureReason',
      'Only failed refunds can have failure details',
    );
});

export const Refund = mongoose.model('Refund', schema);
