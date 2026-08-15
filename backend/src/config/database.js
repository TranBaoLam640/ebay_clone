import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';
import { buildMongoDbUri, getMongoDbTarget } from './mongodb-uri.js';
let connecting;
export const connectDatabase = (uri = buildMongoDbUri(env)) => {
  const target = getMongoDbTarget(uri);
  connecting ??= mongoose.connect(uri, {
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  });
  return connecting.then((connection) => {
    logger.info(target, 'database connection ready');
    return connection;
  });
};
export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState) await mongoose.disconnect();
  connecting = undefined;
};
export const isDatabaseReady = () => mongoose.connection.readyState === 1;
mongoose.connection.on('connected', () => logger.info('database connected'));
mongoose.connection.on('error', (error) =>
  logger.error({ error }, 'database error'),
);
mongoose.connection.on('disconnected', () =>
  logger.info('database disconnected'),
);
