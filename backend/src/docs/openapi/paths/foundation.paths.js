export const systemPaths = {
  '/health': {
    get: {
      tags: ['Foundation'],
      operationId: 'getHealth',
      summary: 'Check process health',
      description:
        'Reports that the backend process is running without depending on database readiness.',
      parameters: [],
      responses: {
        200: {
          description: 'Process is healthy.',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessEnvelope' },
                  {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/HealthStatus' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      security: [],
    },
  },
  '/ready': {
    get: {
      tags: ['Foundation'],
      operationId: 'getReadiness',
      summary: 'Check database readiness',
      description:
        'Reports whether the database dependency is ready to serve buyer API requests.',
      parameters: [],
      responses: {
        200: {
          description: 'Database is ready.',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/SuccessEnvelope' },
                  {
                    type: 'object',
                    properties: {
                      data: {
                        allOf: [
                          { $ref: '#/components/schemas/ReadinessStatus' },
                          {
                            type: 'object',
                            properties: {
                              status: { type: 'string', enum: ['ready'] },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        503: { $ref: '#/components/responses/ServiceUnavailable' },
      },
      security: [],
    },
  },
};
