import mongoose from 'mongoose';
import { RETURN_REASONS, RETURN_STATUSES } from './return-request.constants.js';

const schema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
    },
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    reason: { type: String, enum: RETURN_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: RETURN_STATUSES,
      required: true,
      default: 'REQUESTED',
    },
    cancelledAt: Date,
  },
  { timestamps: true },
);

schema.index({ buyerId: 1, status: 1, createdAt: -1 });
schema.index({ orderId: 1 }, { unique: true });
schema.index({ sellerId: 1, status: 1, createdAt: -1 });

export const ReturnRequest = mongoose.model('ReturnRequest', schema);
