import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { s3Client, isStorageConfigured, publicBaseUrl } from './s3-client.js';

/** Map allowed image mime types → file extension for the stored object key. */
const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const ALLOWED_IMAGE_MIMES = Object.keys(EXTENSION_BY_MIME);

/**
 * Upload an image buffer to object storage under `folder/` and return its
 * public URL. `folder` scopes the key (e.g. 'avatars', 'products').
 */
export const uploadImage = async (file, folder) => {
  if (!isStorageConfigured || !s3Client)
    throw new AppError(
      503,
      ERROR_CODES.UPLOAD_DISABLED,
      'File uploads are not configured',
    );

  const ext = EXTENSION_BY_MIME[file.mimetype];
  if (!ext)
    throw new AppError(
      400,
      ERROR_CODES.UPLOAD_INVALID_TYPE,
      'Unsupported image type',
    );

  const key = `${folder}/${randomUUID()}.${ext}`;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Public read is granted by the bucket policy (set once on MinIO), not a
        // per-object ACL — MinIO ignores/rejects object ACLs in many setups.
      }),
    );
  } catch (error) {
    throw new AppError(
      502,
      ERROR_CODES.UPLOAD_FAILED,
      `Failed to store the uploaded file: ${error.message}`,
    );
  }

  return { url: `${publicBaseUrl}/${key}`, key };
};
