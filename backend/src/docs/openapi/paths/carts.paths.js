import {
  body,
  idParam,
  operation,
  ref,
  response,
  security,
} from '../components/index.js';

const cartResponse = response('Current cart', ref('Cart'));

export const cartPaths = {
  '/cart': {
    get: operation({
      tag: 'Cart',
      operationId: 'getCart',
      summary: 'Get the current cart',
      description:
        'Hydrates raw Cart product references into nested safe product DTOs. An absent Cart returns an empty Cart with a null id.',
      success: cartResponse,
      errors: [401, 429, 500],
      security: security.access,
    }),
    delete: operation({
      tag: 'Cart',
      operationId: 'clearCart',
      summary: 'Clear the current cart',
      success: cartResponse,
      errors: [401, 429, 500],
      security: security.unsafe,
    }),
  },
  '/cart/items': {
    post: operation({
      tag: 'Cart',
      operationId: 'addCartItem',
      summary: 'Add a product to the cart',
      requestBody: body({ $ref: '#/components/schemas/CartItemRequest' }),
      success: cartResponse,
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/cart/items/{productId}': {
    patch: operation({
      tag: 'Cart',
      operationId: 'updateCartItem',
      summary: 'Set a cart item quantity',
      parameters: [idParam('productId')],
      requestBody: body({
        $ref: '#/components/schemas/UpdateCartItemRequest',
      }),
      success: cartResponse,
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
    delete: operation({
      tag: 'Cart',
      operationId: 'removeCartItem',
      summary: 'Remove a product from the cart',
      parameters: [idParam('productId')],
      success: cartResponse,
      errors: [400, 401, 404, 429, 500],
      security: security.unsafe,
    }),
  },
  '/cart/sync': {
    post: operation({
      tag: 'Cart',
      operationId: 'syncCart',
      summary: 'Merge local and server cart items',
      description:
        'Normalizes duplicate local products, merges eligible items, removes stale items, and returns deterministic response-only warnings that are never persisted.',
      requestBody: body({ $ref: '#/components/schemas/CartSyncRequest' }),
      success: response('Synchronized cart', ref('CartSyncResult')),
      errors: [400, 401, 413, 429, 500],
      security: security.unsafe,
    }),
  },
};
