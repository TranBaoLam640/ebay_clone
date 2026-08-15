import multer from 'multer';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { ALLOWED_IMAGE_MIMES } from './upload.service.js';

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
