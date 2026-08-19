import {
  collection,
  idParam,
  operation,
  pageParams,
  query,
  ref,
  response,
  security,
} from '../components/index.js';

const jsonBody = (schemaRef) => ({
  required: true,
  content: {
    'application/json': { schema: schemaRef },
    'multipart/form-data': {
      schema: {
        allOf: [
          schemaRef,
          {
            type: 'object',
            properties: {
              images: {
                type: 'array',
                maxItems: 5,
                items: { type: 'string', format: 'binary' },
              },
            },
          },
        ],
      },
    },
  },
});

const body = (schemaRef) => ({
  required: true,
  content: { 'application/json': { schema: schemaRef } },
});

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
        query('commentType', {
          type: 'string',
          enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
          description:
            'Filters BUYER seller feedback by sentiment. Public seller reputation feedback excludes AUTOMATED feedback.',
        }),
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
  '/sellers/{sellerId}/feedback-summary': {
    get: operation({
      tag: 'Seller Feedback',
      operationId: 'getSellerFeedbackSummary',
      summary: 'Get seller feedback summary',
      description:
        'Seller reputation summary derived from BUYER SellerFeedback only. AUTOMATED feedback is excluded; neutral feedback is excluded from the positive percentage denominator.',
      parameters: [idParam('sellerId')],
      success: response(
        'Seller feedback summary',
        ref('SellerFeedbackSummary'),
      ),
      errors: [400, 404, 429, 500],
      security: [],
    }),
  },
  '/seller-feedbacks/awaiting': {
    get: operation({
      tag: 'Seller Feedback',
      operationId: 'listAwaitingSellerFeedback',
      summary: 'List delivered order items awaiting seller feedback',
      success: response(
        'Order items awaiting seller feedback',
        collection('AwaitingSellerFeedbackItem'),
      ),
      errors: [401, 429, 500],
      security: security.access,
    }),
  },
  '/orders/{orderId}/seller-feedback': {
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'createSellerFeedback',
      summary: 'Review the seller for a single-item order',
      description:
        'Legacy whole-order route retained for compatibility. Prefer POST /orders/{orderId}/items/{orderItemId}/seller-feedback.',
      parameters: [idParam('orderId')],
      requestBody: jsonBody({
        $ref: '#/components/schemas/CreateLegacySellerFeedbackRequest',
      }),
      success: response('Seller feedback created', ref('SellerFeedback')),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/orders/{orderId}/items/{orderItemId}/seller-feedback': {
    get: operation({
      tag: 'Seller Feedback',
      operationId: 'getOrderItemSellerFeedback',
      summary: 'Get seller feedback for an order item',
      parameters: [idParam('orderId'), idParam('orderItemId')],
      success: response('Seller feedback lookup', ref('SellerFeedbackLookup')),
      errors: [400, 401, 403, 404, 429, 500],
      security: security.access,
    }),
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'createOrderItemSellerFeedback',
      summary: 'Review the seller for an order item',
      description:
        'Creates BUYER seller feedback for a delivered order item. If a project demo automated POSITIVE feedback already exists, this manual buyer feedback atomically replaces it and preserves the same orderId + orderItemId identity.',
      parameters: [idParam('orderId'), idParam('orderItemId')],
      requestBody: jsonBody({
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
      summary: 'Rejected direct seller feedback edit',
      description:
        'Deprecated public route. Submitted BUYER feedback is immutable and cannot be edited directly; revision ACCEPT remains the supported path for changing canonical feedback fields.',
      deprecated: true,
      parameters: [idParam('feedbackId')],
      requestBody: body({
        $ref: '#/components/schemas/UpdateSellerFeedbackRequest',
      }),
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
    delete: operation({
      tag: 'Seller Feedback',
      operationId: 'deleteSellerFeedback',
      summary: 'Rejected direct seller feedback delete',
      description:
        'Deprecated public route. Submitted BUYER feedback cannot be deleted directly.',
      deprecated: true,
      parameters: [idParam('feedbackId')],
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/seller-feedbacks/{feedbackId}/follow-up': {
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'addSellerFeedbackFollowUp',
      summary: 'Add a buyer follow-up comment',
      description:
        'Buyer-only one-time follow-up for submitted BUYER feedback. It is immutable, text-only, separate from revision, and does not change commentType, original commentText, DSR, images, submittedAt, or revision state.',
      parameters: [idParam('feedbackId')],
      requestBody: body({
        $ref: '#/components/schemas/SellerFeedbackFollowUpRequest',
      }),
      success: response('Follow-up comment created', ref('SellerFeedback')),
      successStatus: 201,
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/seller-feedbacks/{feedbackId}/response': {
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'respondToSellerFeedback',
      summary: 'Respond to seller feedback',
      parameters: [idParam('feedbackId')],
      requestBody: body({
        $ref: '#/components/schemas/SellerFeedbackResponseRequest',
      }),
      success: response(
        'Seller feedback response created',
        ref('SellerFeedback'),
      ),
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/seller-feedbacks/{feedbackId}/revision-request': {
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'createFeedbackRevisionRequest',
      summary: 'Request a feedback revision',
      description:
        'Seller-only request for BUYER NEUTRAL or NEGATIVE feedback. One revision request total per feedback. Request must be within 30 days of submittedAt, falling back to createdAt for legacy feedback. No yearly quota is implemented.',
      parameters: [idParam('feedbackId')],
      requestBody: body({
        $ref: '#/components/schemas/CreateFeedbackRevisionRequest',
      }),
      success: response(
        'Feedback revision request created',
        ref('SellerFeedback'),
      ),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/seller-feedbacks/{feedbackId}/revision-request/respond': {
    post: operation({
      tag: 'Seller Feedback',
      operationId: 'respondToFeedbackRevisionRequest',
      summary: 'Accept or decline a feedback revision request',
      description:
        'Buyer-only decision for a PENDING revision request before expiresAt. ACCEPT updates canonical feedback fields and leaves images unchanged. DECLINE keeps original feedback unchanged. PENDING requests expire after 10 days.',
      parameters: [idParam('feedbackId')],
      requestBody: body({
        $ref: '#/components/schemas/FeedbackRevisionDecisionRequest',
      }),
      success: response(
        'Feedback revision request responded to',
        ref('SellerFeedback'),
      ),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
};
