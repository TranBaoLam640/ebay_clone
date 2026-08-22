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
  resolutionMode: 1,
  resolutionModeUpdatedAt: 1,
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

const noResolutionModeFilter = {
  $or: [
    { resolutionMode: 'NONE' },
    { resolutionMode: { $exists: false } },
    { resolutionMode: null },
  ],
};

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

export const acquireReplacementResolution = (id, session, now = new Date()) =>
  INRRequest.findOneAndUpdate(
    { _id: id, status: 'OPEN', ...noResolutionModeFilter },
    {
      resolutionMode: 'REPLACEMENT',
      resolutionModeUpdatedAt: now,
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const requireReplacementResolution = (id, session) =>
  INRRequest.findOne({
    _id: id,
    status: 'OPEN',
    resolutionMode: 'REPLACEMENT',
  })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const releaseReplacementResolution = (id, session, now = new Date()) =>
  INRRequest.findOneAndUpdate(
    { _id: id, status: 'OPEN', resolutionMode: 'REPLACEMENT' },
    {
      resolutionMode: 'NONE',
      resolutionModeUpdatedAt: now,
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const acquireRefundResolution = (
  id,
  sellerId,
  session,
  now = new Date(),
) =>
  INRRequest.findOneAndUpdate(
    {
      _id: id,
      sellerId,
      status: 'OPEN',
      $or: [
        { resolutionMode: 'NONE' },
        { resolutionMode: 'REFUND' },
        { resolutionMode: { $exists: false } },
        { resolutionMode: null },
      ],
    },
    {
      resolutionMode: 'REFUND',
      resolutionModeUpdatedAt: now,
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const switchReplacementToRefund = (
  id,
  buyerId,
  session,
  now = new Date(),
) =>
  INRRequest.findOneAndUpdate(
    {
      _id: id,
      buyerId,
      status: 'OPEN',
      resolutionMode: 'REPLACEMENT',
    },
    {
      requestedResolution: 'REFUND',
      resolutionMode: 'REFUND',
      resolutionModeUpdatedAt: now,
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const sellerSwitchReplacementToRefund = (
  id,
  sellerId,
  session,
  now = new Date(),
) =>
  INRRequest.findOneAndUpdate(
    {
      _id: id,
      sellerId,
      status: 'OPEN',
      resolutionMode: 'REPLACEMENT',
    },
    {
      resolutionMode: 'REFUND',
      resolutionModeUpdatedAt: now,
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

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
