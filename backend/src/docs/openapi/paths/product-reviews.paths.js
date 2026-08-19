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
  title: { type: 'string', minLength: 1, maxLength: 120 },
  description: { type: 'string', minLength: 1, maxLength: 2000 },
};
export const productReviewPaths = {
  '/products/{productId}/review-summary': {
    get: operation({
      tag: 'Product Reviews',
      operationId: 'getProductReviewSummary',
      summary: 'Get shared catalog product review summary',
      parameters: [idParam('productId')],
      success: response('Product review summary', ref('ProductReviewSummary')),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
  '/products/{productId}/reviews': {
    get: operation({
      tag: 'Product Reviews',
      operationId: 'listProductReviews',
      summary: 'List product reviews',
      parameters: [
        idParam('productId'),
        ...pageParams,
        query('q', {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description:
            'Searches product review title and description; legacy comments are included for compatibility.',
        }),
        query('rating', { type: 'integer', minimum: 1, maximum: 5 }),
        query('sort', {
          type: 'string',
          enum: [
            'newest',
            'oldest',
            'highest',
            'lowest',
            'rating_desc',
            'rating_asc',
          ],
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
          ['orderId', 'orderItemId', 'rating', 'title', 'description'],
        ),
      ),
      success: response('Review created', ref('ProductReview')),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
      deprecated: true,
    }),
  },
  '/orders/{orderId}/items/{orderItemId}/product-review': {
    post: operation({
      tag: 'Product Reviews',
      operationId: 'createOrderItemProductReview',
      summary: 'Review a delivered order item product',
      parameters: [idParam('orderId'), idParam('orderItemId')],
      requestBody: body({
        $ref: '#/components/schemas/CreateOrderItemProductReviewRequest',
      }),
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
