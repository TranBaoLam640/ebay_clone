import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { USER4_NOTIFICATION_EVENTS } from '../../common/constants/user4-notification-events.js';
import { allocateDiscount } from '../../common/services/pricing.service.js';
import * as addressRepository from '../addresses/repository.js';
import { toAddressSnapshot } from '../addresses/address.mapper.js';
import * as cartRepository from '../carts/cart.repository.js';
import { hydrate } from '../carts/cart.service.js';
import {
  consume as consumeCoupon,
  evaluate as evaluateCoupon,
} from '../coupons/coupon.service.js';
import * as productRepository from '../products/product.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import * as paymentRepository from '../payments/payment.repository.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import * as offerRepository from '../offers/offer.repository.js';
import * as conversationRepository from '../conversations/conversation.repository.js';
import * as notificationService from '../notifications/service.js';
import * as idempotencyService from '../idempotency/idempotency.service.js';
import * as checkoutGroupService from '../checkout-groups/checkout-group.service.js';
import { emitToConversation } from '../../socket/socket.js';
import * as repository from './checkout.repository.js';

const conflict = (code, message) => new AppError(409, code, message);
const json = (value) => JSON.parse(JSON.stringify(value));
const paymentDto = (payment) => ({
  _id: String(payment._id),
  checkoutGroupId: String(payment.checkoutGroupId),
  method: payment.method,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const offerRealtimePayload = (offer) => ({
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
});

const conversationRealtimePayload = (conversation) => ({
  id: String(conversation._id),
  type: conversation.type,
  orderId: conversation.orderId ? String(conversation.orderId) : null,
  updatedAt: conversation.updatedAt,
});

const isPurchasable = (item) =>
  item.product?.status === 'ACTIVE' &&
  item.product.stock > 0 &&
  Boolean(item.product.seller);

const validateAcceptedOffer = async (
  buyerId,
  input,
  selectedItems,
  session,
) => {
  if (!input.offerId) return null;
  if (selectedItems.length !== 1)
    throw conflict(
      ERROR_CODES.CART_SELECTION_INVALID,
      'Accepted offer checkout requires exactly one selected item',
    );
  const offer = await offerRepository.findById(input.offerId, session);
  if (!offer)
    throw new AppError(404, ERROR_CODES.OFFER_NOT_FOUND, 'Offer not found');
  if (String(offer.buyerId) !== String(buyerId))
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Offer belongs to another buyer',
    );
  if (offer.status !== 'ACCEPTED')
    throw conflict(ERROR_CODES.CONFLICT, 'Offer is not accepted');
  if (offer.usedAt || offer.orderId)
    throw conflict(ERROR_CODES.CONFLICT, 'Offer has already been used');
  if (offer.expiresAt <= new Date())
    throw conflict(ERROR_CODES.CONFLICT, 'Offer has expired');

  const item = selectedItems[0];
  const productId = await productRepository.resolveIdByUuid(item.productId);
  if (!productId || String(productId) !== String(offer.productId))
    throw conflict(ERROR_CODES.PRODUCT_UNAVAILABLE, 'Offer product mismatch');
  if (String(item.product.seller.id) !== String(offer.sellerId))
    throw conflict(ERROR_CODES.PRODUCT_UNAVAILABLE, 'Offer seller mismatch');
  if (item.quantity !== offer.quantity)
    throw conflict(
      ERROR_CODES.CART_SELECTION_INVALID,
      'Cart quantity must match accepted offer quantity',
    );
  const conversation = offer.conversationId
    ? await conversationRepository.findById(offer.conversationId, session)
    : null;
  if (
    !conversation ||
    String(conversation.buyerId) !== String(buyerId) ||
    String(conversation.sellerId) !== String(offer.sellerId) ||
    String(conversation.productId) !== String(offer.productId)
  )
    throw conflict(ERROR_CODES.CONFLICT, 'Offer conversation mismatch');

  const finalSubtotal = offer.amount * item.quantity;
  item.offer = {
    id: String(offer._id),
    originalPrice: offer.originalPrice ?? item.product.price,
    finalPrice: offer.amount,
  };
  item.product = { ...item.product, price: offer.amount };
  item.itemSubtotal = finalSubtotal;
  return { offer, conversation };
};

const selection = async (buyerId, input, session) => {
  const address = await addressRepository.owned(
    buyerId,
    input.addressId,
    session,
  );
  if (!address)
    throw new AppError(404, ERROR_CODES.ADDRESS_NOT_FOUND, 'Address not found');
  const cart = await hydrate(
    await cartRepository.findByUser(buyerId, session),
    session,
  );
  const selectedIds = new Set(input.selectedCartItemIds);
  if (selectedIds.size !== input.selectedCartItemIds.length)
    throw conflict(
      ERROR_CODES.CART_SELECTION_INVALID,
      'Cart selection is invalid',
    );
  const selectedItems = cart.items.filter((item) => selectedIds.has(item.id));
  if (selectedItems.length !== selectedIds.size)
    throw conflict(
      ERROR_CODES.CART_SELECTION_INVALID,
      'Cart selection is invalid',
    );
  if (selectedItems.some((item) => !isPurchasable(item)))
    throw conflict(
      ERROR_CODES.PRODUCT_UNAVAILABLE,
      'Selected product is unavailable',
    );
  if (selectedItems.some((item) => item.quantity > item.product.stock))
    throw conflict(
      ERROR_CODES.INSUFFICIENT_STOCK,
      'Selected quantity exceeds stock',
    );
  const offerContext = await validateAcceptedOffer(
    buyerId,
    input,
    selectedItems,
    session,
  );
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.itemSubtotal,
    0,
  );
  const coupon = input.couponCode
    ? await evaluateCoupon(
        buyerId,
        input.couponCode,
        subtotal,
        new Date(),
        session,
      )
    : null;
  const discount = coupon?.discount || 0;
  const grouped = Object.values(
    selectedItems.reduce((groups, item) => {
      const sellerId = item.product.seller.id;
      groups[sellerId] ||= {
        sellerId,
        sellerDisplayName: item.product.seller.displayName,
        items: [],
        subtotal: 0,
      };
      groups[sellerId].items.push(item);
      groups[sellerId].subtotal += item.itemSubtotal;
      return groups;
    }, {}),
  ).sort((a, b) => a.sellerId.localeCompare(b.sellerId));
  return {
    selectedItems,
    sellerGroups: allocateDiscount(grouped, discount),
    address: toAddressSnapshot(address),
    subtotal,
    discount,
    total: subtotal - discount,
    stockWarnings: [],
    paymentMethods: ['COD', 'PAYPAL'],
    selectedPaymentMethod: input.paymentMethod,
    currency: 'VND',
    shippingFee: 0,
    coupon,
    offer: offerContext
      ? {
          id: String(offerContext.offer._id),
          originalPrice:
            offerContext.offer.originalPrice ??
            selectedItems[0].offer.originalPrice,
          finalPrice: offerContext.offer.amount,
        }
      : null,
  };
};

export const preview = (buyerId, input) => selection(buyerId, input);

const notifySellers = async (groupId, sellerGroups, session) => {
  for (const sellerGroup of sellerGroups) {
    const seller = await sellerRepository.findById(
      sellerGroup.sellerId,
      session,
    );
    if (seller)
      await notificationService.createNotification(
        seller.userId,
        {
          type: 'ORDER',
          title: 'New order',
          message: 'A new order was placed',
          referenceType: 'CheckoutGroup',
          referenceId: groupId,
          eventType: USER4_NOTIFICATION_EVENTS.ORDER_PLACED,
          eventKey: `${USER4_NOTIFICATION_EVENTS.ORDER_PLACED}:${groupId}:${sellerGroup.sellerId}`,
        },
        session,
      );
  }
};

export const execute = async (buyerId, key, input) => {
  const hash = idempotencyService.requestHash(input);
  const claim = await idempotencyService.claim('CHECKOUT', buyerId, key, hash);
  if (claim.replay) return claim.replay;
  try {
    const result = await repository.transaction(async (session) => {
      const checkout = await selection(buyerId, input, session);
      let consumedOffer = null;
      let realtimeEvents = null;
      if (checkout.offer) {
        consumedOffer = await offerRepository.consumeAccepted(
          checkout.offer.id,
          buyerId,
          session,
        );
        if (!consumedOffer)
          throw conflict(
            ERROR_CODES.CONFLICT,
            'Offer is no longer available for checkout',
          );
      }
      // cart.service.hydrate() now exposes the public uuid as item.productId.
      // Resolve all uuids → internal ObjectIds once (batch) before any DB writes.
      const uuids = checkout.selectedItems.map((item) => item.productId);
      const uuidToId = await productRepository.resolveIdsByUuids(uuids);
      for (const item of checkout.selectedItems) {
        const internalId = uuidToId.get(item.productId);
        if (!internalId)
          throw conflict(
            ERROR_CODES.INSUFFICIENT_STOCK,
            'Selected quantity exceeds stock',
          );
        if (
          !(await productRepository.deductStock(
            internalId,
            item.quantity,
            session,
          ))
        )
          throw conflict(
            ERROR_CODES.INSUFFICIENT_STOCK,
            'Selected quantity exceeds stock',
          );
      }
      const group = await checkoutGroupService.create(
        {
          buyerId,
          orderIds: [],
          couponId: checkout.coupon?.couponId || null,
          paymentMethod: input.paymentMethod,
          status: 'PAYMENT_PENDING',
          subtotal: checkout.subtotal,
          discount: checkout.discount,
          shippingFee: 0,
          total: checkout.total,
          currency: 'VND',
        },
        session,
      );
      const address = checkout.address;
      const orders = await orderRepository.createMany(
        checkout.sellerGroups.map((sellerGroup) => ({
          buyerId,
          checkoutGroupId: group._id,
          sellerId: sellerGroup.sellerId,
          orderStatus: 'PENDING_PAYMENT',
          paymentMethod: input.paymentMethod,
          subtotal: sellerGroup.subtotal,
          discount: sellerGroup.discount,
          shippingFee: 0,
          total: sellerGroup.total,
          currency: 'VND',
          shippingAddress: address,
          items: sellerGroup.items.map((item) => ({
            // item.productId is the public uuid; resolve to internal ObjectId.
            productId: uuidToId.get(item.productId),
            sellerId: sellerGroup.sellerId,
            quantity: item.quantity,
            title: item.product.title,
            // Snapshot the image so order detail never depends on a later fetch.
            image: item.product.primaryImage ?? null,
            unitPrice: item.product.price,
            itemSubtotal: item.itemSubtotal,
            ...(item.offer && {
              offerId: item.offer.id,
              originalPrice: item.offer.originalPrice,
              finalPrice: item.offer.finalPrice,
            }),
          })),
          ...(consumedOffer && { offerId: consumedOffer._id }),
        })),
        session,
      );
      if (consumedOffer) {
        await offerRepository.attachOrder(
          consumedOffer._id,
          orders[0]._id,
          session,
        );
        const upgradedConversation =
          await conversationRepository.attachOrderContext(
            consumedOffer.conversationId,
            orders[0]._id,
            session,
          );
        realtimeEvents = {
          conversationId: String(consumedOffer.conversationId),
          offer: offerRealtimePayload({
            ...consumedOffer,
            orderId: orders[0]._id,
          }),
          conversation: conversationRealtimePayload(upgradedConversation),
        };
      }
      const payment = await paymentRepository.create(
        {
          buyerId,
          checkoutGroupId: group._id,
          method: input.paymentMethod,
          status: 'PENDING',
          amount: checkout.total,
          currency: 'VND',
        },
        session,
      );
      const updatedGroup = await checkoutGroupService.setOrders(
        group._id,
        orders.map((order) => order._id),
        payment._id,
        session,
      );
      if (checkout.coupon)
        await consumeCoupon(
          checkout.coupon,
          buyerId,
          group._id,
          orders.map((order) => order._id),
          session,
        );
      await cartRepository.removeSelected(
        buyerId,
        input.selectedCartItemIds,
        session,
      );
      await notifySellers(group._id, checkout.sellerGroups, session);
      const data = {
        ...checkoutGroupService.toPublic(updatedGroup),
        orders: orders.map(orderRepository.toPublic),
        payment: paymentDto(payment),
      };
      const response = { success: true, data: json(data) };
      const completed = await idempotencyService.complete(
        'CHECKOUT',
        buyerId,
        key,
        claim.claimToken,
        {
          resourceId: group._id,
          responseStatus: 201,
          responseBody: response,
        },
        session,
      );
      if (!completed)
        throw conflict(
          ERROR_CODES.IDEMPOTENCY_PROCESSING,
          'Idempotency claim was lost',
        );
      return { status: 201, body: response, realtimeEvents };
    });
    if (result.realtimeEvents) {
      emitToConversation(
        result.realtimeEvents.conversationId,
        'offer:updated',
        result.realtimeEvents.offer,
      );
      emitToConversation(
        result.realtimeEvents.conversationId,
        'conversation:updated',
        result.realtimeEvents.conversation,
      );
    }
    return { status: result.status, body: result.body };
  } catch (error) {
    await idempotencyService.fail(
      'CHECKOUT',
      buyerId,
      key,
      claim.claimToken,
      error,
    );
    throw error;
  }
};
