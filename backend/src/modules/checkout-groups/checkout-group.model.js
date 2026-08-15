import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    ],
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    paymentMethod: { type: String, enum: ['COD', 'PAYPAL'], required: true },
    status: {
      type: String,
      enum: ['CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'],
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['VND'], default: 'VND' },
    // True when this group wraps a single auction / Buy-It-Now win order (paid
    // via the order-checkout flow, not the cart). Win orders reserve no cart
    // stock and are a legal obligation to buy, so a failed capture must skip
    // stock restoration and leave the order re-payable rather than stranded.
    auctionWin: { type: Boolean, default: false },
    stockRestoredAt: Date,
    couponRestoredAt: Date,
  },
  { timestamps: true },
);
schema.index({ buyerId: 1, createdAt: -1 });
export const CheckoutGroup = mongoose.model('CheckoutGroup', schema);
