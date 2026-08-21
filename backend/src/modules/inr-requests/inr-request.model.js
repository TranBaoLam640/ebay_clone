import mongoose from 'mongoose';
import {
  INR_CLOSE_REASONS,
  INR_REQUESTED_RESOLUTIONS,
  INR_STATUSES,
} from './inr-request.constants.js';

const trackingEvidenceSchema = new mongoose.Schema(
  {
    carrierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Carrier',
      required: true,
    },
    carrierCode: { type: String, required: true, trim: true },
    carrierName: { type: String, required: true, trim: true },
    trackingId: { type: String, required: true, trim: true, maxlength: 120 },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submittedAt: { type: Date, required: true },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
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
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    orderItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    shipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: true,
    },
    requestedResolution: {
      type: String,
      enum: INR_REQUESTED_RESOLUTIONS,
      required: true,
    },
    quantityMissing: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    details: { type: String, trim: true, maxlength: 1000 },
    requestAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    currency: { type: String, enum: ['VND'], required: true, default: 'VND' },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    status: {
      type: String,
      enum: INR_STATUSES,
      required: true,
      default: 'OPEN',
    },
    trackingEvidenceHistory: { type: [trackingEvidenceSchema], default: [] },
    closedAt: Date,
    closeReason: {
      type: String,
      enum: Object.values(INR_CLOSE_REASONS),
    },
  },
  { timestamps: true },
);

schema.index({ buyerId: 1, status: 1, createdAt: -1 });
schema.index({ sellerId: 1, status: 1, createdAt: -1 });
schema.index(
  { orderId: 1, orderItemId: 1 },
  { unique: true, partialFilterExpression: { status: 'OPEN' } },
);
schema.index({ conversationId: 1 });

export const INRRequest = mongoose.model('INRRequest', schema);
