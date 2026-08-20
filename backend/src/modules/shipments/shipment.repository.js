import { Shipment } from './shipment.model.js';

const publicProjection = {
  _id: 1,
  orderId: 1,
  buyerId: 1,
  sellerId: 1,
  shipperId: 1,
  carrier: 1,
  trackingNumber: 1,
  status: 1,
  estimatedDeliveryAt: 1,
  pickedUpAt: 1,
  deliveredAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const toPublic = (shipment) => {
  const source = shipment?.toObject ? shipment.toObject() : shipment;
  return Object.fromEntries(
    Object.keys(publicProjection)
      .filter((key) => source?.[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
};

export const create = async (data, session) =>
  (await Shipment.create([data], { session }))[0];

export const listAvailable = (skip, limit, session) =>
  Shipment.find({ status: 'READY_FOR_PICKUP', shipperId: null })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .session(session || null)
    .lean();

export const countAvailable = (session) =>
  Shipment.countDocuments({
    status: 'READY_FOR_PICKUP',
    shipperId: null,
  }).session(session || null);

export const listByShipper = (shipperId, skip, limit, session) =>
  Shipment.find({ shipperId, status: { $in: ['IN_TRANSIT', 'DELIVERED'] } })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .session(session || null)
    .lean();

export const countByShipper = (shipperId, session) =>
  Shipment.countDocuments({
    shipperId,
    status: { $in: ['IN_TRANSIT', 'DELIVERED'] },
  }).session(session || null);

export const listBySeller = (sellerId, skip, limit, session) =>
  Shipment.find({ sellerId })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .session(session || null)
    .lean();

export const countBySeller = (sellerId, session) =>
  Shipment.countDocuments({ sellerId }).session(session || null);

export const findById = (id, session) =>
  Shipment.findById(id)
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findByOrderId = (orderId, session) =>
  Shipment.findOne({ orderId })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findByOrderIds = (orderIds, session) =>
  Shipment.find({ orderId: { $in: orderIds } })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findByTrackingNumber = (trackingNumber, session) =>
  Shipment.findOne({ trackingNumber })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const claimForPickup = (id, shipperId, pickedUpAt, session) =>
  Shipment.findOneAndUpdate(
    { _id: id, status: 'READY_FOR_PICKUP', shipperId: null },
    { status: 'IN_TRANSIT', shipperId, pickedUpAt },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const markDelivered = (id, shipperId, deliveredAt, session) =>
  Shipment.findOneAndUpdate(
    { _id: id, status: 'IN_TRANSIT', shipperId },
    { status: 'DELIVERED', deliveredAt },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();
