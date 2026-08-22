export const SHIPMENT_CARRIERS = Object.freeze({
  SBAY_EXPRESS: 'SBay Express',
});

export const SHIPMENT_STATUSES = Object.freeze([
  'READY_FOR_PICKUP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
]);

export const SHIPMENT_PURPOSES = Object.freeze(['ORIGINAL', 'REPLACEMENT']);

export const SHIPMENT_TRANSITIONS = Object.freeze({
  READY_FOR_PICKUP: Object.freeze(['IN_TRANSIT', 'CANCELLED']),
  IN_TRANSIT: Object.freeze(['DELIVERED']),
  DELIVERED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
});

export const TRACKING_PREFIX = 'SBAY';
