const errorResponse = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorEnvelope' },
    },
  },
});

export const responses = {
  BadRequest: errorResponse('The request failed validation.'),
  Unauthorized: errorResponse('Authentication is missing or invalid.'),
  Forbidden: errorResponse(
    'The authenticated buyer cannot perform this action.',
  ),
  NotFound: errorResponse('The requested resource was not found.'),
  Conflict: errorResponse('The request conflicts with current resource state.'),
  PayloadTooLarge: errorResponse(
    'The request body exceeds the configured limit.',
  ),
  TooManyRequests: errorResponse('The applicable rate limit was exceeded.'),
  BadGateway: errorResponse('The verification email could not be delivered.'),
  ServiceUnavailable: {
    description: 'The database is not ready.',
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/SuccessEnvelope' },
            {
              type: 'object',
              properties: {
                data: { $ref: '#/components/schemas/ReadinessStatus' },
              },
            },
          ],
        },
      },
    },
  },
  InternalServerError: errorResponse('An unexpected server error occurred.'),
};
