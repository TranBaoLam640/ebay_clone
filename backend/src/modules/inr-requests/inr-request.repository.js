import { INRRequest } from './inr-request.model.js';

const publicProjection = {
  _id: 1,
  buyerId: 1,
  sellerId: 1,
  orderId: 1,
  orderItemId: 1,
  productId: 1,
  shipmentId: 1,
  requestedResolution: 1,
  quantityMissing: 1,
  details: 1,
  requestAmount: 1,
  currency: 1,
  conversationId: 1,
  refundId: 1,
  status: 1,
  trackingEvidenceHistory: 1,
  closedAt: 1,
  closeReason: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const create = async (data, session) =>
  (await INRRequest.create([data], { session }))[0];

export const listByBuyer = (buyerId, { status }, skip, limit) => {
  const filter = { buyerId };
  if (status) filter.status = status;
  return INRRequest.find(filter)
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const countByBuyer = (buyerId, { status }) => {
  const filter = { buyerId };
  if (status) filter.status = status;
  return INRRequest.countDocuments(filter);
};

export const listBySeller = (sellerId, { status }, skip, limit) => {
  const filter = { sellerId };
  if (status) filter.status = status;
  return INRRequest.find(filter)
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

export const countBySeller = (sellerId, { status }) => {
  const filter = { sellerId };
  if (status) filter.status = status;
  return INRRequest.countDocuments(filter);
};

export const findById = (id, session) =>
  INRRequest.findById(id)
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findOwnedByBuyer = (buyerId, id, session) =>
  INRRequest.findOne({ _id: id, buyerId })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findOwnedBySeller = (sellerId, id, session) =>
  INRRequest.findOne({ _id: id, sellerId })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const appendTrackingEvidence = (id, sellerId, evidence, session) =>
  INRRequest.findOneAndUpdate(
    { _id: id, sellerId, status: 'OPEN' },
    { $push: { trackingEvidenceHistory: evidence } },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const closeOpenRequest = (
  id,
  buyerId,
  { closedAt, closeReason },
  session,
) =>
  INRRequest.findOneAndUpdate(
    { _id: id, buyerId, status: 'OPEN' },
    { status: 'CLOSED', closedAt, closeReason },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const closeOpenRequestForRefund = (
  id,
  sellerId,
  { closedAt, closeReason, refundId },
  session,
) =>
  INRRequest.findOneAndUpdate(
    { _id: id, sellerId, status: 'OPEN' },
    { status: 'CLOSED', closedAt, closeReason, refundId },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();
