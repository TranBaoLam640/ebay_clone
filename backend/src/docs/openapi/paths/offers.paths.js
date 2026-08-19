import {
  body,
  collection,
  operation,
  parameter,
  ref,
  response,
  security,
} from '../components/index.js';

const productUuidParam = parameter(
  'productId',
  'path',
  { type: 'string', format: 'uuid' },
  true,
  'Public product UUID.',
);
const offerIdParam = parameter(
  'offerId',
  'path',
  ref('ObjectId'),
  true,
  'Offer identifier.',
);

export const offerPaths = {
  '/products/{productId}/offers': {
    post: operation({
      tag: 'Offers',
      operationId: 'createProductOffer',
      summary: 'Make an offer on a listing',
      description:
        'Creates a buyer Best Offer on an offer-enabled fixed-price product.',
      parameters: [productUuidParam],
      requestBody: body({
        $ref: '#/components/schemas/CreateProductOfferRequest',
      }),
      success: response('Offer', ref('Offer')),
      successStatus: 201,
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/me/offers': {
    get: operation({
      tag: 'Offers',
      operationId: 'listMyOffers',
      summary: 'List my offers',
      success: response('Offers', collection('Offer')),
      errors: [401, 429, 500],
      security: security.access,
    }),
  },
  '/me/offers/{offerId}': {
    delete: operation({
      tag: 'Offers',
      operationId: 'withdrawOffer',
      summary: 'Withdraw a pending offer',
      parameters: [offerIdParam],
      success: response('Offer status', ref('Offer')),
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/offers/{offerId}/accept': {
    post: operation({
      tag: 'Offers',
      operationId: 'acceptOffer',
      summary: 'Accept a pending offer',
      description:
        'Resolves a pending offer as ACCEPTED and emits offer:updated to the conversation room.',
      parameters: [offerIdParam],
      success: response('Offer', ref('Offer')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/offers/{offerId}/decline': {
    post: operation({
      tag: 'Offers',
      operationId: 'declineOffer',
      summary: 'Decline a pending offer',
      description:
        'Resolves a pending offer as DECLINED and emits offer:updated to the conversation room.',
      parameters: [offerIdParam],
      success: response('Offer', ref('Offer')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/offers/{offerId}/counter': {
    post: operation({
      tag: 'Offers',
      operationId: 'counterOffer',
      summary: 'Counter a pending offer',
      description:
        'Marks the parent offer COUNTERED, creates a new pending counter offer message, and emits offer/message realtime events.',
      parameters: [offerIdParam],
      requestBody: body({
        $ref: '#/components/schemas/ConversationOfferRequest',
      }),
      success: response('Offer', ref('Offer')),
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/offers/{offerId}/retract': {
    post: operation({
      tag: 'Offers',
      operationId: 'retractOffer',
      summary: 'Retract a pending offer or counteroffer',
      description:
        'Allows only the sender of a still-pending conversation proposal to mark it WITHDRAWN and emits offer:updated to the conversation room. The original amount and chat history remain unchanged.',
      parameters: [offerIdParam],
      success: response('Offer', ref('Offer')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
};
