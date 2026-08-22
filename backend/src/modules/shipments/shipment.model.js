import mongoose from 'mongoose';
import {
  SHIPMENT_CARRIERS,
  SHIPMENT_PURPOSES,
  SHIPMENT_STATUSES,
} from './shipment.constants.js';

const schema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      immutable: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
      immutable: true,
    },
    purpose: {
      type: String,
      enum: SHIPMENT_PURPOSES,
      required: true,
      default: 'ORIGINAL',
      immutable: true,
    },
    replacementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Replacement',
      immutable: true,
    },
    shipperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    carrier: {
      type: String,
      enum: Object.values(SHIPMENT_CARRIERS),
      required: true,
      default: SHIPMENT_CARRIERS.SBAY_EXPRESS,
      immutable: true,
    },
    trackingNumber: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
    },
    status: {
      type: String,
      enum: SHIPMENT_STATUSES,
      required: true,
      default: 'READY_FOR_PICKUP',
    },
    estimatedDeliveryAt: { type: Date, required: true },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index(
  { orderId: 1, purpose: 1 },
  {
    unique: true,
    name: 'unique_original_shipment_per_order',
    partialFilterExpression: { purpose: 'ORIGINAL' },
  },
);
schema.index(
  { replacementId: 1 },
  {
    unique: true,
    name: 'unique_replacement_shipment_per_replacement',
    partialFilterExpression: { purpose: 'REPLACEMENT' },
  },
);
schema.index({ trackingNumber: 1 }, { unique: true });
schema.index({ orderId: 1, purpose: 1, createdAt: -1 });
schema.index({ shipperId: 1, status: 1, createdAt: -1 });
schema.index({ sellerId: 1, status: 1, createdAt: -1 });
schema.index({ buyerId: 1, createdAt: -1 });

schema.pre('validate', function () {
  if (this.purpose === 'REPLACEMENT' && !this.replacementId)
    this.invalidate(
      'replacementId',
      'REPLACEMENT shipments require replacementId',
    );
  if (this.purpose === 'ORIGINAL' && this.replacementId)
    this.invalidate(
      'replacementId',
      'ORIGINAL shipments cannot have replacementId',
    );
});

export const Shipment = mongoose.model('Shipment', schema);
