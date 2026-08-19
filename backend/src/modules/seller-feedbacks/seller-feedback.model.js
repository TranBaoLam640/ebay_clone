import mongoose from 'mongoose';

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
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
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
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    commentType: {
      type: String,
      enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
    },
    commentText: { type: String, trim: true, maxlength: 500 },
    // Legacy compatibility for existing seller aggregate/UI behavior.
    rating: optionalRating,
    itemAsDescribedRating: optionalRating,
    communicationRating: optionalRating,
    shippingTimeRating: optionalRating,
    shippingAndHandlingChargesRating: optionalRating,
    // Legacy compatibility for pre-line-item feedback payloads.
    shippingRating: optionalRating,
    images: {
      type: [
        {
          key: { type: String, required: true, trim: true },
          url: { type: String, required: true, trim: true },
        },
      ],
      default: [],
      validate: {
        validator(images) {
          return images.length <= 5;
        },
        message: 'Seller feedback can include at most 5 images',
      },
    },
    sellerResponse: {
      commentText: { type: String, trim: true, maxlength: 500 },
      createdAt: Date,
    },
  },
  { timestamps: true },
);

sellerFeedbackSchema.index({ sellerId: 1, createdAt: -1 });
sellerFeedbackSchema.index({ buyerId: 1, createdAt: -1 });
sellerFeedbackSchema.index({ productId: 1, createdAt: -1 });
sellerFeedbackSchema.index({ orderId: 1, orderItemId: 1 }, { unique: true });

export const SellerFeedback = mongoose.model(
  'SellerFeedback',
  sellerFeedbackSchema,
);
