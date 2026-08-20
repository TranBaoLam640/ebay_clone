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

export const shipmentPaths = {
  '/shipments': {
    get: operation({
      tag: 'Shipments',
      operationId: 'listShipperShipments',
      summary: 'List SHIPPER shipment queues',
      description:
        'SHIPPER-only queue read. `available` returns READY_FOR_PICKUP shipments with no shipper assigned. `mine` returns IN_TRANSIT and DELIVERED shipments assigned to the authenticated shipper.',
      parameters: [
        query('scope', {
          type: 'string',
          enum: ['available', 'mine'],
          default: 'available',
        }),
        ...pageParams,
      ],
      success: response('Shipments', collection('Shipment'), true),
      errors: [400, 401, 403, 429, 500],
      security: security.access,
    }),
  },
  '/shipments/{shipmentId}/pickup': {
    patch: operation({
      tag: 'Shipments',
      operationId: 'pickupShipment',
      summary: 'Claim and pick up a shipment',
      description:
        'SHIPPER-only action. Atomically changes READY_FOR_PICKUP with no shipper assigned to IN_TRANSIT assigned to the authenticated shipper.',
      parameters: [idParam('shipmentId')],
      success: response('Shipment picked up', ref('Shipment')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
  '/shipments/{shipmentId}/deliver': {
    patch: operation({
      tag: 'Shipments',
      operationId: 'deliverShipment',
      summary: 'Mark a shipment delivered',
      description:
        'SHIPPER-only action for the same shipper who picked up the shipment. Transactionally changes IN_TRANSIT to DELIVERED and synchronizes the associated Order to DELIVERED with the same deliveredAt timestamp.',
      parameters: [idParam('shipmentId')],
      success: response('Shipment delivered', ref('Shipment')),
      errors: [400, 401, 403, 404, 409, 429, 500],
      security: security.unsafe,
    }),
  },
};
