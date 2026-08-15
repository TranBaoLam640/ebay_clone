import mongoose from 'mongoose';

const requiredRating = {
  type: Number,
  required: true,
  min: 1,
  max: 5,
  validate: Number.isInteger,
};

const optionalRating = {
  type: Number,
  min: 1,
  max: 5,
  validate: Number.isInteger,
};

const sellerFeedbackSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
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
    rating: requiredRating,
    comment: { type: String, trim: true, maxlength: 2000 },
    itemAsDescribedRating: optionalRating,
    communicationRating: optionalRating,
    shippingRating: optionalRating,
  },
  { timestamps: true },
);

sellerFeedbackSchema.index({ sellerId: 1, createdAt: -1 });
sellerFeedbackSchema.index({ buyerId: 1, createdAt: -1 });
sellerFeedbackSchema.index({ orderId: 1 }, { unique: true });

export const SellerFeedback = mongoose.model(
  'SellerFeedback',
  sellerFeedbackSchema,
);
