import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    title: String,
    image: String,
    unitPrice: { type: Number, min: 0 },
    itemSubtotal: { type: Number, min: 0 },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    originalPrice: { type: Number, min: 0 },
    finalPrice: { type: Number, min: 0 },
  },
  { timestamps: false },
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
    checkoutGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CheckoutGroup',
    },
    orderStatus: {
      type: String,
      enum: ['PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'DELIVERED'],
      required: true,
    },
    paymentMethod: { type: String, enum: ['COD', 'PAYPAL'] },
    subtotal: { type: Number, min: 0 },
    discount: { type: Number, min: 0 },
    shippingFee: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0 },
    currency: { type: String, enum: ['VND'], default: 'VND' },
    shippingAddress: { type: mongoose.Schema.Types.Mixed },
    deliveredAt: Date,
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    items: {
      type: [itemSchema],
      required: true,
      validate: {
        validator(items) {
          return (
            items.length > 0 &&
            items.every(
              (item) => String(item.sellerId) === String(this.sellerId),
            )
          );
        },
        message: 'Order items must belong to the order seller',
      },
    },
  },
  { timestamps: true },
);

schema.index({ buyerId: 1, orderStatus: 1, createdAt: -1 });
schema.index({ buyerId: 1, createdAt: -1 });
schema.index(
  { checkoutGroupId: 1, sellerId: 1 },
  {
    unique: true,
    partialFilterExpression: { checkoutGroupId: { $type: 'objectId' } },
  },
);
schema.index({ buyerId: 1, sellerId: 1, orderStatus: 1 });
schema.index({ buyerId: 1, 'items.productId': 1, orderStatus: 1 });

export const Order = mongoose.model('Order', schema);
