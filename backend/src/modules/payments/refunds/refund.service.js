import { randomUUID } from 'node:crypto';
import { AppError } from '../../../common/errors/app-error.js';
import { ERROR_CODES } from '../../../common/constants/error-codes.js';
import {
  refundOrder as refundPayPalOrder,
  validRefundFailureOutcome,
  validRefundOutcome,
} from '../providers/paypal-simulation.provider.js';
import * as repository from './refund.repository.js';

const PROCESSING_LEASE_MS = 5 * 60_000;
const invalidState = (message) =>
  new AppError(409, ERROR_CODES.PAYMENT_INVALID_STATE, message);
const providerError = (message) =>
  new AppError(502, ERROR_CODES.PAYMENT_PROVIDER_ERROR, message);
const refundCapacityError = () =>
  invalidState('Refund amount exceeds remaining payment amount');

const sanitizedReason = (reason) =>
  typeof reason === 'string' && reason.trim()
    ? reason.trim().slice(0, 240)
    : 'Refund provider failed';

export const toPublic = repository.toPublic;
export const findBySource = repository.findBySource;
export const findById = repository.findById;

const claimRefund = async (data) => {
  const now = new Date();
  const claimToken = randomUUID();
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const existing = await repository.findInternalBySource(
    data.sourceType,
    data.sourceId,
  );
  if (existing?.status === 'COMPLETED')
    return { state: 'COMPLETED', refund: existing, claimToken: null };
  if (existing?.status === 'PROCESSING' && existing.providerRefundId)
    return { state: 'PROVIDER_COMPLETED', refund: existing, claimToken };
  if (!existing) {
    try {
      const refund = await repository.createProcessing(data, claimToken, now);
      return { state: 'CLAIMED', refund, claimToken };
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }
  const claimed = await repository.reclaimProcessable(
    data.sourceType,
    data.sourceId,
    data,
    claimToken,
    now,
    staleBefore,
  );
  if (!claimed) throw invalidState('Refund is already processing or completed');
  if (claimed.providerRefundId)
    return { state: 'PROVIDER_COMPLETED', refund: claimed, claimToken };
  return { state: 'CLAIMED', refund: claimed, claimToken };
};

const runProvider = async (refund, payment) => {
  if (payment.method === 'COD')
    return {
      providerRefundId: `COD-${refund._id}`,
      status: 'COMPLETED',
    };
  if (payment.method !== 'PAYPAL')
    throw invalidState('Payment method cannot be refunded');
  if (!payment.providerOrderId)
    throw invalidState('PayPal refund requires a provider order ID');
  const outcome = await refundPayPalOrder({
    providerOrderId: payment.providerOrderId,
    refundId: String(refund._id),
    amount: refund.amount,
    currency: refund.currency,
  });
  if (validRefundOutcome(outcome, payment.providerOrderId, refund))
    return outcome;
  if (validRefundFailureOutcome(outcome, payment.providerOrderId)) {
    throw providerError(sanitizedReason(outcome.reason));
  }
  throw providerError('PayPal refund returned an invalid outcome');
};

export const prepare = (data) => claimRefund(data);

const ensurePaymentCapacity = async (refund, payment, claimToken) => {
  const refunded = await repository.completedAmountForPayment(
    payment._id,
    refund._id,
  );
  if (refunded + refund.amount <= payment.amount) return;
  await repository.fail(
    refund._id,
    claimToken,
    'Refund amount exceeds remaining payment amount',
  );
  throw refundCapacityError();
};

export const processProvider = async ({ refund, payment, claimToken }) => {
  if (refund.providerRefundId) return refund;
  try {
    await ensurePaymentCapacity(refund, payment, claimToken);
    const outcome = await runProvider(refund, payment);
    return await repository.recordProviderSuccess(refund._id, claimToken, {
      providerRefundId: outcome.providerRefundId,
    });
  } catch (error) {
    await repository.fail(
      refund._id,
      claimToken,
      sanitizedReason(error.message),
    );
    throw error;
  }
};

export const complete = (refund, session, now = new Date()) =>
  repository.complete(
    refund._id,
    {
      completedAt: now,
      providerRefundId: refund.providerRefundId,
    },
    session,
  );
