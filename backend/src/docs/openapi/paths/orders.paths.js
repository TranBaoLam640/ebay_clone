import {
  body,
  collection,
  idParam,
  object,
  operation,
  pageParams,
  query,
  ref,
  response,
  security,
} from '../components/index.js';

const orderStatuses = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PAYMENT_FAILED',
  'DELIVERED',
];

export const orderPaths = {
  '/orders': {
    get: operation({
      tag: 'Orders',
      operationId: 'listOrders',
      summary: 'List owned orders',
      parameters: [
        query('status', { type: 'string', enum: orderStatuses }),
        query('sellerId', { $ref: '#/components/schemas/ObjectId' }),
        query('from', { type: 'string', format: 'date-time' }),
        query('to', { type: 'string', format: 'date-time' }),
        query('sort', {
          type: 'string',
          enum: ['newest', 'oldest'],
          default: 'newest',
        }),
        ...pageParams,
      ],
      success: response('Orders', collection('Order'), true),
      errors: [400, 401, 429, 500],
      security: security.access,
    }),
  },
  '/orders/{orderId}': {
    get: operation({
      tag: 'Orders',
      operationId: 'getOrder',
      summary: 'Get an owned order',
      parameters: [idParam('orderId')],
      success: response('Order', ref('Order')),
      errors: [400, 401, 404, 429, 500],
      security: security.access,
    }),
  },
  '/orders/{orderId}/checkout': {
    post: operation({
      tag: 'Orders',
      operationId: 'checkoutOrder',
      summary: 'Check out a standalone win order',
      description:
        'Pay for an existing PENDING_PAYMENT order that has no checkout group — an auction or Buy It Now win. Wraps it in a fresh CheckoutGroup and pending Payment with the chosen address, then the normal COD/PayPal payment endpoints finalize it. Idempotent: an order already attached to a group returns that group.',
      parameters: [idParam('orderId')],
      requestBody: body(
        object(
          {
            addressId: ref('ObjectId'),
            paymentMethod: { type: 'string', enum: ['COD', 'PAYPAL'] },
          },
          ['addressId', 'paymentMethod'],
        ),
      ),
      success: response('Checkout created', ref('CheckoutGroupDetail')),
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
};
