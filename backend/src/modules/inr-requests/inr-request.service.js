import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { USER4_NOTIFICATION_EVENTS } from '../../common/constants/user4-notification-events.js';
import { AppError } from '../../common/errors/app-error.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import { env } from '../../config/env.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as carrierService from '../carriers/carrier.service.js';
import * as conversationRepository from '../conversations/conversation.repository.js';
import * as notificationService from '../notifications/service.js';
import * as orderRepository from '../orders/order.repository.js';
import * as paymentRepository from '../payments/payment.repository.js';
import * as refundService from '../payments/refunds/refund.service.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import * as shipmentRepository from '../shipments/shipment.repository.js';
import { User } from '../users/user.model.js';
import * as idempotencyService from '../idempotency/idempotency.service.js';
import {
  INR_CLOSE_REASONS,
  INR_ISSUE_TYPE,
  INR_REFERENCE_TYPE,
} from './inr-request.constants.js';
import * as repository from './inr-request.repository.js';

const INR_OPEN_DELAY_MINUTES = 10;
const INR_OPEN_DELAY_MS = INR_OPEN_DELAY_MINUTES * 60_000;

const inrError = (status, code, message) => new AppError(status, code, message);

const notFound = () =>
  inrError(404, ERROR_CODES.INR_NOT_FOUND, 'INR request not found');

const invalidState = (message) =>
  inrError(409, ERROR_CODES.INR_INVALID_STATE, message);

const paymentInvalidState = (message) =>
  inrError(409, ERROR_CODES.PAYMENT_INVALID_STATE, message);

const safeShipment = (shipment) =>
  shipment
    ? {
        id: String(shipment._id),
        status: shipment.status,
        estimatedDeliveryAt: shipment.estimatedDeliveryAt,
        pickedUpAt: shipment.pickedUpAt ?? null,
        deliveredAt: shipment.deliveredAt ?? null,
      }
    : null;

const fullShipment = (shipment) =>
  shipment
    ? {
        id: String(shipment._id),
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        status: shipment.status,
        estimatedDeliveryAt: shipment.estimatedDeliveryAt,
        pickedUpAt: shipment.pickedUpAt ?? null,
        deliveredAt: shipment.deliveredAt ?? null,
      }
    : null;

const itemSummary = (item) => ({
  id: String(item._id),
  productId: String(item.productId),
  sellerId: String(item.sellerId),
  title: item.title ?? null,
  image: item.image ?? null,
  quantity: item.quantity,
  unitPrice: item.unitPrice ?? null,
  itemSubtotal: item.itemSubtotal ?? null,
});

const latestEvidence = (request) =>
  request.trackingEvidenceHistory?.at(-1) ?? null;

const buyerDto = ({ request, orderItem, shipment }) => ({
  id: String(request._id),
  type: INR_ISSUE_TYPE,
  orderId: String(request.orderId),
  orderItemId: String(request.orderItemId),
  item: orderItem ? itemSummary(orderItem) : null,
  quantityMissing: request.quantityMissing,
  requestedResolution: request.requestedResolution,
  details: request.details ?? null,
  status: request.status,
  requestAmount: request.requestAmount,
  currency: request.currency,
  shipment: safeShipment(shipment),
  conversationId: String(request.conversationId),
  refundId: request.refundId ? String(request.refundId) : null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  closedAt: request.closedAt ?? null,
  closeReason: request.closeReason ?? null,
});

const refundDto = (refund) =>
  refund
    ? {
        id: String(refund.id ?? refund._id),
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        method: refund.method,
        completedAt: refund.completedAt ?? null,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt,
      }
    : null;

const sellerDto = ({ request, orderItem, shipment, buyer, refund }) => ({
  id: String(request._id),
  type: INR_ISSUE_TYPE,
  orderId: String(request.orderId),
  orderItemId: String(request.orderItemId),
  item: orderItem ? itemSummary(orderItem) : null,
  buyer: buyer
    ? {
        id: String(buyer._id),
        displayName: buyer.fullName ?? buyer.email ?? 'Buyer',
        avatarUrl: buyer.avatarUrl ?? null,
      }
    : null,
  quantityMissing: request.quantityMissing,
  requestedResolution: request.requestedResolution,
  details: request.details ?? null,
  status: request.status,
  requestAmount: request.requestAmount,
  currency: request.currency,
  shipment: fullShipment(shipment),
  latestTrackingEvidence: latestEvidence(request),
  trackingEvidenceHistory: request.trackingEvidenceHistory ?? [],
  conversationId: String(request.conversationId),
  refundId: request.refundId ? String(request.refundId) : null,
  refund: refundDto(refund),
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  closedAt: request.closedAt ?? null,
  closeReason: request.closeReason ?? null,
});

const loadContext = async (request, session) => {
  const [order, shipment, buyer, refund] = await Promise.all([
    orderRepository.findOrderItem({
      orderId: request.orderId,
      orderItemId: request.orderItemId,
      session,
    }),
    shipmentRepository.findOriginalByOrderId(request.orderId, session),
    User.findById(request.buyerId)
      .select('fullName email avatarUrl')
      .session(session || null)
      .lean(),
    request.refundId
      ? refundService.findById(request.refundId, session)
      : Promise.resolve(null),
  ]);
  return {
    request,
    orderItem: order?.items?.[0] ?? null,
    shipment,
    buyer,
    refund,
  };
};

const ensureConversation = async (
  { buyerId, sellerId, productId, orderId },
  session,
) => {
  const existing = await conversationRepository.findCanonical(
    { buyerId, sellerId, productId },
    session,
  );
  if (existing) {
    if (!existing.orderId || existing.type !== 'POST_PURCHASE')
      return conversationRepository.attachOrderContext(
        existing._id,
        orderId,
        session,
      );
    return existing;
  }
  const [created] = await conversationRepository.create(
    {
      buyerId,
      sellerId,
      productId,
      orderId,
      type: 'POST_PURCHASE',
      lastMessageAt: new Date(),
    },
    session,
  );
  return created.toObject();
};

const validateEligibility = ({
  order,
  item,
  shipment,
  quantityMissing,
  now,
}) => {
  if (!order || !item)
    throw inrError(404, ERROR_CODES.NOT_FOUND, 'Order item not found');
  if (!['CONFIRMED', 'DELIVERED'].includes(order.orderStatus))
    throw inrError(
      409,
      ERROR_CODES.INR_NOT_ELIGIBLE,
      'Order item is not eligible for INR',
    );
  if (!shipment)
    throw inrError(
      409,
      ERROR_CODES.INR_NOT_ELIGIBLE,
      'Shipment is required before opening an INR request',
    );
  const eta = new Date(shipment.estimatedDeliveryAt);
  const eligibleAt = new Date(eta.getTime() + INR_OPEN_DELAY_MS);
  if (Number.isNaN(eta.getTime()) || now <= eligibleAt)
    throw inrError(
      409,
      ERROR_CODES.INR_NOT_ELIGIBLE,
      `INR can only be opened ${INR_OPEN_DELAY_MINUTES} minutes after the estimated delivery date`,
    );
  const windowEnd = new Date(eta.getTime() + env.INR_WINDOW_DAYS * 86_400_000);
  if (now > windowEnd)
    throw inrError(
      409,
      ERROR_CODES.INR_WINDOW_EXPIRED,
      'INR reporting window has expired',
    );
  if (quantityMissing > item.quantity)
    throw inrError(
      409,
      ERROR_CODES.INR_NOT_ELIGIBLE,
      'Missing quantity exceeds ordered quantity',
    );
};

const requestAmount = (item, quantityMissing) => {
  const lineAmount =
    item.itemSubtotal ??
    (item.unitPrice !== undefined ? item.unitPrice * item.quantity : 0);
  return Math.round((lineAmount * quantityMissing) / item.quantity);
};

const notifySeller = (sellerUserId, requestId, session) =>
  notificationService.createNotification(
    sellerUserId,
    {
      type: 'DISPUTE',
      title: 'Item not received request opened',
      message: 'A buyer reported an item not received',
      referenceType: INR_REFERENCE_TYPE,
      referenceId: requestId,
      eventType: USER4_NOTIFICATION_EVENTS.INR_REQUESTED,
      eventKey: `${USER4_NOTIFICATION_EVENTS.INR_REQUESTED}:${requestId}:SELLER`,
    },
    session,
  );

const notifyBuyerRefunded = (buyerId, requestId, refundId, session) =>
  notificationService.createNotification(
    buyerId,
    {
      type: 'DISPUTE',
      title: 'INR refund completed',
      message: 'The seller refunded your item not received request',
      referenceType: INR_REFERENCE_TYPE,
      referenceId: requestId,
      eventType: USER4_NOTIFICATION_EVENTS.INR_REFUNDED,
      eventKey: `${USER4_NOTIFICATION_EVENTS.INR_REFUNDED}:${requestId}:BUYER`,
    },
    session,
  );

const duplicateOpen = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.orderId || error?.keyValue?.orderId);

export const create = (buyerId, input, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const order = await orderRepository.findOwned(
      buyerId,
      input.orderId,
      session,
    );
    const item = order?.items?.find(
      (candidate) => String(candidate._id) === input.orderItemId,
    );
    const shipment = order
      ? await shipmentRepository.findOriginalByOrderId(order._id, session)
      : null;
    validateEligibility({
      order,
      item,
      shipment,
      quantityMissing: input.quantityMissing,
      now,
    });
    const seller = await sellerRepository.findById(order.sellerId, session);
    if (!seller) throw inrError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');
    const conversation = await ensureConversation(
      {
        buyerId,
        sellerId: order.sellerId,
        productId: item.productId,
        orderId: order._id,
      },
      session,
    );
    try {
      const created = await repository.create(
        {
          buyerId,
          sellerId: order.sellerId,
          orderId: order._id,
          orderItemId: item._id,
          productId: item.productId,
          shipmentId: shipment._id,
          requestedResolution: input.requestedResolution,
          quantityMissing: input.quantityMissing,
          details: input.details,
          requestAmount: requestAmount(item, input.quantityMissing),
          currency: order.currency || 'VND',
          conversationId: conversation._id,
          status: 'OPEN',
        },
        session,
      );
      await notifySeller(seller.userId, created._id, session);
      return buyerDto({
        request: created.toObject(),
        orderItem: item,
        shipment,
      });
    } catch (error) {
      if (duplicateOpen(error))
        throw inrError(
          409,
          ERROR_CODES.INR_ALREADY_OPEN,
          'An open INR request already exists for this order item',
        );
      throw error;
    }
  });

export const listBuyer = async (buyerId, query) => {
  const { page, limit } = pagination(query);
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    repository.listByBuyer(buyerId, query, skip, limit),
    repository.countByBuyer(buyerId, query),
  ]);
  const contexts = await Promise.all(
    items.map((request) => loadContext(request)),
  );
  return {
    items: contexts.map(buyerDto),
    meta: paginationMeta(page, limit, total),
  };
};

export const listSeller = async (userId, query) => {
  const seller = await sellerRepository.findByUserId(userId);
  const { page, limit } = pagination(query);
  if (!seller) return { items: [], meta: paginationMeta(page, limit, 0) };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    repository.listBySeller(seller._id, query, skip, limit),
    repository.countBySeller(seller._id, query),
  ]);
  const contexts = await Promise.all(
    items.map((request) => loadContext(request)),
  );
  return {
    items: contexts.map(sellerDto),
    meta: paginationMeta(page, limit, total),
  };
};

export const get = async (userId, id) => {
  const buyerRequest = await repository.findOwnedByBuyer(userId, id);
  if (buyerRequest) return buyerDto(await loadContext(buyerRequest));
  const seller = await sellerRepository.findByUserId(userId);
  if (!seller) throw notFound();
  const sellerRequest = await repository.findOwnedBySeller(seller._id, id);
  if (!sellerRequest) throw notFound();
  return sellerDto(await loadContext(sellerRequest));
};

export const close = (buyerId, id, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const existing = await repository.findOwnedByBuyer(buyerId, id, session);
    if (!existing) throw notFound();
    if (existing.status !== 'OPEN')
      throw invalidState('INR request is not open');
    const closed = await repository.closeOpenRequest(
      id,
      buyerId,
      {
        closedAt: now,
        closeReason: INR_CLOSE_REASONS.ITEM_ARRIVED,
      },
      session,
    );
    if (!closed) throw invalidState('INR request is not open');
    return buyerDto(await loadContext(closed, session));
  });

export const updateTrackingEvidence = (
  userId,
  id,
  input,
  { now = new Date() } = {},
) =>
  checkoutRepository.transaction(async (session) => {
    const seller = await sellerRepository.findByUserId(userId, session);
    if (!seller) throw notFound();
    const existing = await repository.findOwnedBySeller(
      seller._id,
      id,
      session,
    );
    if (!existing) throw notFound();
    if (existing.status !== 'OPEN')
      throw invalidState('INR request is not open');
    const carrier = await carrierService.requireActive(
      input.carrierId,
      session,
    );
    const updated = await repository.appendTrackingEvidence(
      id,
      seller._id,
      {
        carrierId: carrier._id,
        carrierCode: carrier.code,
        carrierName: carrier.name,
        trackingId: input.trackingId,
        submittedBy: userId,
        submittedAt: now,
      },
      session,
    );
    if (!updated) throw invalidState('INR request is not open');
    return sellerDto(await loadContext(updated, session));
  });

const ensureSellerRequest = async (userId, id, session) => {
  const seller = await sellerRepository.findByUserId(userId, session);
  if (!seller) throw notFound();
  const request = await repository.findOwnedBySeller(seller._id, id, session);
  if (!request) throw notFound();
  return { seller, request };
};

const refundPaymentContext = async (request, session) => {
  if (request.status !== 'OPEN') throw invalidState('INR request is not open');
  if (!(request.requestAmount > 0))
    throw invalidState('INR request amount must be positive');
  const order = await orderRepository.findOrderItem({
    orderId: request.orderId,
    orderItemId: request.orderItemId,
    session,
  });
  const item = order?.items?.[0];
  if (!order || !item)
    throw inrError(404, ERROR_CODES.NOT_FOUND, 'Order item not found');
  if (String(order.buyerId) !== String(request.buyerId))
    throw paymentInvalidState('INR order buyer mismatch');
  if (String(order.sellerId) !== String(request.sellerId))
    throw paymentInvalidState('INR order seller mismatch');
  if (!order.checkoutGroupId)
    throw paymentInvalidState('INR order has no checkout group payment');
  const payment = await paymentRepository.ownedByGroupInternal(
    request.buyerId,
    order.checkoutGroupId,
    session,
  );
  if (!payment) throw paymentInvalidState('Payment not found for INR order');
  if (String(payment.checkoutGroupId) !== String(order.checkoutGroupId))
    throw paymentInvalidState('Payment does not belong to INR order');
  if (payment.method === 'PAYPAL' && payment.status !== 'CAPTURED')
    throw paymentInvalidState('PayPal payment has not been captured');
  if (payment.method === 'COD' && payment.status !== 'CONFIRMED')
    throw paymentInvalidState('COD payment has not been confirmed');
  if (request.requestAmount > payment.amount)
    throw paymentInvalidState('INR refund amount exceeds payment amount');
  return { order, item, payment };
};

const previewDto = ({ request, order, item, payment, buyer }) => ({
  requestId: String(request._id),
  orderId: String(request.orderId),
  refundAmount: request.requestAmount,
  currency: request.currency,
  summary: {
    purchasePrice: request.requestAmount,
    shipping: 0,
    feeCredits: 0,
    amountYouOwe: request.requestAmount,
  },
  paymentMethod: payment.method,
  refundable: true,
  product: {
    id: String(request.productId),
    title: item.title ?? 'Purchased item',
    image: item.image ?? null,
  },
  buyer: {
    displayName: buyer?.fullName ?? buyer?.email ?? 'Buyer',
  },
  datePurchased: order.createdAt,
});

export const refundPreview = async (userId, id) => {
  const { request } = await ensureSellerRequest(userId, id);
  const { order, item, payment } = await refundPaymentContext(request);
  const buyer = await User.findById(request.buyerId)
    .select('fullName email')
    .lean();
  return previewDto({ request, order, item, payment, buyer });
};

const refundInput = ({ request, payment }) => ({
  paymentId: payment._id,
  checkoutGroupId: payment.checkoutGroupId,
  buyerId: request.buyerId,
  sellerId: request.sellerId,
  sourceType: 'INR',
  sourceId: request._id,
  amount: request.requestAmount,
  currency: request.currency,
  method: payment.method,
});

export const refund = async (userId, id, key, { now = new Date() } = {}) => {
  const hash = idempotencyService.requestHash({ requestId: id });
  const claim = await idempotencyService.claim('INR_REFUND', userId, key, hash);
  if (claim.replay) return claim.replay;
  try {
    const { seller, request } = await ensureSellerRequest(userId, id);
    const { payment } = await refundPaymentContext(request);
    const claimed = await refundService.prepare(
      refundInput({ request, payment }),
    );
    let refundRecord = claimed.refund;
    if (claimed.state !== 'COMPLETED')
      refundRecord = await refundService.processProvider({
        refund: refundRecord,
        payment,
        claimToken: claimed.claimToken,
      });

    const result = await checkoutRepository.transaction(async (session) => {
      const latest = await repository.findOwnedBySeller(
        seller._id,
        id,
        session,
      );
      if (!latest) throw notFound();
      if (latest.status !== 'OPEN')
        throw invalidState('INR request is not open');
      const completedRefund = await refundService.complete(
        refundRecord,
        session,
        now,
      );
      if (!completedRefund)
        throw paymentInvalidState('Refund could not be completed');
      const closed = await repository.closeOpenRequestForRefund(
        id,
        seller._id,
        {
          closedAt: now,
          closeReason: INR_CLOSE_REASONS.SELLER_REFUNDED,
          refundId: completedRefund._id,
        },
        session,
      );
      if (!closed) throw invalidState('INR request is not open');
      await notifyBuyerRefunded(
        closed.buyerId,
        closed._id,
        completedRefund._id,
        session,
      );
      const response = {
        success: true,
        data: sellerDto(await loadContext(closed, session)),
      };
      const completed = await idempotencyService.complete(
        'INR_REFUND',
        userId,
        key,
        claim.claimToken,
        {
          resourceId: completedRefund._id,
          responseStatus: 200,
          responseBody: response,
        },
        session,
      );
      if (!completed)
        throw inrError(
          409,
          ERROR_CODES.IDEMPOTENCY_PROCESSING,
          'Idempotency claim was lost',
        );
      return { status: 200, body: response };
    });
    return result;
  } catch (error) {
    await idempotencyService.fail(
      'INR_REFUND',
      userId,
      key,
      claim.claimToken,
      error,
    );
    throw error;
  }
};
