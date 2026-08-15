import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkoutGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CheckoutGroup',
      required: true,
    },
    method: { type: String, enum: ['COD', 'PAYPAL'], required: true },
    status: {
      type: String,
      enum: [
        'PENDING',
        'PROVIDER_CREATING',
        'CREATED',
        'PROVIDER_CAPTURING',
        'CONFIRMED',
        'CAPTURED',
        'FAILED',
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    currency: { type: String, enum: ['VND'], default: 'VND' },
    providerOrderId: String,
    providerCreateClaimToken: String,
    providerCreateClaimedAt: Date,
    providerCaptureClaimToken: String,
    providerCaptureClaimedAt: Date,
    providerCreateOutcome: String,
    providerCaptureOutcome: String,
    failureReason: String,
    capturedAt: Date,
    confirmedAt: Date,
    failedAt: Date,
    restorationStatus: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'COMPLETED'],
      required: true,
      default: 'NOT_REQUIRED',
    },
    restoredAt: Date,
  },
  { timestamps: true },
);

schema.pre('validate', function () {
  if (
    this.method === 'PAYPAL' &&
    ['CREATED', 'CAPTURED', 'FAILED'].includes(this.status) &&
    !this.providerOrderId
  )
    this.invalidate(
      'providerOrderId',
      'Created PayPal payments require a provider order ID',
    );
  if (this.method === 'COD' && this.providerOrderId)
    this.invalidate(
      'providerOrderId',
      'COD payments cannot have a provider order ID',
    );
});

schema.index({ checkoutGroupId: 1 }, { unique: true });
schema.index({ buyerId: 1, createdAt: -1 });
schema.index({ providerOrderId: 1 }, { unique: true, sparse: true });

export const Payment = mongoose.model('Payment', schema);
