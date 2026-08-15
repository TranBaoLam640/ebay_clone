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

const reviewBody = {
  rating: { type: 'integer', minimum: 1, maximum: 5 },
  comment: { type: 'string', maxLength: 2000 },
};
export const productReviewPaths = {
  '/products/{productId}/reviews': {
    get: operation({
      tag: 'Product Reviews',
      operationId: 'listProductReviews',
      summary: 'List product reviews',
      parameters: [
        idParam('productId'),
        ...pageParams,
        query('rating', { type: 'integer', minimum: 1, maximum: 5 }),
        query('sort', {
          type: 'string',
          enum: ['newest', 'oldest', 'rating_desc', 'rating_asc'],
        }),
      ],
      success: response('Product reviews', collection('ProductReview'), true),
      errors: [400, 429, 500],
      security: [],
    }),
    post: operation({
      tag: 'Product Reviews',
      operationId: 'createProductReview',
      summary: 'Review a purchased product',
      parameters: [idParam('productId')],
      requestBody: body(
        object(
          {
            orderId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
            orderItemId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
            ...reviewBody,
          },
          ['orderId', 'orderItemId', 'rating'],
        ),
      ),
      success: response('Review created', ref('ProductReview')),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/product-reviews/{reviewId}': {
    patch: operation({
      tag: 'Product Reviews',
      operationId: 'updateProductReview',
      summary: 'Update a product review',
      parameters: [idParam('reviewId')],
      requestBody: body({
        $ref: '#/components/schemas/UpdateProductReviewRequest',
      }),
      success: response('Review updated', ref('ProductReview')),
      errors: [400, 401, 403, 404, 413, 429, 500],
      security: security.unsafe,
    }),
    delete: operation({
      tag: 'Product Reviews',
      operationId: 'deleteProductReview',
      summary: 'Delete a product review',
      parameters: [idParam('reviewId')],
      errors: [400, 401, 403, 404, 429, 500],
      security: security.unsafe,
    }),
  },
};
