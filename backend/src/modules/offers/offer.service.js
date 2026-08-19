import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as productRepository from '../products/product.repository.js';
import * as offerRepository from './offer.repository.js';
import * as conversationService from '../conversations/conversation.service.js';
import * as conversationRepository from '../conversations/conversation.repository.js';
import { Product } from '../products/product.model.js';
import { SellerProfile } from '../sellers/seller-profile.model.js';
import { User } from '../users/user.model.js';
import { emitToConversation } from '../../socket/socket.js';

// Best Offer, buyer half: a buyer proposes a price on an offers-enabled FIXED
// listing, sees it in My Offers, and can withdraw it while pending. The seller
// Accept/Decline/Counter side is out of scope (needs a seller actor).

const OFFER_TTL_MS = 48 * 60 * 60 * 1000;
const invalidOffer = (message) =>
  new AppError(409, ERROR_CODES.CONFLICT, message);
const isDuplicateKey = (error) => error?.code === 11000;

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

const assertQuantityAvailable = (quantity, stock) => {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock)
    throw invalidOffer('Offer quantity must be between 1 and available stock');
};

const assertInitialOfferPrice = (amount, listingPrice) => {
  if (!(amount > 0 && amount < listingPrice))
    throw invalidOffer('Offer price must be lower than the listing price');
};

const assertNoActiveConversationOffer = async (conversationId, session) => {
  const active = await offerRepository.findBlockingByConversation(
    conversationId,
    session,
  );
  if (active?.status === 'ACCEPTED')
    throw invalidOffer(
      'Complete checkout for the accepted offer before making another offer',
    );
  if (active)
    throw invalidOffer(
      'Wait for the current offer to be resolved before making another offer',
    );
};

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
  assertQuantityAvailable(quantity, product.stock ?? 0);
  assertInitialOfferPrice(amount, product.price);
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

const loadOfferChain = async (offer) => {
  const chain = [offer];
  let current = offer;
  while (current.parentOfferId) {
    current = await offerRepository.findById(current.parentOfferId);
    if (!current) break;
    chain.unshift(current);
  }
  return chain;
};

const previousOfferByCreator = (chain, userId) =>
  [...chain]
    .reverse()
    .find((item) => String(item.createdBy) === String(userId));

const firstOffer = (chain) => chain[0] ?? null;

const validateCounterTerms = async ({ parent, userId, price, quantity }) => {
  const product = await Product.findById(parent.productId).lean();
  if (
    !product ||
    product.status !== 'ACTIVE' ||
    product.stock <= 0 ||
    product.listingType !== 'FIXED' ||
    !product.offersEnabled
  )
    throw invalidOffer('This listing does not accept offers');
  const nextQuantity = quantity ?? parent.quantity;
  assertQuantityAvailable(nextQuantity, product.stock);
  const chain = await loadOfferChain(parent);
  const previousOwn = previousOfferByCreator(chain.slice(0, -1), userId);
  const root = firstOffer(chain);
  const isSeller = String(parent.buyerId) !== String(userId);
  if (isSeller) {
    if (nextQuantity > parent.quantity)
      throw invalidOffer(
        'Seller counter quantity cannot exceed the buyer requested quantity',
      );
    const upper = previousOwn?.amount ?? parent.originalPrice ?? product.price;
    if (!(price > parent.amount && price < upper))
      throw invalidOffer(
        "Counteroffer must be higher than the buyer's current offer and lower than the seller's current asking amount",
      );
  } else {
    const maxQuantity = Math.min(
      root?.quantity ?? parent.quantity,
      product.stock,
    );
    if (nextQuantity > maxQuantity)
      throw invalidOffer(
        'Buyer counter quantity cannot exceed the original requested quantity',
      );
    const lower = previousOwn?.amount ?? 0;
    if (!(price > lower && price < parent.amount))
      throw invalidOffer(
        "Counteroffer must be higher than the buyer's previous offer and lower than the seller's current counteroffer",
      );
  }
  return { quantity: nextQuantity, product };
};

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

const usernameFromEmail = (email) => email?.split('@')[0] ?? null;

const senderView = async (userId) => {
  const user = await User.findById(userId)
    .select('email fullName avatarUrl')
    .lean();
  if (!user) return null;
  return {
    id: String(user._id),
    displayName: user.fullName ?? usernameFromEmail(user.email) ?? 'User',
    username: usernameFromEmail(user.email),
    avatarUrl: user.avatarUrl ?? null,
  };
};

export const createConversationOffer = async ({
  conversationId,
  userId,
  price,
  quantity = 1,
  message,
}) => {
  const { conversation, role } = await conversationService.assertParticipant(
    conversationId,
    userId,
  );
  if (role !== 'BUYER')
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Only the buyer can make the initial offer',
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
  assertQuantityAvailable(quantity, product.stock);
  assertInitialOfferPrice(price, product.price);
  if (role === 'SELLER') {
    const seller = await SellerProfile.findById(conversation.sellerId)
      .select('userId')
      .lean();
    if (!seller || String(seller.userId) !== String(userId))
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Not listing seller');
  }
  const [offer, offerMessage] = await conversationRepository
    .transaction(async (session) => {
      await assertNoActiveConversationOffer(conversation._id, session);
      const [created] = await offerRepository.createWithSession(
        {
          conversationId,
          productId: conversation.productId,
          buyerId: conversation.buyerId,
          sellerId: conversation.sellerId,
          createdBy: userId,
          originalPrice: product.price,
          amount: price,
          quantity,
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
    })
    .catch((error) => {
      if (isDuplicateKey(error))
        throw invalidOffer(
          'Wait for the current offer to be resolved before making another offer',
        );
      throw error;
    });
  const payload = offerView(offer);
  const sender = await senderView(userId);
  emitToConversation(conversationId, 'offer:new', payload);
  emitToConversation(conversationId, 'message:new', {
    id: String(offerMessage._id),
    conversationId,
    senderId: String(userId),
    sender,
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
  if (status === 'ACCEPTED') {
    const product = await Product.findById(offer.productId).lean();
    if (
      !product ||
      product.status !== 'ACTIVE' ||
      product.stock < offer.quantity ||
      product.listingType !== 'FIXED' ||
      !product.offersEnabled
    )
      throw invalidOffer('Accepted offer quantity exceeds available stock');
  }
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

export const retractOffer = async (userId, offerId) => {
  const offer = await offerRepository.findById(offerId);
  if (!offer)
    throw new AppError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  if (!offer.conversationId || !offer.createdBy)
    throw new AppError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  await conversationService.assertParticipant(offer.conversationId, userId);
  if (String(offer.createdBy) !== String(userId))
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Only the offer sender can retract this offer',
    );
  const updated = await offerRepository.retractPendingByCreator(
    offerId,
    userId,
  );
  if (!updated)
    throw new AppError(409, ERROR_CODES.CONFLICT, 'Offer is no longer pending');
  const payload = offerView(updated);
  emitToConversation(updated.conversationId, 'offer:updated', payload);
  return payload;
};

export const counterOffer = async ({
  userId,
  offerId,
  price,
  quantity,
  message,
}) => {
  const parent = await offerRepository.findById(offerId);
  if (!parent)
    throw new AppError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  const { conversation } = await assertOfferActor(parent, userId);
  const terms = await validateCounterTerms({
    parent,
    userId,
    price,
    quantity,
  });
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
          quantity: terms.quantity,
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
  const sender = await senderView(userId);
  emitToConversation(parent.conversationId, 'offer:new', payload);
  emitToConversation(parent.conversationId, 'message:new', {
    id: String(offerMessage._id),
    conversationId: String(parent.conversationId),
    senderId: String(userId),
    sender,
    type: 'OFFER',
    offer: payload,
    status: offerMessage.status,
    createdAt: offerMessage.createdAt,
  });
  return payload;
};
