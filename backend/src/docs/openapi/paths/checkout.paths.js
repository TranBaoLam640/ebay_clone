import {
  body,
  operation,
  parameter,
  ref,
  response,
  security,
} from '../components/index.js';

const checkoutBody = body({ $ref: '#/components/schemas/CheckoutRequest' });

export const checkoutPaths = {
  '/checkout/preview': {
    post: operation({
      tag: 'Checkout',
      operationId: 'previewCheckout',
      summary: 'Preview checkout',
      description:
        'Returns current selected items, deterministic Seller groups and discount allocation, an owned safe Address snapshot, payment choices, totals, and stock warnings without writing business state.',
      requestBody: checkoutBody,
      success: response('Checkout preview', ref('CheckoutPreview')),
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/checkout': {
    post: operation({
      tag: 'Checkout',
      operationId: 'executeCheckout',
      summary: 'Create a transactional checkout',
      description:
        'Requires an Idempotency-Key. Creates one CheckoutGroup, Seller Orders, and a pending Payment after revalidating Cart, stock, Address, and Coupon state. Repeated completed requests with the same key and body replay the exact response.',
      parameters: [
        parameter(
          'Idempotency-Key',
          'header',
          { type: 'string', minLength: 1 },
          true,
          'Buyer-scoped key used to claim or replay final checkout.',
        ),
      ],
      requestBody: checkoutBody,
      success: response('Checkout created', ref('CheckoutGroupDetail')),
      successStatus: 201,
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
};
