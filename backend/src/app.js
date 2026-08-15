import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './common/middleware/request-id.js';
import { csrfProtection } from './common/middleware/csrf.js';
import { routes } from './routes/index.js';
import { notFound, errorHandler } from './common/middleware/error-handler.js';
import { isDatabaseReady } from './config/database.js';
import { mountSwaggerDocs } from './docs/swagger.js';
export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
  mountSwaggerDocs(app);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) =>
        cb(null, !origin || env.CLIENT_ORIGIN.split(',').includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(compression());
  app.get('/health', (req, res) =>
    res.json({ success: true, data: { status: 'ok' } }),
  );
  app.get('/ready', (req, res) =>
    res.status(isDatabaseReady() ? 200 : 503).json({
      success: true,
      data: { status: isDatabaseReady() ? 'ready' : 'not_ready' },
    }),
  );
  app.use(env.API_PREFIX, (req, res, next) =>
    req.method === 'GET' && req.path === '/auth/csrf-token'
      ? next()
      : csrfProtection(req, res, next),
  );
  app.use(env.API_PREFIX, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};
export const app = createApp();
