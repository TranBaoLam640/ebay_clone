import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

/**
 * Whether object storage is configured. When any required S3 setting is missing
 * the upload endpoints respond 503 instead of crashing at boot — keeps local
 * dev runnable without MinIO credentials.
 */
export const isStorageConfigured = Boolean(
  env.S3_ENDPOINT &&
  env.S3_ACCESS_KEY_ID &&
  env.S3_SECRET_ACCESS_KEY &&
  env.S3_BUCKET,
);

/** Lazily-created S3 client (null when storage isn't configured). */
export const s3Client = isStorageConfigured
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      // MinIO uses path-style URLs (bucket in the path, not a subdomain).
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    })
  : null;

/** Base URL for building public object URLs. */
export const publicBaseUrl = (
  env.S3_PUBLIC_URL || `${env.S3_ENDPOINT}/${env.S3_BUCKET}`
)?.replace(/\/+$/, '');
