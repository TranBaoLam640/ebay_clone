import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    otpHash: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, min: 1 },
    lastSentAt: { type: Date, required: true },
    usedAt: Date,
    invalidatedAt: Date,
  },
  { timestamps: true, collection: 'emailverificationtokens' },
);
schema.index({ userId: 1, createdAt: -1 });
export const EmailVerificationToken = mongoose.model(
  'EmailVerificationToken',
  schema,
);
