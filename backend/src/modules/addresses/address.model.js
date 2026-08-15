import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientName: String,
    phone: String,
    addressLine: String,
    ward: String,
    district: String,
    province: String,
    country: String,
    postalCode: String,
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ userId: 1, createdAt: 1 });
schema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);
export const Address = mongoose.model('Address', schema);
