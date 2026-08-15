import { env } from '../../../config/env.js';

const assertEnabled = () => {
  if (!env.PAYPAL_SIMULATION_ENABLED)
    throw new Error('PayPal simulation is disabled');
};

export const createOrder = async ({ checkoutGroupId, amount, currency }) => {
  assertEnabled();
  return {
    providerOrderId: `SIM-${checkoutGroupId}`,
    status: 'CREATED',
    amount,
    currency,
  };
};

export const captureOrder = async (providerOrderId) => {
  assertEnabled();
  return { providerOrderId, status: 'CAPTURED' };
};

export const validCreateOutcome = (outcome, expected) =>
  outcome?.status === 'CREATED' &&
  typeof outcome.providerOrderId === 'string' &&
  Boolean(outcome.providerOrderId) &&
  outcome.amount === expected.amount &&
  outcome.currency === expected.currency;

export const validCaptureOutcome = (outcome, providerOrderId) =>
  outcome?.status === 'CAPTURED' && outcome.providerOrderId === providerOrderId;

export const validFailureOutcome = (outcome, providerOrderId, reason) =>
  outcome?.status === 'FAILED' &&
  outcome.providerOrderId === providerOrderId &&
  typeof reason === 'string' &&
  Boolean(reason.trim()) &&
  outcome.reason === reason;
