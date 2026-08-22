import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    fileName: { type: String, trim: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, min: 0 },
    type: { type: String, enum: ['IMAGE', 'FILE'] },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientMessageId: { type: String, trim: true },
    type: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE', 'OFFER', 'REPLACEMENT', 'SYSTEM'],
      required: true,
    },
    content: { type: String, trim: true, maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    replacementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Replacement' },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'READ'],
      default: 'SENT',
      required: true,
    },
  },
  { timestamps: true },
);

schema.index({ conversationId: 1, createdAt: -1, _id: -1 });
schema.index({ offerId: 1 });
schema.index(
  { replacementId: 1 },
  {
    unique: true,
    partialFilterExpression: { replacementId: { $exists: true } },
  },
);
schema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } },
  },
);

export const Message = mongoose.model('Message', schema);
