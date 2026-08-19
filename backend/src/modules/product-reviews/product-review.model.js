import mongoose from 'mongoose';

const productReviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    catalogProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogProduct',
      required: true,
    },
    ePID: { type: String, required: true, trim: true },
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
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      immutable: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    comment: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

productReviewSchema.index({ productId: 1, createdAt: -1 });
productReviewSchema.index({ catalogProductId: 1, createdAt: -1 });
productReviewSchema.index({ ePID: 1, createdAt: -1 });
productReviewSchema.index({ buyerId: 1, createdAt: -1 });

export const ProductReview = mongoose.model(
  'ProductReview',
  productReviewSchema,
);
