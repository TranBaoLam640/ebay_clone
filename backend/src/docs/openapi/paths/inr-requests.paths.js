import {
  body,
  collection,
  operation,
  parameter,
  query,
  ref,
  response,
  security,
  pageParams,
} from '../components/index.js';

const requestId = parameter('requestId', 'path', ref('ObjectId'));
const status = query('status', {
  type: 'string',
  enum: ['OPEN', 'CLOSED'],
});

export const inrRequestPaths = {
  '/inr-requests': {
    post: operation({
      tag: 'INR Requests',
      operationId: 'createINRRequest',
      summary: 'Create an Item Not Received request',
      description:
        'Creates one OPEN INR per owned OrderItem when the canonical Shipment ETA has passed and the configured INR window has not expired. This snapshots item value only; it does not process a refund.',
      requestBody: body({ $ref: '#/components/schemas/CreateINRRequest' }),
      success: response('INR request created', ref('INRBuyerRequest')),
      successStatus: 201,
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
    get: operation({
      tag: 'INR Requests',
      operationId: 'listBuyerINRRequests',
      summary: 'List buyer INR requests',
      parameters: [status, ...pageParams],
      success: response(
        'Buyer INR requests',
        collection('INRBuyerRequest'),
        true,
      ),
      errors: [400, 401, 429, 500],
      security: security.access,
    }),
  },
  '/inr-requests/seller': {
    get: operation({
      tag: 'INR Requests',
      operationId: 'listSellerINRRequests',
      summary: 'List seller INR requests',
      parameters: [status, ...pageParams],
      success: response(
        'Seller INR requests',
        collection('INRSellerRequest'),
        true,
      ),
      errors: [400, 401, 429, 500],
      security: security.access,
    }),
  },
  '/inr-requests/{requestId}': {
    get: operation({
      tag: 'INR Requests',
      operationId: 'getINRRequest',
      summary: 'Get an INR request as buyer or seller',
      parameters: [requestId],
      success: response('INR request', ref('INRBuyerRequest')),
      errors: [400, 401, 404, 429, 500],
      security: security.access,
    }),
  },
  '/inr-requests/{requestId}/close': {
    patch: operation({
      tag: 'INR Requests',
      operationId: 'closeINRRequest',
      summary: 'Close an open INR when the item arrived',
      parameters: [requestId],
      success: response('Closed INR request', ref('INRBuyerRequest')),
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/inr-requests/{requestId}/tracking-evidence': {
    patch: operation({
      tag: 'INR Requests',
      operationId: 'updateINRTrackingEvidence',
      summary: 'Append seller INR tracking evidence',
      description:
        'Owning seller appends carrier/tracking evidence to the INR history. Canonical Shipment carrier and trackingNumber are not modified.',
      parameters: [requestId],
      requestBody: body({
        $ref: '#/components/schemas/INRTrackingEvidenceRequest',
      }),
      success: response('INR request with evidence', ref('INRSellerRequest')),
      errors: [400, 401, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
};
