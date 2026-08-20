import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
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
