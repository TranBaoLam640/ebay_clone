import { idParam, operation, ref, response } from '../components/index.js';

export const sellerPaths = {
  '/sellers/{sellerId}': {
    get: operation({
      tag: 'Sellers',
      operationId: 'getSeller',
      summary: 'Get a seller profile',
      parameters: [idParam('sellerId')],
      success: response('Seller', ref('SellerProfile')),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
};
