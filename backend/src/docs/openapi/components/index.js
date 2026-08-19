import { parameters } from './parameters.js';
import { responses } from './responses.js';
import { schemas } from './schemas.js';
import { securitySchemes } from './security-schemes.js';

export const components = { schemas, responses, parameters, securitySchemes };

export const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const responseNames = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  413: 'PayloadTooLarge',
  429: 'TooManyRequests',
  500: 'InternalServerError',
  502: 'BadGateway',
  503: 'ServiceUnavailable',
};
export const error = (status) => ({
  $ref: `#/components/responses/${responseNames[status]}`,
});
export const response = (description, schema, meta = false) => ({
  description,
  ...(schema && {
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SuccessEnvelope' },
            {
              type: 'object',
              properties: {
                data: schema,
                ...(meta && { meta: ref('PaginationMeta') }),
              },
            },
          ],
        },
      },
    },
  }),
});
export const body = (schema, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});
export const object = (properties, required = []) => ({
  type: 'object',
  properties,
  ...(required.length && { required }),
});
export const field = (name, schema, required = true) =>
  body(object({ [name]: schema }, required ? [name] : []));
export const parameter = (
  name,
  location,
  schema,
  required = location === 'path',
  description,
) => ({
  name,
  in: location,
  required,
  schema,
  ...(description && { description }),
});
export const idParam = (name) => ({
  $ref: `#/components/parameters/${{ addressId: 'AddressId', notificationId: 'NotificationId', categoryId: 'CategoryId', productId: 'ProductId', reviewId: 'ReviewId', sellerId: 'SellerId', orderId: 'OrderId', orderItemId: 'OrderItemId', feedbackId: 'FeedbackId', checkoutGroupId: 'CheckoutGroupId', returnId: 'ReturnId' }[name]}`,
});
export const query = (name, schema, description) =>
  parameter(name, 'query', schema, false, description);
export const pageParams = [
  { $ref: '#/components/parameters/Page' },
  { $ref: '#/components/parameters/Limit' },
];
export const security = {
  access: [{ accessCookie: [] }],
  unsafe: [{ accessCookie: [], csrfToken: [] }],
  csrf: [{ csrfToken: [] }],
  refresh: [{ refreshCookie: [], csrfToken: [] }],
};
export const operation = ({
  tag,
  operationId,
  summary,
  description,
  parameters: operationParameters,
  requestBody,
  success = response('Success'),
  successStatus = 200,
  errors = [400, 429, 500],
  security: operationSecurity,
}) => ({
  tags: [tag],
  operationId,
  summary,
  description: description || summary,
  parameters: operationParameters || [],
  ...(requestBody && { requestBody }),
  responses: {
    [successStatus]: success,
    ...Object.fromEntries(
      [
        ...new Set([
          ...(operationSecurity?.some(
            (requirement) => 'csrfToken' in requirement,
          )
            ? [403]
            : []),
          ...errors,
        ]),
      ].map((status) => [status, error(status)]),
    ),
  },
  security: operationSecurity ?? [],
});
export const collection = (name) => ({ type: 'array', items: ref(name) });
