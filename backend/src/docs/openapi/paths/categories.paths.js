import {
  idParam,
  operation,
  query,
  ref,
  response,
} from '../components/index.js';

export const categoryPaths = {
  '/categories': {
    get: operation({
      tag: 'Categories',
      operationId: 'listCategories',
      summary: 'List categories',
      parameters: [
        query('parentId', { type: 'string', pattern: '^[a-fA-F0-9]{24}$' }),
      ],
      success: response('Categories', {
        type: 'array',
        items: ref('Category'),
      }),
      errors: [400, 429, 500],
      security: [],
    }),
  },
  '/categories/{categoryId}': {
    get: operation({
      tag: 'Categories',
      operationId: 'getCategory',
      summary: 'Get a category',
      parameters: [idParam('categoryId')],
      success: response('Category', ref('Category')),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
};
