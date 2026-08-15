import { success } from '../../common/utils/api-response.js';
import * as service from './checkout.service.js';

export const execute = async (req, res, next) => {
  try {
    const key = req.get('Idempotency-Key')?.trim();
    if (!key) {
      const { AppError } = await import('../../common/errors/app-error.js');
      const { ERROR_CODES } =
        await import('../../common/constants/error-codes.js');
      throw new AppError(
        400,
        ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        'Idempotency-Key header is required',
      );
    }
    const response = await service.execute(
      req.user.id,
      key,
      req.validated.body,
    );
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};

export const preview = async (req, res, next) => {
  try {
    success(res, await service.preview(req.user.id, req.validated.body));
  } catch (error) {
    next(error);
  }
};
