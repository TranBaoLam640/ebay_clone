import { Payment } from './payment.model.js';

const publicProjection = {
  _id: 1,
  checkoutGroupId: 1,
  method: 1,
  status: 1,
  amount: 1,
  currency: 1,
  providerOrderId: 1,
  failureReason: 1,
  capturedAt: 1,
  confirmedAt: 1,
  failedAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const create = async (data, session) =>
  (await Payment.create([data], { session }))[0];

export const ownedByGroupInternal = (buyerId, checkoutGroupId, session) =>
  Payment.findOne({ buyerId, checkoutGroupId })
    .session(session || null)
    .lean();

export const ownedByGroup = (buyerId, checkoutGroupId, session) =>
  Payment.findOne({ buyerId, checkoutGroupId })
    .select(publicProjection)
    .session(session || null)
    .lean();

export const claimPayPalCreate = (
  buyerId,
  checkoutGroupId,
  claimToken,
  now,
  staleBefore,
) =>
  Payment.findOneAndUpdate(
    {
      buyerId,
      checkoutGroupId,
      method: 'PAYPAL',
      providerOrderId: null,
      $or: [
        { status: 'PENDING' },
        {
          status: 'PROVIDER_CREATING',
          providerCreateClaimedAt: { $lte: staleBefore },
        },
      ],
    },
    {
      status: 'PROVIDER_CREATING',
      providerCreateClaimToken: claimToken,
      providerCreateClaimedAt: now,
    },
    { returnDocument: 'after' },
  ).lean();

export const releasePayPalCreate = (id, claimToken) =>
  Payment.updateOne(
    {
      _id: id,
      method: 'PAYPAL',
      status: 'PROVIDER_CREATING',
      providerCreateClaimToken: claimToken,
    },
    {
      $set: { status: 'PENDING' },
      $unset: { providerCreateClaimToken: 1, providerCreateClaimedAt: 1 },
    },
  );

export const completePayPalCreate = (
  buyerId,
  checkoutGroupId,
  providerOrderId,
  claimToken,
  session,
) =>
  Payment.findOneAndUpdate(
    {
      buyerId,
      checkoutGroupId,
      method: 'PAYPAL',
      status: 'PROVIDER_CREATING',
      providerOrderId: null,
      providerCreateClaimToken: claimToken,
    },
    {
      $set: {
        status: 'CREATED',
        providerOrderId,
        providerCreateOutcome: 'CREATED',
        restorationStatus: 'PENDING',
      },
      $unset: { providerCreateClaimToken: 1, providerCreateClaimedAt: 1 },
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const claimPayPalCapture = (
  buyerId,
  checkoutGroupId,
  providerOrderId,
  claimToken,
  now,
  staleBefore,
) =>
  Payment.findOneAndUpdate(
    {
      buyerId,
      checkoutGroupId,
      providerOrderId,
      method: 'PAYPAL',
      $or: [
        { status: 'CREATED' },
        {
          status: 'PROVIDER_CAPTURING',
          providerCaptureClaimedAt: { $lte: staleBefore },
        },
      ],
    },
    {
      status: 'PROVIDER_CAPTURING',
      providerCaptureClaimToken: claimToken,
      providerCaptureClaimedAt: now,
    },
    { returnDocument: 'after' },
  ).lean();

export const releasePayPalCapture = (id, claimToken) =>
  Payment.updateOne(
    {
      _id: id,
      method: 'PAYPAL',
      status: 'PROVIDER_CAPTURING',
      providerCaptureClaimToken: claimToken,
    },
    {
      $set: { status: 'CREATED' },
      $unset: { providerCaptureClaimToken: 1, providerCaptureClaimedAt: 1 },
    },
  );

export const capture = (
  buyerId,
  checkoutGroupId,
  providerOrderId,
  claimToken,
  session,
) =>
  Payment.findOneAndUpdate(
    {
      buyerId,
      checkoutGroupId,
      providerOrderId,
      method: 'PAYPAL',
      status: 'PROVIDER_CAPTURING',
      providerCaptureClaimToken: claimToken,
    },
    {
      $set: {
        status: 'CAPTURED',
        providerCaptureOutcome: 'CAPTURED',
        capturedAt: new Date(),
      },
      $unset: { providerCaptureClaimToken: 1, providerCaptureClaimedAt: 1 },
    },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const confirmCod = (buyerId, checkoutGroupId, session) =>
  Payment.findOneAndUpdate(
    {
      buyerId,
      checkoutGroupId,
      method: 'COD',
      status: 'PENDING',
      providerOrderId: null,
    },
    { status: 'CONFIRMED', confirmedAt: new Date() },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

export const claimFailureRestoration = (
  buyerId,
  checkoutGroupId,
  providerOrderId,
  claimToken,
  reason,
  session,
) =>
  Payment.findOneAndUpdate(
    {
      buyerId,
      checkoutGroupId,
      providerOrderId,
      method: 'PAYPAL',
      status: 'PROVIDER_CAPTURING',
      providerCaptureClaimToken: claimToken,
      restorationStatus: 'PENDING',
    },
    {
      $set: {
        status: 'FAILED',
        providerCaptureOutcome: 'FAILED',
        failureReason: reason,
        failedAt: new Date(),
      },
      $unset: { providerCaptureClaimToken: 1, providerCaptureClaimedAt: 1 },
    },
    { session, returnDocument: 'after' },
  ).lean();

export const completeRestoration = (id, session) =>
  Payment.findOneAndUpdate(
    { _id: id, status: 'FAILED', restorationStatus: 'PENDING' },
    { restorationStatus: 'COMPLETED', restoredAt: new Date() },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();
