import {
  collection,
  idParam,
  operation,
  pageParams,
  query,
  ref,
  response,
} from '../components/index.js';

export const catalogProductPaths = {
  '/catalog-products': {
    get: operation({
      tag: 'Catalog Products',
      operationId: 'listCatalogProducts',
      summary: 'List shared catalog products',
      parameters: [
        query('q', { type: 'string', minLength: 1, maxLength: 200 }),
        query('ePID', { type: 'string', minLength: 1, maxLength: 100 }),
        query('brand', { type: 'string', minLength: 1, maxLength: 120 }),
        query('model', { type: 'string', minLength: 1, maxLength: 120 }),
        ...pageParams,
      ],
      success: response('Catalog products', collection('CatalogProduct'), true),
      errors: [400, 429, 500],
      security: [],
    }),
  },
  '/catalog-products/{catalogProductId}': {
    get: operation({
      tag: 'Catalog Products',
      operationId: 'getCatalogProduct',
      summary: 'Get shared catalog product details',
      parameters: [idParam('catalogProductId')],
      success: response('Catalog product', ref('CatalogProduct')),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
};
