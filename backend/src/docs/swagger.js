import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env.js';
import openApiDocument from './openapi/index.js';

const normalizePath = (value) =>
  `/${value.split('/').filter(Boolean).join('/')}`;

const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .wrapper { max-width: 1280px; padding: 0 24px; }
  .swagger-ui .info { margin: 36px 0 28px; }
  .swagger-ui .info .description { max-width: 1100px; }
  .swagger-ui .info .description p,
  .swagger-ui .info .description li { line-height: 1.65; }
  .swagger-ui .info .description ol { padding-left: 24px; }
  .swagger-ui .info .description li { margin: 6px 0; }
  .swagger-ui .info .description code { white-space: normal; }
  .swagger-ui .scheme-container { margin: 0 0 24px; padding: 20px 0; }
  .swagger-ui .opblock { border-radius: 6px; margin: 0 0 10px; overflow: hidden; }
  .swagger-ui .opblock .opblock-summary { min-height: 52px; }
  .swagger-ui .opblock .opblock-summary-method { min-width: 72px; }
  .swagger-ui .filter-container { margin: 0 0 20px; }
  @media (max-width: 768px) {
    .swagger-ui .wrapper { padding: 0 14px; }
    .swagger-ui .info { margin: 24px 0 20px; }
    .swagger-ui .scheme-container .schemes { align-items: stretch; flex-direction: column; }
  }
`;

export const mountSwaggerDocs = (app) => {
  if (!env.SWAGGER_ENABLED) return;
  const basePath = normalizePath(env.SWAGGER_PATH || '/api-docs');
  const uiPath = `${basePath}/`;
  const jsonPath = `${basePath}/openapi.json`;
  app.get(jsonPath, (req, res) => res.json(openApiDocument));
  app.get(
    uiPath,
    swaggerUi.setup(openApiDocument, {
      explorer: false,
      swaggerOptions: {
        filter: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        validatorUrl: null,
        withCredentials: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 1,
        requestInterceptor: (request) => {
          request.credentials = 'include';
          return request;
        },
      },
      customSiteTitle: 'SBay Buyer API Docs',
      customCss,
    }),
  );
  app.get(basePath, (req, res) => res.redirect(uiPath));
  app.use(basePath, swaggerUi.serve);
};
