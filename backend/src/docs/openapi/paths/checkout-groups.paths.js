import {
  idParam,
  operation,
  ref,
  response,
  security,
} from '../components/index.js';

export const checkoutGroupPaths = {
  '/checkout-groups/{checkoutGroupId}': {
    get: operation({
      tag: 'Checkout Groups',
      operationId: 'getCheckoutGroup',
      summary: 'Get an owned checkout group',
      success: response(
        'Checkout group with Orders and Payment',
        ref('CheckoutGroupDetail'),
      ),
      parameters: [idParam('checkoutGroupId')],
      errors: [400, 401, 404, 429, 500],
      security: security.access,
    }),
  },
};
