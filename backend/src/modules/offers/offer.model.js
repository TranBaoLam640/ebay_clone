import mongoose from 'mongoose';

/**
 * Buyer's Best Offer on an offers-enabled FIXED listing. Half-implemented: the
 * buyer creates and withdraws offers and sees them in My Offers; there is no
 * seller Accept/Decline/Counter side (that needs a seller actor, out of scope).
 * In practice offers only transition PENDING → WITHDRAWN. `expiresAt` is stored
 * and shown to the buyer, but no job flips PENDING → EXPIRED (that would live on
 * the seller/response side, which is out of scope); ACCEPTED/DECLINED/EXPIRED are
 * reserved in the enum for when that half is built.
 */
const schema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: Number.isInteger,
    },
    message: { type: String, trim: true, maxlength: 500 },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    originalPrice: { type: Number, min: 0, validate: Number.isInteger },
    parentOfferId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    status: {
      type: String,
      enum: [
        'PENDING',
        'ACCEPTED',
        'DECLINED',
        'COUNTERED',
        'EXPIRED',
        'WITHDRAWN',
        'PURCHASED',
      ],
      default: 'PENDING',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  },
  { timestamps: true },
);

schema.index({ buyerId: 1, createdAt: -1 });
schema.index({ productId: 1, status: 1 });
schema.index({ conversationId: 1, createdAt: -1 });
schema.index({ parentOfferId: 1 });
schema.index(
  { conversationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      conversationId: { $exists: true },
      status: { $in: ['PENDING', 'ACCEPTED'] },
    },
  },
);

export const Offer = mongoose.model('Offer', schema);
