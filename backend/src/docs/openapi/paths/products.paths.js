import {
  collection,
  idParam,
  operation,
  pageParams,
  query,
  ref,
  response,
} from '../components/index.js';

const objectId = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' };
export const productPaths = {
  '/products': {
    get: operation({
      tag: 'Products',
      operationId: 'listProducts',
      summary: 'Search and list products',
      parameters: [
        query('search', { type: 'string', minLength: 1, maxLength: 200 }),
        query('categoryId', objectId),
        query('sellerId', objectId),
        query('minPrice', { type: 'integer', minimum: 0 }),
        query('maxPrice', { type: 'integer', minimum: 0 }),
        query('inStock', { type: 'string', enum: ['true', 'false'] }),
        query('sort', {
          type: 'string',
          enum: ['newest', 'price_asc', 'price_desc', 'rating_desc'],
          default: 'newest',
        }),
        ...pageParams,
      ],
      success: response('Products', collection('ProductListItem'), true),
      errors: [400, 429, 500],
      security: [],
    }),
  },
  '/products/{productId}': {
    get: operation({
      tag: 'Products',
      operationId: 'getProduct',
      summary: 'Get product details',
      parameters: [idParam('productId')],
      success: response('Product', ref('ProductDetail')),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
};
