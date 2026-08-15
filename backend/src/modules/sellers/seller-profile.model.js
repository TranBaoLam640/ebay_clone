import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: '' },
    averageFeedbackRating: { type: Number, min: 0, max: 5, default: 0 },
    feedbackCount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  { timestamps: true },
);

schema.index({ userId: 1 }, { unique: true });
schema.index({ status: 1, averageFeedbackRating: -1 });

export const SellerProfile = mongoose.model('SellerProfile', schema);
