import { success } from '../../common/utils/api-response.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { uploadImage } from './upload.service.js';

const requireFile = (req) => {
  if (!req.file)
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'No file was uploaded',
    );
  return req.file;
};

/** POST /uploads/avatar — store a user avatar, return its public URL. */
export const uploadAvatar = async (req, res, next) => {
  try {
    success(res, await uploadImage(requireFile(req), 'avatars'), 201);
  } catch (e) {
    next(e);
  }
};

/** POST /uploads/product-image — store a product image, return its public URL. */
export const uploadProductImage = async (req, res, next) => {
  try {
    success(res, await uploadImage(requireFile(req), 'products'), 201);
  } catch (e) {
    next(e);
  }
};
