export const INR_STATUSES = Object.freeze(['OPEN', 'CLOSED']);

export const INR_REQUESTED_RESOLUTIONS = Object.freeze(['REFUND', 'WANT_ITEM']);

export const INR_RESOLUTION_MODES = Object.freeze([
  'NONE',
  'REPLACEMENT',
  'REFUND',
]);

export const INR_CLOSE_REASONS = Object.freeze({
  ITEM_ARRIVED: 'ITEM_ARRIVED',
  SELLER_REFUNDED: 'SELLER_REFUNDED',
  REPLACEMENT_RECEIVED: 'REPLACEMENT_RECEIVED',
});

export const INR_REFERENCE_TYPE = 'INRRequest';
export const INR_ISSUE_TYPE = 'ITEM_NOT_RECEIVED';
