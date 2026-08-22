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

const internalProjection = {
  ...publicProjection,
  purpose: 1,
  replacementId: 1,
};

const originalPurposeFilter = {
  $or: [{ purpose: 'ORIGINAL' }, { purpose: { $exists: false } }],
};

export const toPublic = (shipment) => {
  const source = shipment?.toObject ? shipment.toObject() : shipment;
  return Object.fromEntries(
    Object.keys(publicProjection)
      .filter((key) => source?.[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
};

export const toBuyerPublic = (shipment) => {
  const source = shipment?.toObject ? shipment.toObject() : shipment;
  if (!source) return null;
  return {
    _id: source._id,
    orderId: source.orderId,
    status: source.status,
    estimatedDeliveryAt: source.estimatedDeliveryAt,
    pickedUpAt: source.pickedUpAt ?? null,
    deliveredAt: source.deliveredAt ?? null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

export const create = async (data, session) =>
  (await Shipment.create([data], { session }))[0];

export const listAvailable = (skip, limit, session) =>
  Shipment.find({
    ...originalPurposeFilter,
    status: 'READY_FOR_PICKUP',
    shipperId: null,
  })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .session(session || null)
    .lean();

export const countAvailable = (session) =>
  Shipment.countDocuments({
    ...originalPurposeFilter,
    status: 'READY_FOR_PICKUP',
    shipperId: null,
  }).session(session || null);

export const listByShipper = (shipperId, skip, limit, session) =>
  Shipment.find({
    ...originalPurposeFilter,
    shipperId,
    status: { $in: ['IN_TRANSIT', 'DELIVERED'] },
  })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .session(session || null)
    .lean();

export const countByShipper = (shipperId, session) =>
  Shipment.countDocuments({
    ...originalPurposeFilter,
    shipperId,
    status: { $in: ['IN_TRANSIT', 'DELIVERED'] },
  }).session(session || null);

export const listBySeller = (sellerId, skip, limit, session) =>
  Shipment.find({ sellerId, ...originalPurposeFilter })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .session(session || null)
    .lean();

export const countBySeller = (sellerId, session) =>
  Shipment.countDocuments({ sellerId, ...originalPurposeFilter }).session(
    session || null,
  );

export const findById = (id, session) =>
  Shipment.findById(id)
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findInternalById = (id, session) =>
  Shipment.findById(id)
    .select(internalProjection)
    .session(session || null)
    .lean();

export const findOriginalByOrderId = (orderId, session) =>
  Shipment.findOne({ orderId, ...originalPurposeFilter })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findByOrderId = findOriginalByOrderId;

export const findByOrderIds = (orderIds, session) =>
  Shipment.find({ orderId: { $in: orderIds }, ...originalPurposeFilter })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const listByOrderId = (orderId, session) =>
  Shipment.find({ orderId })
    .select(internalProjection)
    .sort({ createdAt: -1, _id: -1 })
    .session(session || null)
    .lean();

export const findByReplacementId = (replacementId, session) =>
  Shipment.findOne({ replacementId, purpose: 'REPLACEMENT' })
    .select(internalProjection)
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
