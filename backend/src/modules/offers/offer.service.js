import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as productRepository from '../products/product.repository.js';
import * as offerRepository from './offer.repository.js';
import * as conversationService from '../conversations/conversation.service.js';
import * as conversationRepository from '../conversations/conversation.repository.js';
import { Product } from '../products/product.model.js';
import { SellerProfile } from '../sellers/seller-profile.model.js';
import { emitToConversation } from '../../socket/socket.js';

// Best Offer, buyer half: a buyer proposes a price on an offers-enabled FIXED
// listing, sees it in My Offers, and can withdraw it while pending. The seller
// Accept/Decline/Counter side is out of scope (needs a seller actor).

const OFFER_TTL_MS = 48 * 60 * 60 * 1000;

// Resolve a public product uuid → internal ObjectId, or throw 404.
const resolveProductId = async (productUuid) => {
  const productId = await productRepository.resolveIdByUuid(productUuid);
  if (!productId)
    throw new AppError(404, ERROR_CODES.AUCTION_NOT_FOUND, 'Product not found');
  return productId;
};

const toOfferView = (offer, product) => ({
  id: String(offer._id),
  productUuid: product?.uuid ?? null,
  productTitle: product?.title ?? null,
  productImage: product?.images?.[0] ?? null,
  amount: offer.amount,
  quantity: offer.quantity,
  message: offer.message ?? null,
  status: offer.status,
  expiresAt: offer.expiresAt,
  createdAt: offer.createdAt,
});

export const createOffer = async ({
  productUuid,
  buyerId,
  amount,
  quantity = 1,
  message,
}) => {
  const productId = await resolveProductId(productUuid);
  const product = await productRepository.findOfferable(productId);
  if (!product)
    throw new AppError(404, ERROR_CODES.AUCTION_NOT_FOUND, 'Product not found');
  if (product.listingType !== 'FIXED' || !product.offersEnabled)
    throw new AppError(
      409,
      ERROR_CODES.OFFERS_NOT_ENABLED,
      'This listing does not accept offers',
    );
  const offer = await offerRepository.create({
    productId,
    buyerId,
    amount,
    quantity,
    message,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + OFFER_TTL_MS),
  });
  return toOfferView(offer, product);
};

export const withdrawOffer = async (buyerId, offerId) => {
  const offer = await offerRepository.withdrawIfPending(buyerId, offerId);
  if (!offer)
    throw new AppError(
      404,
      ERROR_CODES.OFFER_NOT_FOUND,
      'No pending offer to withdraw',
    );
  return { id: String(offer._id), status: offer.status };
};

export const listMyOffers = async (buyerId) => {
  const offers = await offerRepository.listByBuyer(buyerId);
  const productMap = await productRepository.findPublicByIds(
    offers.map((o) => o.productId),
  );
  return offers.map((offer) =>
    toOfferView(offer, productMap.get(String(offer.productId))),
  );
};

const offerView = (offer) => ({
  id: String(offer._id),
  conversationId: offer.conversationId ? String(offer.conversationId) : null,
  productId: String(offer.productId),
  buyerId: String(offer.buyerId),
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
});

const assertOfferActor = async (offer, userId) => {
  const { conversation, role } = await conversationService.assertParticipant(
    offer.conversationId,
    userId,
  );
  if (String(offer.createdBy) === String(userId))
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Offer creator cannot resolve their own offer',
    );
  return { conversation, role };
};

const createOfferMessage = async ({ conversation, offer, userId, session }) => {
  const [message] = await conversationRepository.addMessage(
    {
      conversationId: conversation._id,
      senderId: userId,
      type: 'OFFER',
      offerId: offer._id,
      content: null,
      status: 'SENT',
    },
    session,
  );
  const senderRole =
    String(conversation.buyerId) === String(userId) ? 'BUYER' : 'SELLER';
  await conversationRepository.updateAfterMessage(
    conversation,
    message,
    senderRole === 'BUYER' ? 'SELLER' : 'BUYER',
    session,
  );
  return message;
};

export const createConversationOffer = async ({
  conversationId,
  userId,
  price,
  message,
}) => {
  const { conversation, role } = await conversationService.assertParticipant(
    conversationId,
    userId,
  );
  if (conversation.type !== 'PRE_PURCHASE')
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Offers are not allowed after purchase',
    );
  const product = await Product.findById(conversation.productId).lean();
  if (
    !product ||
    product.status !== 'ACTIVE' ||
    product.stock <= 0 ||
    product.listingType !== 'FIXED' ||
    !product.offersEnabled
  )
    throw new AppError(
      409,
      ERROR_CODES.OFFERS_NOT_ENABLED,
      'This listing does not accept offers',
    );
  if (role === 'SELLER') {
    const seller = await SellerProfile.findById(conversation.sellerId)
      .select('userId')
      .lean();
    if (!seller || String(seller.userId) !== String(userId))
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Not listing seller');
  }
  const [offer, offerMessage] = await conversationRepository.transaction(
    async (session) => {
      const [created] = await offerRepository.createWithSession(
        {
          conversationId,
          productId: conversation.productId,
          buyerId: conversation.buyerId,
          sellerId: conversation.sellerId,
          createdBy: userId,
          originalPrice: product.price,
          amount: price,
          quantity: 1,
          message,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + OFFER_TTL_MS),
        },
        session,
      );
      const savedMessage = await createOfferMessage({
        conversation,
        offer: created,
        userId,
        session,
      });
      return [created, savedMessage];
    },
  );
  const payload = offerView(offer);
  emitToConversation(conversationId, 'offer:new', payload);
  emitToConversation(conversationId, 'message:new', {
    id: String(offerMessage._id),
    conversationId,
    senderId: String(userId),
    type: 'OFFER',
    offer: payload,
    status: offerMessage.status,
    createdAt: offerMessage.createdAt,
  });
  return payload;
};

export const resolveOffer = async (userId, offerId, status) => {
  const offer = await offerRepository.findById(offerId);
  if (!offer)
    throw new AppError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  await assertOfferActor(offer, userId);
  const updated = await offerRepository.updatePendingStatus(offerId, status);
  if (!updated)
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Offer already resolved or expired',
    );
  const payload = offerView(updated);
  emitToConversation(updated.conversationId, 'offer:updated', payload);
  return payload;
};

export const counterOffer = async ({ userId, offerId, price, message }) => {
  const parent = await offerRepository.findById(offerId);
  if (!parent)
    throw new AppError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  const { conversation } = await assertOfferActor(parent, userId);
  if (conversation.type !== 'PRE_PURCHASE')
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Offers are not allowed after purchase',
    );
  const [counter, offerMessage] = await conversationRepository.transaction(
    async (session) => {
      const updatedParent = await offerRepository.updatePendingStatus(
        offerId,
        'COUNTERED',
        session,
      );
      if (!updatedParent)
        throw new AppError(
          409,
          ERROR_CODES.CONFLICT,
          'Offer already resolved or expired',
        );
      const [created] = await offerRepository.createWithSession(
        {
          conversationId: parent.conversationId,
          productId: parent.productId,
          buyerId: parent.buyerId,
          sellerId: parent.sellerId,
          createdBy: userId,
          originalPrice: parent.originalPrice,
          amount: price,
          quantity: parent.quantity,
          message,
          status: 'PENDING',
          parentOfferId: parent._id,
          expiresAt: new Date(Date.now() + OFFER_TTL_MS),
        },
        session,
      );
      const savedMessage = await createOfferMessage({
        conversation,
        offer: created,
        userId,
        session,
      });
      return [created, savedMessage];
    },
  );
  emitToConversation(parent.conversationId, 'offer:updated', {
    ...offerView(parent),
    status: 'COUNTERED',
  });
  const payload = offerView(counter);
  emitToConversation(parent.conversationId, 'offer:new', payload);
  emitToConversation(parent.conversationId, 'message:new', {
    id: String(offerMessage._id),
    conversationId: String(parent.conversationId),
    senderId: String(userId),
    type: 'OFFER',
    offer: payload,
    status: offerMessage.status,
    createdAt: offerMessage.createdAt,
  });
  return payload;
};
