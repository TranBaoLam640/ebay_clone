import { Refund } from './refund.model.js';

const publicProjection = {
  _id: 1,
  paymentId: 1,
  checkoutGroupId: 1,
  buyerId: 1,
  sellerId: 1,
  sourceType: 1,
  sourceId: 1,
  amount: 1,
  currency: 1,
  method: 1,
  status: 1,
  providerRefundId: 1,
  failureReason: 1,
  completedAt: 1,
  failedAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const toPublic = (refund) => {
  if (!refund) return null;
  return {
    id: String(refund._id),
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
    method: refund.method,
    completedAt: refund.completedAt ?? null,
    createdAt: refund.createdAt,
    updatedAt: refund.updatedAt,
  };
};

export const findById = (id, session) =>
  Refund.findById(id)
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findBySource = (sourceType, sourceId, session) =>
  Refund.findOne({ sourceType, sourceId })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const findInternalBySource = (sourceType, sourceId, session) =>
  Refund.findOne({ sourceType, sourceId })
    .session(session || null)
    .lean();

export const completedAmountForPayment = async (
  paymentId,
  excludeRefundId,
  session,
) => {
  const match = { paymentId, status: 'COMPLETED' };
  if (excludeRefundId) match._id = { $ne: excludeRefundId };
  const [result] = await Refund.aggregate([
    { $match: match },
    { $group: { _id: '$paymentId', amount: { $sum: '$amount' } } },
  ]).session(session || null);
  return result?.amount ?? 0;
};

export const createProcessing = async (data, claimToken, now) =>
  (
    await Refund.create([
      {
        ...data,
        status: 'PROCESSING',
        processingClaimToken: claimToken,
        processingClaimedAt: now,
      },
    ])
  )[0].toObject();

export const reclaimProcessable = (
  sourceType,
  sourceId,
  data,
  claimToken,
  now,
  staleBefore,
) =>
  Refund.findOneAndUpdate(
    {
      sourceType,
      sourceId,
      status: { $in: ['FAILED', 'PROCESSING'] },
      $or: [
        { status: 'FAILED' },
        { processingClaimedAt: { $lte: staleBefore } },
        { providerRefundId: { $type: 'string' } },
      ],
    },
    {
      $set: {
        ...data,
        status: 'PROCESSING',
        processingClaimToken: claimToken,
        processingClaimedAt: now,
      },
      $unset: {
        failureReason: 1,
        failedAt: 1,
      },
    },
    { returnDocument: 'after' },
  ).lean();

export const recordProviderSuccess = (id, claimToken, { providerRefundId }) =>
  Refund.findOneAndUpdate(
    {
      _id: id,
      status: 'PROCESSING',
      processingClaimToken: claimToken,
    },
    { $set: { providerRefundId } },
    { returnDocument: 'after' },
  ).lean();

export const complete = (id, { completedAt, providerRefundId }, session) =>
  Refund.findOneAndUpdate(
    {
      _id: id,
      status: 'PROCESSING',
      ...(providerRefundId ? { providerRefundId } : {}),
    },
    {
      $set: {
        status: 'COMPLETED',
        completedAt,
        ...(providerRefundId ? { providerRefundId } : {}),
      },
      $unset: { processingClaimToken: 1, processingClaimedAt: 1 },
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const fail = (id, claimToken, reason) =>
  Refund.findOneAndUpdate(
    {
      _id: id,
      status: 'PROCESSING',
      processingClaimToken: claimToken,
    },
    {
      $set: {
        status: 'FAILED',
        failureReason: reason,
        failedAt: new Date(),
      },
      $unset: { processingClaimToken: 1, processingClaimedAt: 1 },
    },
    { returnDocument: 'after', projection: publicProjection },
  ).lean();
