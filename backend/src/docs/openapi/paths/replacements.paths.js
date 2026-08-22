import {
  operation,
  parameter,
  ref,
  response,
  security,
} from '../components/index.js';

const replacementId = parameter('replacementId', 'path', ref('ObjectId'));

export const replacementPaths = {
  '/replacements/{replacementId}/accept': {
    post: operation({
      tag: 'INR Requests',
      operationId: 'acceptReplacement',
      summary: 'Accept a proposed INR replacement',
      description:
        'Counterparty-only action. Delegates to ReplacementService.accept for authorization, resolution-mode validation, atomic stock claim, and replacement transition.',
      parameters: [replacementId],
      success: response('Replacement card state', ref('ReplacementChatCard')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/replacements/{replacementId}/decline': {
    post: operation({
      tag: 'INR Requests',
      operationId: 'declineReplacement',
      summary: 'Decline a proposed INR replacement',
      description:
        'Counterparty-only action. Delegates to ReplacementService.decline for authorization, guarded terminal transition, and replacement resolution release.',
      parameters: [replacementId],
      success: response('Replacement card state', ref('ReplacementChatCard')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/replacements/{replacementId}/shipment': {
    post: operation({
      tag: 'INR Requests',
      operationId: 'prepareReplacementShipment',
      summary: 'Prepare a shipment for an accepted INR replacement',
      description:
        'Owning seller-only action. Delegates to ReplacementService.prepareShipment for authorization, replacement resolution validation, duplicate shipment protection, and replacement shipment creation.',
      parameters: [replacementId],
      success: response(
        'Prepared replacement shipment',
        ref('PrepareReplacementShipmentResponse'),
      ),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/replacements/{replacementId}/confirm-received': {
    post: operation({
      tag: 'INR Requests',
      operationId: 'confirmReplacementReceived',
      summary: 'Confirm receipt of a delivered INR replacement',
      description:
        'Buyer-only action. The server derives all business state and requires an open replacement-mode INR, a fulfilling replacement with consumed inventory, and a delivered replacement shipment. No request body fields can set status, close reason, or timestamps.',
      parameters: [replacementId],
      success: response(
        'Completed replacement confirmation',
        ref('ConfirmReplacementReceivedResponse'),
      ),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
};
