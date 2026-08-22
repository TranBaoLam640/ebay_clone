import mongoose from 'mongoose';
import {
  REPLACEMENT_ACTIVE_KEY,
  REPLACEMENT_ACTIVE_STATUSES,
  REPLACEMENT_INVENTORY_CLAIM_STATUSES,
  REPLACEMENT_INITIATOR_ROLES,
  REPLACEMENT_STATUSES,
} from './replacement.constants.js';

const terminalDetails = {
  reason: { type: String, trim: true, maxlength: 500 },
  note: { type: String, trim: true, maxlength: 1000 },
};

const schema = new mongoose.Schema(
  {
    inrRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'INRRequest',
      required: true,
      immutable: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      immutable: true,
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
      immutable: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
      immutable: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      immutable: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
      immutable: true,
    },
    initiatorRole: {
      type: String,
      enum: REPLACEMENT_INITIATOR_ROLES,
      required: true,
      immutable: true,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: REPLACEMENT_STATUSES,
      required: true,
      default: 'PROPOSED',
    },
    activeKey: {
      type: String,
      default: REPLACEMENT_ACTIVE_KEY,
    },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    declinedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    failedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: Date,
    declinedAt: Date,
    cancelledAt: Date,
    completedAt: Date,
    failedAt: Date,
    inventoryClaimStatus: {
      type: String,
      enum: REPLACEMENT_INVENTORY_CLAIM_STATUSES,
      required: true,
      default: 'UNCLAIMED',
    },
    inventoryClaimedAt: Date,
    inventoryReleasedAt: Date,
    decline: terminalDetails,
    cancellation: terminalDetails,
    failure: terminalDetails,
  },
  { timestamps: true },
);

schema.index({ inrRequestId: 1, createdAt: -1 });
schema.index({ orderId: 1, orderItemId: 1, createdAt: -1 });
schema.index({ buyerId: 1, status: 1, createdAt: -1 });
schema.index({ sellerId: 1, status: 1, createdAt: -1 });
schema.index(
  { inrRequestId: 1, orderItemId: 1, activeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activeKey: REPLACEMENT_ACTIVE_KEY },
  },
);

schema.pre('validate', function () {
  const isActive = REPLACEMENT_ACTIVE_STATUSES.includes(this.status);
  if (isActive) this.activeKey = REPLACEMENT_ACTIVE_KEY;
  else this.activeKey = undefined;

  if (
    ['PROPOSED', 'DECLINED'].includes(this.status) &&
    this.inventoryClaimStatus !== 'UNCLAIMED'
  )
    this.invalidate(
      'inventoryClaimStatus',
      'Unaccepted replacements cannot have claimed inventory',
    );
  if (this.status === 'ACCEPTED') {
    if (this.inventoryClaimStatus !== 'CLAIMED')
      this.invalidate(
        'inventoryClaimStatus',
        'Accepted replacements require claimed inventory',
      );
    if (!this.inventoryClaimedAt)
      this.invalidate(
        'inventoryClaimedAt',
        'Claimed inventory requires inventoryClaimedAt',
      );
    if (this.inventoryReleasedAt)
      this.invalidate(
        'inventoryReleasedAt',
        'Claimed inventory cannot be released',
      );
  }
  if (this.status === 'FULFILLING') {
    if (this.inventoryClaimStatus !== 'CONSUMED')
      this.invalidate(
        'inventoryClaimStatus',
        'Fulfilling replacements require consumed inventory',
      );
    if (!this.inventoryClaimedAt)
      this.invalidate(
        'inventoryClaimedAt',
        'Consumed inventory requires inventoryClaimedAt',
      );
    if (this.inventoryReleasedAt)
      this.invalidate(
        'inventoryReleasedAt',
        'Consumed inventory cannot be released',
      );
  }
  if (this.status === 'CANCELLED') {
    if (!['UNCLAIMED', 'RELEASED'].includes(this.inventoryClaimStatus))
      this.invalidate(
        'inventoryClaimStatus',
        'Cancelled replacements must have unclaimed or released inventory',
      );
    if (
      this.inventoryClaimStatus === 'RELEASED' &&
      (!this.inventoryClaimedAt || !this.inventoryReleasedAt)
    )
      this.invalidate(
        'inventoryReleasedAt',
        'Released inventory requires claim and release timestamps',
      );
    if (this.inventoryClaimStatus === 'UNCLAIMED' && this.inventoryReleasedAt)
      this.invalidate(
        'inventoryReleasedAt',
        'Unclaimed inventory cannot have inventoryReleasedAt',
      );
  }
  if (
    this.inventoryClaimStatus === 'UNCLAIMED' &&
    (this.inventoryClaimedAt || this.inventoryReleasedAt)
  )
    this.invalidate(
      'inventoryClaimStatus',
      'Unclaimed inventory cannot have inventory timestamps',
    );

  if (this.status === 'ACCEPTED' && !this.acceptedAt)
    this.invalidate('acceptedAt', 'Accepted replacements require acceptedAt');
  if (this.status === 'DECLINED' && !this.declinedAt)
    this.invalidate('declinedAt', 'Declined replacements require declinedAt');
  if (this.status !== 'DECLINED' && (this.declinedAt || this.declinedBy))
    this.invalidate(
      'declinedAt',
      'Only declined replacements can have decline details',
    );
  if (this.status === 'CANCELLED' && !this.cancelledAt)
    this.invalidate(
      'cancelledAt',
      'Cancelled replacements require cancelledAt',
    );
  if (this.status !== 'CANCELLED' && (this.cancelledAt || this.cancelledBy))
    this.invalidate(
      'cancelledAt',
      'Only cancelled replacements can have cancellation details',
    );
  if (this.status === 'COMPLETED' && !this.completedAt)
    this.invalidate(
      'completedAt',
      'Completed replacements require completedAt',
    );
  if (this.status !== 'COMPLETED' && this.completedAt)
    this.invalidate(
      'completedAt',
      'Only completed replacements can have completedAt',
    );
  if (this.status === 'FAILED' && !this.failedAt)
    this.invalidate('failedAt', 'Failed replacements require failedAt');
  if (this.status !== 'FAILED' && (this.failedAt || this.failedBy))
    this.invalidate(
      'failedAt',
      'Only failed replacements can have failure details',
    );
});

export const Replacement = mongoose.model('Replacement', schema);
