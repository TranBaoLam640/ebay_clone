import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

/**
 * Whether object storage is configured. When any required R2 setting is missing
 * the upload endpoints respond 503 instead of crashing at boot.
 */
export const isStorageConfigured = Boolean(
  env.R2_ENDPOINT &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET_NAME &&
  env.R2_PUBLIC_URL,
);

/** Lazily-created S3-compatible client for Cloudflare R2. */
export const storageClient = isStorageConfigured
  ? new S3Client({
      endpoint: env.R2_ENDPOINT,
      region: env.R2_REGION,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

/** Base URL for building public object URLs. */
export const publicBaseUrl = env.R2_PUBLIC_URL?.replace(/\/+$/, '');
