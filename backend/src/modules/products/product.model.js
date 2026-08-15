import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const normalizeAttributeName = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

const isUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator(value) {
          return (
            (this.dataType === 'string' && typeof value === 'string') ||
            (this.dataType === 'number' &&
              typeof value === 'number' &&
              Number.isFinite(value)) ||
            (this.dataType === 'boolean' && typeof value === 'boolean') ||
            (this.dataType === 'date' &&
              value instanceof Date &&
              !Number.isNaN(value.valueOf()))
          );
        },
        message: 'Attribute value must match its declared dataType',
      },
    },
    dataType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date'],
      required: true,
    },
    unit: { type: String, trim: true },
  },
  { _id: false },
);

attributeSchema.pre('validate', function () {
  if (this.name) this.normalizedName = normalizeAttributeName(this.name);
  if (this.dataType === 'date' && typeof this.value === 'string') {
    const value = new Date(this.value);
    if (!Number.isNaN(value.valueOf())) this.value = value;
  }
});

// Embedded auction state for AUCTION listings. All mutation goes through a
// single-document compare-and-swap on `version` (see auction.repository), so
// concurrent bids serialize and the state stays consistent without transactions.
const auctionSchema = new mongoose.Schema(
  {
    // Where bidding begins; also the initial displayed `currentBid`.
    startPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    // Seller's secret floor. Amount is never exposed — only the `reserveMet`
    // boolean. Absent means no reserve.
    reservePrice: { type: Number, min: 0, validate: Number.isInteger },
    // Optional instant-buy price. Offered until the first bid — or, on a reserve
    // listing, until a bid meets the reserve (proxy-engine.isBuyNowAvailable).
    buyNowPrice: { type: Number, min: 0, validate: Number.isInteger },
    // Publicly displayed price — what the item would sell for right now.
    currentBid: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    // Hidden proxy ceiling of the current leader (never exposed while leading).
    leaderMaxBid: { type: Number, min: 0, validate: Number.isInteger },
    currentBidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bidCount: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'OPEN', 'CLOSED'],
      default: 'OPEN',
      required: true,
    },
    // Optimistic-concurrency token: every committing write matches on the read
    // value and $inc's it, so exactly one racer wins each round.
    version: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },
    reserveMet: { type: Boolean, default: false },
    // Set once at close.
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalPrice: { type: Number, min: 0, validate: Number.isInteger },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    // Public, stable identifier exposed to the API/frontend (URLs, refs echoed
    // to clients). Internal foreign keys still use `_id` (ObjectId).
    uuid: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => randomUUID(),
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerProfile',
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0, validate: Number.isInteger },
    stock: {
      type: Number,
      required: true,
      min: 0,
      validate: [
        { validator: Number.isInteger, message: 'Stock must be an integer' },
        {
          validator(value) {
            return this.status !== 'OUT_OF_STOCK' || value === 0;
          },
          message: 'OUT_OF_STOCK products must have zero stock',
        },
      ],
    },
    images: {
      type: [{ type: String, trim: true, validate: isUrl }],
      default: [],
    },
    attributes: {
      type: [attributeSchema],
      default: [],
      validate: {
        validator: (items) =>
          new Set(items.map((item) => item.normalizedName)).size ===
          items.length,
        message: 'Attribute normalized names must be unique',
      },
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'HIDDEN', 'DELETED'],
      default: 'DRAFT',
    },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0,
    },
    // FIXED (normal add-to-cart) or AUCTION (sells to the highest bidder).
    listingType: {
      type: String,
      enum: ['FIXED', 'AUCTION'],
      default: 'FIXED',
    },
    // Best Offer opt-in for FIXED listings (buyer may propose a price).
    offersEnabled: { type: Boolean, default: false },
    // Present only for AUCTION listings.
    auction: { type: auctionSchema },
  },
  { timestamps: true },
);

schema.pre('validate', function () {
  if (this.status === 'OUT_OF_STOCK') this.stock = 0;
  if (this.listingType === 'AUCTION' && !this.auction)
    this.invalidate('auction', 'AUCTION listings require auction state');
});

schema.index({ status: 1, categoryId: 1, price: 1 });
schema.index({ status: 1, sellerId: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ title: 'text', description: 'text' });
// Sweep: efficiently find OPEN auctions whose end time has passed.
schema.index({ listingType: 1, 'auction.status': 1, 'auction.endsAt': 1 });

export const Product = mongoose.model('Product', schema);
