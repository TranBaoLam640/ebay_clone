import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';
export const validate = (schema) => (req, res, next) => {
  const parsed = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });
  if (!parsed.success)
    return next(
      new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        parsed.error.issues.some(
          ({ message }) => message === 'Invalid identifier',
        )
          ? 'Invalid identifier'
          : 'Validation failed',
        parsed.error.issues.map(({ path, message }) => ({
          path: path.join('.'),
          message,
        })),
      ),
    );
  req.validated = parsed.data;
  next();
};
