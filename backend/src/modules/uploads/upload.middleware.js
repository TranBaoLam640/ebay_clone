import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import {
  ALLOWED_IMAGE_MIMES,
  ALLOWED_MESSAGE_ATTACHMENT_MIMES,
  MESSAGE_ATTACHMENT_LIMIT,
} from './upload.service.js';

/**
 * Multer in-memory upload for a single image field named `file`. Files are held
 * in a buffer (never written to disk) then streamed to object storage.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new AppError(
          400,
          ERROR_CODES.UPLOAD_INVALID_TYPE,
          'Unsupported image type',
        ),
      );
  },
});

/** Single-file middleware that maps multer's size error to our error shape. */
export const singleImage = (req, res, next) =>
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (
      error instanceof multer.MulterError &&
      error.code === 'LIMIT_FILE_SIZE'
    ) {
      return next(
        new AppError(413, ERROR_CODES.UPLOAD_TOO_LARGE, 'File is too large'),
      );
    }
    next(error);
  });

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: MESSAGE_ATTACHMENT_LIMIT },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MESSAGE_ATTACHMENT_MIMES.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new AppError(
          400,
          ERROR_CODES.UPLOAD_INVALID_TYPE,
          'Unsupported attachment type',
        ),
      );
  },
});

export const messageAttachments = (req, res, next) =>
  attachmentUpload.array('files', MESSAGE_ATTACHMENT_LIMIT)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE')
        return next(
          new AppError(413, ERROR_CODES.UPLOAD_TOO_LARGE, 'File is too large'),
        );
      if (
        error.code === 'LIMIT_FILE_COUNT' ||
        error.code === 'LIMIT_UNEXPECTED_FILE'
      )
        return next(
          new AppError(
            400,
            ERROR_CODES.VALIDATION_ERROR,
            'Too many attachments',
          ),
        );
    }
    next(error);
  });
