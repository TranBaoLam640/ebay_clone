import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../../common/constants/notification-types.js';
const schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    referenceType: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    eventType: String,
    eventKey: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true },
);
schema.index({ userId: 1, createdAt: -1 });
schema.index({ userId: 1, isRead: 1, createdAt: -1 });
schema.index(
  { userId: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } } },
);
export const Notification = mongoose.model('Notification', schema);
