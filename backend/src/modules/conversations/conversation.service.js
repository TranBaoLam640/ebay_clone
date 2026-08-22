import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { Product } from '../products/product.model.js';
import { INRRequest } from '../inr-requests/inr-request.model.js';
import { Replacement } from '../replacements/replacement.model.js';
import { SellerProfile } from '../sellers/seller-profile.model.js';
import { Shipment } from '../shipments/shipment.model.js';
import { Order } from '../orders/order.model.js';
import { User } from '../users/user.model.js';
import { emailService } from '../../common/services/email.service.js';
import { emitToConversation } from '../../socket/socket.js';
import { uploadMessageAttachment } from '../uploads/upload.service.js';
import * as repo from './conversation.repository.js';

const forbidden = () =>
  new AppError(403, ERROR_CODES.FORBIDDEN, 'Not conversation participant');

const idValue = (value) => value?._id ?? value;
const isId = (a, b) => String(idValue(a)) === String(idValue(b));

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
  stock: product?.stock ?? 0,
  listingType: product?.listingType ?? 'FIXED',
  offersEnabled: Boolean(product?.offersEnabled),
});

const usernameFromEmail = (email) => email?.split('@')[0] ?? null;

const sellerSummary = (seller) => ({
  id: String(seller?._id),
  displayName: seller?.displayName,
  username: usernameFromEmail(seller?.userId?.email),
  email: seller?.userId?.email ?? null,
  avatarUrl: seller?.avatarUrl ?? null,
  feedbackScore: seller?.feedbackCount ?? 0,
});

const buyerSummary = (buyer) => ({
  id: String(buyer?._id),
  displayName: buyer?.fullName ?? buyer?.email ?? 'Buyer',
  avatarUrl: buyer?.avatarUrl ?? null,
});

const userSummary = (user) => {
  if (!user) return null;
  return {
    id: String(user._id),
    displayName: user.fullName ?? usernameFromEmail(user.email) ?? 'User',
    username: usernameFromEmail(user.email),
    avatarUrl: user.avatarUrl ?? null,
  };
};

const toConversationView = (conversation, viewerId) => {
  const isBuyer = isId(conversation.buyerId, viewerId);
  return {
    id: String(conversation._id),
    type: conversation.type,
    status: conversation.status,
    role: isBuyer ? 'BUYER' : 'SELLER',
    product: productSummary(conversation.productId),
    buyer: buyerSummary(conversation.buyerId),
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

const replacementDisplayState = (replacement, request) => {
  if (request?.resolutionMode === 'REFUND') return 'REFUND_REQUESTED';
  if (replacement.status === 'ACCEPTED') return 'ACCEPTED';
  if (replacement.status === 'FULFILLING') return 'FULFILLING';
  return replacement.status;
};

const replacementActions = ({ replacement, request, role }) => {
  if (
    !role ||
    request?.resolutionMode !== 'REPLACEMENT' ||
    replacement.status !== 'PROPOSED' ||
    role === replacement.initiatorRole
  )
    return [];
  if (replacement.initiatorRole === 'SELLER' && role === 'BUYER')
    return ['ACCEPT', 'REFUND_INSTEAD'];
  if (replacement.initiatorRole === 'BUYER' && role === 'SELLER')
    return ['ACCEPT', 'DECLINE'];
  return [];
};

const toReplacementView = ({
  replacement,
  request,
  shipment,
  product,
  role,
}) => {
  if (!replacement) return null;
  return {
    id: String(replacement._id),
    inrRequestId: String(replacement.inrRequestId),
    status: replacement.status,
    displayState: replacementDisplayState(replacement, request),
    initiatorRole: replacement.initiatorRole,
    quantity: replacement.quantity,
    availableActions: replacementActions({ replacement, request, role }),
    product: {
      id: product?.uuid ?? (product?._id ? String(product._id) : null),
      title: product?.title ?? null,
      image: product?.images?.[0] ?? null,
    },
    shipment: shipment
      ? {
          status: shipment.status,
          estimatedDeliveryAt: shipment.estimatedDeliveryAt ?? null,
          pickedUpAt: shipment.pickedUpAt ?? null,
          deliveredAt: shipment.deliveredAt ?? null,
        }
      : null,
    createdAt: replacement.createdAt,
    updatedAt: replacement.updatedAt,
  };
};

const toMessageView = (message, offer, replacement) => ({
  id: String(message._id),
  conversationId: String(message.conversationId),
  senderId: String(idValue(message.senderId)),
  sender: userSummary(
    typeof message.senderId === 'object' && message.senderId?._id
      ? message.senderId
      : null,
  ),
  clientMessageId: message.clientMessageId ?? undefined,
  type: message.type,
  content: message.content ?? null,
  attachments: message.attachments,
  offer: toOfferView(offer ?? message.offerId),
  replacement: replacement ?? null,
  status: message.status,
  createdAt: message.createdAt,
});

const enrichMessageViews = async (rows, role) => {
  const replacementIds = [
    ...new Set(
      rows
        .map((message) => idValue(message.replacementId))
        .filter(Boolean)
        .map(String),
    ),
  ];
  if (replacementIds.length === 0)
    return rows.map((message) => toMessageView(message));

  const replacements = await Replacement.find({ _id: { $in: replacementIds } })
    .select(
      '_id inrRequestId productId quantity initiatorRole status createdAt updatedAt',
    )
    .lean();
  const requestIds = [
    ...new Set(replacements.map((item) => item.inrRequestId)),
  ];
  const productIds = [...new Set(replacements.map((item) => item.productId))];
  const [requests, products, shipments] = await Promise.all([
    INRRequest.find({ _id: { $in: requestIds } })
      .select('_id resolutionMode requestedResolution')
      .lean(),
    Product.find({ _id: { $in: productIds } })
      .select('_id uuid title images')
      .lean(),
    Shipment.find({
      replacementId: { $in: replacementIds },
      purpose: 'REPLACEMENT',
    })
      .select('replacementId status estimatedDeliveryAt pickedUpAt deliveredAt')
      .lean(),
  ]);
  const replacementMap = new Map(
    replacements.map((item) => [String(item._id), item]),
  );
  const requestMap = new Map(requests.map((item) => [String(item._id), item]));
  const productMap = new Map(products.map((item) => [String(item._id), item]));
  const shipmentMap = new Map(
    shipments.map((item) => [String(item.replacementId), item]),
  );

  return rows.map((message) => {
    const replacement = replacementMap.get(
      String(idValue(message.replacementId)),
    );
    return toMessageView(
      message,
      undefined,
      replacement
        ? toReplacementView({
            replacement,
            request: requestMap.get(String(replacement.inrRequestId)),
            shipment: shipmentMap.get(String(replacement._id)),
            product: productMap.get(String(replacement.productId)),
            role,
          })
        : null,
    );
  });
};

export const list = async (userId, query) => {
  const sellerProfiles = await SellerProfile.find({ userId })
    .select('_id')
    .lean();
  const conversations = await repo.listForUser(
    userId,
    sellerProfiles.map((seller) => seller._id),
    query,
  );
  const seen = new Set();
  return conversations
    .filter((conversation) => {
      const key = [
        idValue(conversation.buyerId),
        idValue(conversation.sellerId),
        idValue(conversation.productId),
      ].join(':');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((conversation) => toConversationView(conversation, userId));
};

export const createOrGet = async (userId, { productId, orderId }) => {
  const product = await Product.findOne({ uuid: productId })
    .select(
      '_id uuid title images price status stock listingType sellerId offersEnabled',
    )
    .lean();
  if (!product)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  if (isId(product.sellerId, userId))
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Cannot contact yourself',
    );

  const seller = await SellerProfile.findById(product.sellerId)
    .populate('userId', 'email fullName')
    .lean();
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

  const existing = await repo.findCanonical({
    buyerId: userId,
    sellerId: product.sellerId,
    productId: product._id,
  });
  if (existing) {
    if (order && (!existing.orderId || existing.type !== 'POST_PURCHASE')) {
      const upgraded = await repo.attachOrderContext(existing._id, order._id);
      return toConversationView(
        { ...upgraded, productId: product, sellerId: seller },
        userId,
      );
    }
    return toConversationView(
      { ...existing, productId: product, sellerId: seller },
      userId,
    );
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
  const sender = await User.findById(userId)
    .select('email fullName avatarUrl')
    .lean();
  const view = toMessageView({ ...message.toObject(), senderId: sender });
  emitToConversation(conversationId, 'message:new', view);
  emitToConversation(conversationId, 'conversation:updated', {
    id: String(conversationId),
    lastMessage: view,
  });
  if (input.sendCopyToEmail) {
    const [product, seller] = await Promise.all([
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
  const { role } = await assertParticipant(conversationId, userId);
  const rows = await repo.listMessages({ conversationId, ...query });
  return enrichMessageViews(rows.reverse(), role);
};

export const messageForUser = async (userId, message) => {
  const { role } = await assertParticipant(message.conversationId, userId);
  return (await enrichMessageViews([message], role))[0];
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
