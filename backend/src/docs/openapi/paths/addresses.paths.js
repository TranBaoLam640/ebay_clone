import {
  body,
  idParam,
  operation,
  ref,
  response,
  security,
} from '../components/index.js';

export const addressPaths = {
  '/addresses': {
    get: operation({
      tag: 'Addresses',
      operationId: 'listAddresses',
      summary: 'List current user addresses',
      success: response('Addresses', { type: 'array', items: ref('Address') }),
      errors: [401, 429, 500],
      security: security.access,
    }),
    post: operation({
      tag: 'Addresses',
      operationId: 'createAddress',
      summary: 'Create an address',
      requestBody: body({ $ref: '#/components/schemas/CreateAddressRequest' }),
      success: response('Address created', ref('Address')),
      successStatus: 201,
      errors: [400, 401, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/addresses/{addressId}': {
    patch: operation({
      tag: 'Addresses',
      operationId: 'updateAddress',
      summary: 'Update an address',
      parameters: [idParam('addressId')],
      requestBody: body({
        $ref: '#/components/schemas/UpdateSellerFeedbackRequest',
      }),
      success: response('Address updated', ref('Address')),
      errors: [400, 401, 404, 413, 429, 500],
      security: security.unsafe,
    }),
    delete: operation({
      tag: 'Addresses',
      operationId: 'deleteAddress',
      summary: 'Delete an address',
      parameters: [idParam('addressId')],
      errors: [400, 401, 404, 429, 500],
      security: security.unsafe,
    }),
  },
  '/addresses/{addressId}/default': {
    patch: operation({
      tag: 'Addresses',
      operationId: 'setDefaultAddress',
      summary: 'Set the default address',
      parameters: [idParam('addressId')],
      success: response('Default address set', ref('Address')),
      errors: [400, 401, 404, 429, 500],
      security: security.unsafe,
    }),
  },
};
