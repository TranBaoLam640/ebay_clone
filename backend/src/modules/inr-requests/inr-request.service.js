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
import * as sellerRepository from '../sellers/seller.repository.js';
import * as shipmentRepository from '../shipments/shipment.repository.js';
import { User } from '../users/user.model.js';
import {
  INR_CLOSE_REASONS,
  INR_ISSUE_TYPE,
  INR_REFERENCE_TYPE,
} from './inr-request.constants.js';
import * as repository from './inr-request.repository.js';

const inrError = (status, code, message) => new AppError(status, code, message);

const notFound = () =>
  inrError(404, ERROR_CODES.INR_NOT_FOUND, 'INR request not found');

const invalidState = (message) =>
  inrError(409, ERROR_CODES.INR_INVALID_STATE, message);

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
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  closedAt: request.closedAt ?? null,
  closeReason: request.closeReason ?? null,
});

const sellerDto = ({ request, orderItem, shipment, buyer }) => ({
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
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  closedAt: request.closedAt ?? null,
  closeReason: request.closeReason ?? null,
});

const loadContext = async (request, session) => {
  const [order, shipment, buyer] = await Promise.all([
    orderRepository.findOrderItem({
      orderId: request.orderId,
      orderItemId: request.orderItemId,
      session,
    }),
    shipmentRepository.findByOrderId(request.orderId, session),
    User.findById(request.buyerId)
      .select('fullName email avatarUrl')
      .session(session || null)
      .lean(),
  ]);
  return {
    request,
    orderItem: order?.items?.[0] ?? null,
    shipment,
    buyer,
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
  if (Number.isNaN(eta.getTime()) || now <= eta)
    throw inrError(
      409,
      ERROR_CODES.INR_NOT_ELIGIBLE,
      'INR can only be opened after the estimated delivery date',
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
      ? await shipmentRepository.findByOrderId(order._id, session)
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
