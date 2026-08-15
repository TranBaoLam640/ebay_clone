import {
  body,
  collection,
  idParam,
  operation,
  pageParams,
  ref,
  response,
  security,
} from '../components/index.js';

export const returnPaths = {
  '/returns': {
    post: operation({
      tag: 'Returns',
      operationId: 'createReturn',
      summary: 'Create a return request',
      description:
        'Creates one Return Request per owned delivered Order when the exact item, quantity, deliveredAt timestamp, and configured return window are eligible.',
      requestBody: body({
        $ref: '#/components/schemas/CreateReturnRequest',
      }),
      success: response('Return request created', ref('ReturnRequest')),
      successStatus: 201,
      errors: [400, 401, 409, 413, 429, 500],
      security: security.unsafe,
    }),
    get: operation({
      tag: 'Returns',
      operationId: 'listReturns',
      summary: 'List owned return requests',
      parameters: pageParams,
      success: response('Return requests', collection('ReturnRequest'), true),
      errors: [400, 401, 429, 500],
      security: security.access,
    }),
  },
  '/returns/{returnId}': {
    get: operation({
      tag: 'Returns',
      operationId: 'getReturn',
      summary: 'Get an owned return request',
      parameters: [idParam('returnId')],
      success: response('Return request', ref('ReturnRequest')),
      errors: [400, 401, 404, 429, 500],
      security: security.access,
    }),
  },
};
