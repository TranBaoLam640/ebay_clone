import {
  body,
  collection,
  idParam,
  operation,
  pageParams,
  query,
  ref,
  response,
  security,
} from '../components/index.js';
export const sellerFeedbackPaths = {
  '/sellers/{sellerId}/feedbacks': {
    get: operation({
      tag: 'Seller Feedback',
      operationId: 'listSellerFeedbacks',
      summary: 'List public seller feedback',
      parameters: [
        idParam('sellerId'),
        ...pageParams,
        query('rating', { type: 'integer', minimum: 1, maximum: 5 }),
        query('sort', {
          type: 'string',
          enum: ['newest', 'oldest', 'rating_desc', 'rating_asc'],
        }),
      ],
      success: response('Seller feedback', collection('SellerFeedback'), true),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
  '/orders/{orderId}/seller-feedback': {
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'createSellerFeedback',
      summary: 'Review the seller for an order',
      parameters: [idParam('orderId')],
      requestBody: body({
        $ref: '#/components/schemas/CreateSellerFeedbackRequest',
      }),
      success: response('Seller feedback created', ref('SellerFeedback')),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/seller-feedbacks/{feedbackId}': {
    patch: operation({
      tag: 'Seller Feedback',
      operationId: 'updateSellerFeedback',
      summary: 'Update seller feedback',
      parameters: [idParam('feedbackId')],
      requestBody: body({
        $ref: '#/components/schemas/UpdateSellerFeedbackRequest',
      }),
      success: response('Seller feedback updated', ref('SellerFeedback')),
      errors: [400, 401, 403, 404, 413, 429, 500],
      security: security.unsafe,
    }),
    delete: operation({
      tag: 'Seller Feedback',
      operationId: 'deleteSellerFeedback',
      summary: 'Delete seller feedback',
      parameters: [idParam('feedbackId')],
      errors: [400, 401, 403, 404, 429, 500],
      security: security.unsafe,
    }),
  },
};
