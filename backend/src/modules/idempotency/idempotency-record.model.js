import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    scope: { type: String, required: true, trim: true },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    key: { type: String, required: true, trim: true, maxlength: 200 },
    requestHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    status: {
      type: String,
      enum: ['PROCESSING', 'COMPLETED', 'FAILED'],
      required: true,
      default: 'PROCESSING',
    },
    claimToken: { type: String, required: true },
    attempts: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: Number.isInteger,
    },
    startedAt: { type: Date, required: true },
    lastAttemptAt: { type: Date, required: true },
    completedAt: Date,
    failedAt: Date,
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    responseStatus: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    errorCode: String,
    errorMessage: String,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

schema.index({ scope: 1, ownerId: 1, key: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ status: 1, lastAttemptAt: 1 });

export const IdempotencyRecord = mongoose.model('IdempotencyRecord', schema);
