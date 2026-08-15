import {
  body,
  operation,
  ref,
  response,
  security,
} from '../components/index.js';

const paymentActionBody = body({
  $ref: '#/components/schemas/PaymentActionRequest',
});

const paymentAction = (operationId, summary, description) =>
  operation({
    tag: 'Payments',
    operationId,
    summary,
    description,
    requestBody: paymentActionBody,
    success: response('Payment', ref('Payment')),
    errors: [400, 401, 404, 409, 413, 429, 500, 502],
    security: security.unsafe,
  });

export const paymentPaths = {
  '/payments/paypal/create': {
    post: paymentAction(
      'createPayPalPayment',
      'Create a simulated PayPal order',
      'Accepts checkoutGroupId only. Verifies Buyer ownership, PAYPAL method, and pending state before invoking the simulation provider and persisting a validated provider order ID.',
    ),
  },
  '/payments/paypal/capture': {
    post: paymentAction(
      'capturePayPalPayment',
      'Capture a simulated PayPal order',
      'Accepts checkoutGroupId only. Captures an owned created PayPal Payment by using the persisted provider order ID with the simulation provider. A valid provider failure result marks payment state failed and restores stock and Coupon usage exactly once.',
    ),
  },
  '/payments/cod/confirm': {
    post: paymentAction(
      'confirmCodPayment',
      'Confirm a COD payment',
      'Accepts checkoutGroupId only. Confirms an owned pending COD Payment and its CheckoutGroup and Orders.',
    ),
  },
};
