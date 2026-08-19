import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import {
  storageClient,
  isStorageConfigured,
  publicBaseUrl,
} from './storage-client.js';

/** Map allowed image mime types to file extensions for stored object keys. */
const EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const ALLOWED_IMAGE_MIMES = Object.keys(EXTENSION_BY_MIME);

const MESSAGE_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
};

const BLOCKED_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'js', 'msi']);

export const ALLOWED_MESSAGE_ATTACHMENT_MIMES = Object.keys(
  MESSAGE_EXTENSION_BY_MIME,
);
export const MESSAGE_ATTACHMENT_LIMIT = 5;

const safeDisplayName = (name = 'attachment') => {
  const base = name.split(/[\\/]/).pop() || 'attachment';
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 160);
};

const extensionOf = (name = '') => name.split('.').pop()?.toLowerCase() || '';

/**
 * Upload an image buffer to object storage under `folder/` and return its
 * public URL. `folder` scopes the key (e.g. 'avatars', 'products').
 */
export const uploadImage = async (file, folder) => {
  if (!isStorageConfigured || !storageClient)
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
    await storageClient.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
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

export const deleteObject = async (key) => {
  if (!key || !isStorageConfigured || !storageClient) return false;
  await storageClient.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
  return true;
};

export const uploadMessageAttachment = async (file) => {
  if (!isStorageConfigured || !storageClient)
    throw new AppError(
      503,
      ERROR_CODES.UPLOAD_DISABLED,
      'File uploads are not configured',
    );

  const fileName = safeDisplayName(file.originalname);
  const suppliedExt = extensionOf(fileName);
  if (BLOCKED_EXTENSIONS.has(suppliedExt))
    throw new AppError(
      400,
      ERROR_CODES.UPLOAD_INVALID_TYPE,
      'Unsupported attachment type',
    );

  const ext = MESSAGE_EXTENSION_BY_MIME[file.mimetype];
  const extensionMatches =
    !suppliedExt ||
    suppliedExt === ext ||
    (ext === 'jpg' && suppliedExt === 'jpeg');
  if (!ext || !extensionMatches)
    throw new AppError(
      400,
      ERROR_CODES.UPLOAD_INVALID_TYPE,
      'Unsupported attachment type',
    );

  const key = `messages/${randomUUID()}.${ext}`;
  try {
    await storageClient.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
  } catch (error) {
    throw new AppError(
      502,
      ERROR_CODES.UPLOAD_FAILED,
      `Failed to store the uploaded file: ${error.message}`,
    );
  }

  return {
    url: `${publicBaseUrl}/${key}`,
    fileName,
    mimeType: file.mimetype,
    size: file.size,
    type: file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE',
  };
};
