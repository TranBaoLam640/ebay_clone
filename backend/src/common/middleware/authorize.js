import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

export const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user)
      return next(
        new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
      );
    if (!allowedRoles.includes(req.user.role))
      return next(new AppError(403, ERROR_CODES.FORBIDDEN, 'Forbidden'));
    return next();
  };
