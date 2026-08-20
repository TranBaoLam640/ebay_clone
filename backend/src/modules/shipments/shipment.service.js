import { randomBytes } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import { env } from '../../config/env.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import { SHIPMENT_CARRIERS, TRACKING_PREFIX } from './shipment.constants.js';
import * as repository from './shipment.repository.js';

const TRACKING_DUPLICATE_RETRIES = 3;

export const generateTrackingNumber = () =>
  `${TRACKING_PREFIX}-${randomBytes(4).toString('hex').toUpperCase()}`;

export const estimatedDeliveryAt = (createdAt = new Date()) =>
  new Date(createdAt.getTime() + env.SHIPMENT_ETA_DAYS * 86_400_000);

const isDuplicateTracking = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.trackingNumber || error?.keyValue?.trackingNumber);

const isDuplicateOrder = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.orderId || error?.keyValue?.orderId);

const notFound = () =>
  new AppError(404, ERROR_CODES.SHIPMENT_NOT_FOUND, 'Shipment not found');

const invalidState = (message) =>
  new AppError(409, ERROR_CODES.SHIPMENT_INVALID_STATE, message);

export const createForOrder = async (
  order,
  { session, now = new Date() } = {},
) => {
  for (let attempt = 0; attempt < TRACKING_DUPLICATE_RETRIES; attempt += 1) {
    try {
      const created = await repository.create(
        {
          orderId: order._id,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          shipperId: null,
          carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
          trackingNumber: generateTrackingNumber(),
          status: 'READY_FOR_PICKUP',
          estimatedDeliveryAt: estimatedDeliveryAt(now),
        },
        session,
      );
      return repository.toPublic(created);
    } catch (error) {
      if (isDuplicateOrder(error)) {
        const existing = await repository.findByOrderId(order._id, session);
        if (existing) return existing;
      }
      if (
        isDuplicateTracking(error) &&
        attempt + 1 < TRACKING_DUPLICATE_RETRIES
      )
        continue;
      throw error;
    }
  }
  throw new Error('Shipment tracking number generation failed');
};

export const getById = (id, session) => repository.findById(id, session);
export const getByOrderId = (orderId, session) =>
  repository.findByOrderId(orderId, session);
export const getByTrackingNumber = (trackingNumber, session) =>
  repository.findByTrackingNumber(trackingNumber, session);

export const listForShipper = async (shipperId, query) => {
  const { page, limit } = pagination(query);
  const skip = (page - 1) * limit;
  const scope = query.scope || 'available';
  const [items, total] =
    scope === 'mine'
      ? await Promise.all([
          repository.listByShipper(shipperId, skip, limit),
          repository.countByShipper(shipperId),
        ])
      : await Promise.all([
          repository.listAvailable(skip, limit),
          repository.countAvailable(),
        ]);
  return { items, meta: paginationMeta(page, limit, total) };
};

export const pickup = async (shipperId, shipmentId) => {
  const existing = await repository.findById(shipmentId);
  if (!existing) throw notFound();
  const pickedUpAt = new Date();
  const claimed = await repository.claimForPickup(
    shipmentId,
    shipperId,
    pickedUpAt,
  );
  if (!claimed) throw invalidState('Shipment is not available for pickup');
  return claimed;
};

export const deliver = (shipperId, shipmentId) =>
  checkoutRepository.transaction(async (session) => {
    const existing = await repository.findById(shipmentId, session);
    if (!existing) throw notFound();
    if (
      existing.status !== 'IN_TRANSIT' ||
      String(existing.shipperId) !== String(shipperId)
    )
      throw invalidState('Shipment cannot be delivered');
    const deliveredAt = new Date();
    const delivered = await repository.markDelivered(
      shipmentId,
      shipperId,
      deliveredAt,
      session,
    );
    if (!delivered) throw invalidState('Shipment cannot be delivered');
    const order = await orderRepository.markDeliveredFromShipment(
      delivered.orderId,
      deliveredAt,
      session,
    );
    if (!order)
      throw invalidState('Order is not confirmed for shipment delivery');
    return delivered;
  });
