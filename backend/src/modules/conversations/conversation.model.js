import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    type: {
      type: String,
      enum: ['PRE_PURCHASE', 'POST_PURCHASE'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      required: true,
    },
    lastMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, index: true },
    buyerUnreadCount: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },
    sellerUnreadCount: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isInteger,
    },
  },
  { timestamps: true },
);

schema.index({ buyerId: 1, sellerId: 1, productId: 1 });
schema.index({ buyerId: 1, lastMessageAt: -1 });
schema.index({ sellerId: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', schema);
