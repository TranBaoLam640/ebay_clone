import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';
export const notFound = (req, res, next) =>
  next(new AppError(404, ERROR_CODES.NOT_FOUND, 'Route not found'));
export const errorHandler = (error, req, res, next) => {
  void next;
  let status = error instanceof AppError ? error.status : 500,
    code = error instanceof AppError ? error.code : ERROR_CODES.INTERNAL_ERROR,
    message =
      error instanceof AppError ? error.message : 'Internal server error';
  if (error.name === 'CastError')
    [status, code, message] = [
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Invalid identifier',
    ];
  if (error.code === 11000)
    [status, code, message] = [
      409,
      ERROR_CODES.CONFLICT,
      'Resource already exists',
    ];
  if (error.name === 'ValidationError')
    [status, code, message] = [
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
    ];
  if (error.type === 'entity.too.large')
    [status, code, message] = [
      413,
      ERROR_CODES.VALIDATION_ERROR,
      'Request body too large',
    ];
  if (status >= 500) req.log?.error({ err: error }, 'request failed');
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: error instanceof AppError && error.details ? error.details : [],
      requestId: req.id,
    },
  });
};
