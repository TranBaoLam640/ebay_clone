import {
  collection,
  operation,
  response,
  security,
} from '../components/index.js';

export const carrierPaths = {
  '/carriers': {
    get: operation({
      tag: 'Carriers',
      operationId: 'listCarriers',
      summary: 'List active demo carriers',
      description:
        'Authenticated read endpoint for active demo carriers used by INR seller tracking evidence. No external carrier integration is performed.',
      success: response('Carriers', collection('Carrier')),
      errors: [401, 429, 500],
      security: security.access,
    }),
  },
};
