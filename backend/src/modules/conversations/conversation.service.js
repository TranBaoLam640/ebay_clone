import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { Product } from '../products/product.model.js';
import { SellerProfile } from '../sellers/seller-profile.model.js';
import { Order } from '../orders/order.model.js';
import { User } from '../users/user.model.js';
import { emailService } from '../../common/services/email.service.js';
import { emitToConversation } from '../../socket/socket.js';
import { uploadMessageAttachment } from '../uploads/upload.service.js';
import * as repo from './conversation.repository.js';

const forbidden = () =>
  new AppError(403, ERROR_CODES.FORBIDDEN, 'Not conversation participant');

const isId = (a, b) => String(a) === String(b);

const roleFor = async (conversation, userId) => {
  if (isId(conversation.buyerId, userId)) return 'BUYER';
  const seller = await SellerProfile.findById(conversation.sellerId)
    .select('userId')
    .lean();
  if (seller && isId(seller.userId, userId)) return 'SELLER';
  return null;
};

export const assertParticipant = async (conversationId, userId) => {
  const conversation = await repo.findById(conversationId);
  if (!conversation)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Conversation not found');
  const role = await roleFor(conversation, userId);
  if (!role) throw forbidden();
  return { conversation, role };
};

const productSummary = (product) => ({
  id: product?.uuid,
  title: product?.title,
  image: product?.images?.[0] ?? null,
  price: product?.price,
  status: product?.status,
  offersEnabled: Boolean(product?.offersEnabled),
});

const sellerSummary = (seller) => ({
  id: String(seller?._id),
  displayName: seller?.displayName,
  avatarUrl: seller?.avatarUrl ?? null,
  feedbackScore: seller?.feedbackCount ?? 0,
});

const toConversationView = (conversation, viewerId) => {
  const isBuyer = isId(conversation.buyerId, viewerId);
  return {
    id: String(conversation._id),
    type: conversation.type,
    status: conversation.status,
    role: isBuyer ? 'BUYER' : 'SELLER',
    product: productSummary(conversation.productId),
    seller: sellerSummary(conversation.sellerId),
    orderId: conversation.orderId ? String(conversation.orderId) : null,
    lastMessage: conversation.lastMessageId
      ? {
          id: String(conversation.lastMessageId._id),
          type: conversation.lastMessageId.type,
          content: conversation.lastMessageId.content ?? null,
          status: conversation.lastMessageId.status,
          createdAt: conversation.lastMessageId.createdAt,
        }
      : null,
    unreadCount: isBuyer
      ? conversation.buyerUnreadCount
      : conversation.sellerUnreadCount,
    lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
    createdAt: conversation.createdAt,
  };
};

const toOfferView = (offer) => {
  if (!offer) return null;
  return {
    id: String(offer._id),
    conversationId: offer.conversationId ? String(offer.conversationId) : null,
    productId: offer.productId ? String(offer.productId) : null,
    buyerId: offer.buyerId ? String(offer.buyerId) : null,
    sellerId: offer.sellerId ? String(offer.sellerId) : null,
    createdBy: offer.createdBy ? String(offer.createdBy) : null,
    originalPrice: offer.originalPrice,
    offerPrice: offer.amount,
    amount: offer.amount,
    quantity: offer.quantity,
    status: offer.status,
    parentOfferId: offer.parentOfferId ? String(offer.parentOfferId) : null,
    orderId: offer.orderId ? String(offer.orderId) : null,
    usedAt: offer.usedAt ?? null,
    expiresAt: offer.expiresAt,
    createdAt: offer.createdAt,
  };
};

const toMessageView = (message, offer) => ({
  id: String(message._id),
  conversationId: String(message.conversationId),
  senderId: String(message.senderId),
  clientMessageId: message.clientMessageId ?? undefined,
  type: message.type,
  content: message.content ?? null,
  attachments: message.attachments,
  offer: toOfferView(offer ?? message.offerId),
  status: message.status,
  createdAt: message.createdAt,
});

export const list = async (userId, query) => {
  const sellerProfiles = await SellerProfile.find({ userId })
    .select('_id')
    .lean();
  const conversations = await repo.listForUser(
    userId,
    sellerProfiles.map((seller) => seller._id),
    query,
  );
  return conversations.map((conversation) =>
    toConversationView(conversation, userId),
  );
};

export const createOrGet = async (userId, { productId, orderId }) => {
  const product = await Product.findOne({ uuid: productId })
    .select('_id uuid title images price status stock sellerId offersEnabled')
    .lean();
  if (!product)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  if (isId(product.sellerId, userId))
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Cannot contact yourself',
    );

  const seller = await SellerProfile.findById(product.sellerId).lean();
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');
  if (isId(seller.userId, userId))
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Cannot contact yourself',
    );

  let type = 'PRE_PURCHASE';
  let order = null;
  if (orderId) {
    order = await Order.findOne({
      _id: orderId,
      buyerId: userId,
      sellerId: product.sellerId,
      'items.productId': product._id,
    }).lean();
    if (!order)
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
    type = 'POST_PURCHASE';
  }

  const existing = await repo.findExisting({
    buyerId: userId,
    sellerId: product.sellerId,
    productId: product._id,
    orderId,
    type,
  });
  if (existing)
    return toConversationView(
      { ...existing, productId: product, sellerId: seller },
      userId,
    );

  if (type === 'POST_PURCHASE') {
    const prePurchase = await repo.findPrePurchase({
      buyerId: userId,
      sellerId: product.sellerId,
      productId: product._id,
    });
    if (prePurchase) {
      const upgraded = await repo.attachOrderContext(
        prePurchase._id,
        order._id,
      );
      return toConversationView(
        { ...upgraded, productId: product, sellerId: seller },
        userId,
      );
    }
  }

  const [created] = await repo.create({
    buyerId: userId,
    sellerId: product.sellerId,
    productId: product._id,
    orderId: order?._id,
    type,
    lastMessageAt: new Date(),
  });
  return toConversationView(
    { ...created.toObject(), productId: product, sellerId: seller },
    userId,
  );
};

const validateMessage = ({ type, content, attachments }) => {
  if (type === 'TEXT' && !content && attachments.length === 0)
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Message is empty');
  if ((type === 'IMAGE' || type === 'FILE') && attachments.length === 0)
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Attachment is required',
    );
  if (
    attachments.some((file) =>
      /\.(exe|sh|bat|cmd|js)$/i.test(file.fileName || ''),
    )
  )
    throw new AppError(
      400,
      ERROR_CODES.UPLOAD_INVALID_TYPE,
      'Unsupported attachment type',
    );
};

export const uploadAttachments = async (userId, conversationId, files = []) => {
  await assertParticipant(conversationId, userId);
  if (files.length === 0)
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'No file was uploaded',
    );
  if (files.length > 5)
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Too many attachments',
    );
  return Promise.all(files.map((file) => uploadMessageAttachment(file)));
};

export const sendMessage = async (userId, conversationId, input) => {
  const { conversation, role } = await assertParticipant(
    conversationId,
    userId,
  );
  validateMessage(input);
  if (input.clientMessageId) {
    const existing = await repo.findByClientMessageId({
      conversationId,
      senderId: userId,
      clientMessageId: input.clientMessageId,
    });
    if (existing) return toMessageView(existing);
  }
  const [message] = await repo.addMessage({
    conversationId,
    senderId: userId,
    clientMessageId: input.clientMessageId,
    type: input.type,
    content: input.content,
    attachments: input.attachments,
    status: 'SENT',
  });
  await repo.updateAfterMessage(
    conversation,
    message,
    role === 'BUYER' ? 'SELLER' : 'BUYER',
  );
  const view = toMessageView(message);
  emitToConversation(conversationId, 'message:new', view);
  emitToConversation(conversationId, 'conversation:updated', {
    id: String(conversationId),
    lastMessage: view,
  });
  if (input.sendCopyToEmail) {
    const [sender, product, seller] = await Promise.all([
      User.findById(userId).select('email fullName').lean(),
      Product.findById(conversation.productId).select('title').lean(),
      SellerProfile.findById(conversation.sellerId)
        .select('displayName userId')
        .lean(),
    ]);
    const recipientName = role === 'BUYER' ? seller?.displayName : 'Buyer';
    await emailService.sendMessageCopy({
      to: sender.email,
      listingTitle: product?.title || 'listing',
      recipientName,
      content: message.content || '',
      sentAt: message.createdAt,
      attachments: message.attachments,
    });
  }
  return view;
};

export const messages = async (userId, conversationId, query) => {
  await assertParticipant(conversationId, userId);
  const rows = await repo.listMessages({ conversationId, ...query });
  return rows.reverse().map((message) => toMessageView(message));
};

export const markRead = async (userId, conversationId) => {
  const { conversation, role } = await assertParticipant(
    conversationId,
    userId,
  );
  await repo.markRead(conversation, role, userId);
  emitToConversation(conversationId, 'message:read', {
    conversationId: String(conversationId),
    readerId: String(userId),
  });
  return { id: String(conversationId), unreadCount: 0 };
};

export const archive = async (userId, conversationId) => {
  await assertParticipant(conversationId, userId);
  const conversation = await repo.archive(conversationId);
  return { id: String(conversation._id), status: conversation.status };
};
