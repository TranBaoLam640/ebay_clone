const addQueryOption = (options, name, value) => {
  if (value !== undefined && value !== '') options.set(name, String(value));
};

export const buildMongoDbUri = (config) => {
  if (config.MONGODB_URI) return config.MONGODB_URI;
  if (Boolean(config.MONGODB_USERNAME) !== Boolean(config.MONGODB_PASSWORD)) {
    throw new Error('MongoDB username and password must be provided together');
  }

  const credentials = config.MONGODB_USERNAME
    ? `${encodeURIComponent(config.MONGODB_USERNAME)}:${encodeURIComponent(config.MONGODB_PASSWORD)}@`
    : '';
  const options = new URLSearchParams();
  addQueryOption(options, 'authSource', config.MONGODB_AUTH_SOURCE);
  addQueryOption(options, 'replicaSet', config.MONGODB_REPLICA_SET);
  if (config.MONGODB_TLS) options.set('tls', 'true');
  const query = options.size ? `?${options.toString()}` : '';

  return `mongodb://${credentials}${config.MONGODB_HOST}:${config.MONGODB_PORT}/${encodeURIComponent(config.MONGODB_DATABASE)}${query}`;
};

export const getMongoDbTarget = (uri) => {
  const parsed = new URL(uri);
  return {
    host: parsed.hostname,
    database: decodeURIComponent(parsed.pathname.slice(1).split('/')[0]),
  };
};
