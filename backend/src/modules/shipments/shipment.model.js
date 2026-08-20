import mongoose from 'mongoose';
import { SHIPMENT_CARRIERS, SHIPMENT_STATUSES } from './shipment.constants.js';

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
  },
  { timestamps: true },
);

schema.index({ orderId: 1 }, { unique: true });
schema.index({ trackingNumber: 1 }, { unique: true });
schema.index({ shipperId: 1, status: 1, createdAt: -1 });
schema.index({ sellerId: 1, status: 1, createdAt: -1 });
schema.index({ buyerId: 1, createdAt: -1 });

export const Shipment = mongoose.model('Shipment', schema);
