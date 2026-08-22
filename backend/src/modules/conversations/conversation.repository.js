import mongoose from 'mongoose';
import { Conversation } from './conversation.model.js';
import { Message } from './message.model.js';

export const transaction = (fn) => mongoose.connection.transaction(fn);

export const findById = (id, session) =>
  Conversation.findById(id)
    .session(session || null)
    .lean();

export const findExisting = ({ buyerId, sellerId, productId, orderId, type }) =>
  Conversation.findOne({
    buyerId,
    sellerId,
    productId,
    type,
    ...(type === 'POST_PURCHASE' ? { orderId } : {}),
  }).lean();

export const findCanonical = ({ buyerId, sellerId, productId }, session) =>
  Conversation.findOne({
    buyerId,
    sellerId,
    productId,
  })
    .sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 })
    .session(session || null)
    .lean();

export const attachOrderContext = (conversationId, orderId, session) =>
  Conversation.findByIdAndUpdate(
    conversationId,
    { $set: { orderId, type: 'POST_PURCHASE' } },
    { returnDocument: 'after', session },
  ).lean();

export const create = (data, session) =>
  Conversation.create([data], { session });

export const listForUser = (userId, sellerIds, { limit, before }) => {
  const filter = {
    $or: [{ buyerId: userId }, { sellerId: { $in: sellerIds } }],
  };
  if (before) filter.lastMessageAt = { $lt: before };
  return Conversation.find(filter)
    .sort({ lastMessageAt: -1, updatedAt: -1, _id: -1 })
    .limit(limit)
    .populate('buyerId', 'fullName avatarUrl email')
    .populate(
      'productId',
      'uuid title images price status stock listingType offersEnabled',
    )
    .populate({
      path: 'sellerId',
      select:
        'displayName avatarUrl averageFeedbackRating feedbackCount userId',
      populate: { path: 'userId', select: 'email fullName' },
    })
    .populate('lastMessageId', 'type content offerId status createdAt')
    .lean();
};

export const addMessage = (data, session) =>
  Message.create([data], { session });

export const findMessageByReplacementId = (replacementId, session) =>
  Message.findOne({ replacementId })
    .populate('senderId', 'email fullName avatarUrl')
    .session(session || null)
    .lean();

export const findByClientMessageId = ({
  conversationId,
  senderId,
  clientMessageId,
}) =>
  Message.findOne({ conversationId, senderId, clientMessageId })
    .populate('senderId', 'email fullName avatarUrl')
    .lean();

export const updateAfterMessage = (
  conversation,
  message,
  receiverRole,
  session,
) =>
  Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: { lastMessageId: message._id, lastMessageAt: message.createdAt },
      $inc:
        receiverRole === 'BUYER'
          ? { buyerUnreadCount: 1 }
          : { sellerUnreadCount: 1 },
    },
    { returnDocument: 'after', session },
  ).lean();

export const listMessages = ({ conversationId, limit, before }) => {
  const filter = { conversationId };
  if (before) filter._id = { $lt: before };
  return Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .populate('senderId', 'email fullName avatarUrl')
    .populate('offerId')
    .populate('replacementId')
    .lean();
};

export const markRead = async (conversation, role, readerUserId, session) => {
  const field = role === 'BUYER' ? 'buyerUnreadCount' : 'sellerUnreadCount';
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { [field]: 0 } },
    { session },
  );
  await Message.updateMany(
    { conversationId: conversation._id, senderId: { $ne: readerUserId } },
    { $set: { status: 'READ' } },
    { session },
  );
  return Conversation.findById(conversation._id).session(session).lean();
};

export const archive = (conversationId, session) =>
  Conversation.findByIdAndUpdate(
    conversationId,
    { status: 'ARCHIVED' },
    { returnDocument: 'after', session },
  ).lean();
