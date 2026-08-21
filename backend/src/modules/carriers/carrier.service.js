import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { AppError } from '../../common/errors/app-error.js';
import * as repository from './carrier.repository.js';

export const list = async () =>
  (await repository.listActive()).map(repository.toPublic);

export const requireActive = async (carrierId, session) => {
  const carrier = await repository.findById(carrierId, session);
  if (!carrier)
    throw new AppError(404, ERROR_CODES.CARRIER_NOT_FOUND, 'Carrier not found');
  if (!carrier.active)
    throw new AppError(
      409,
      ERROR_CODES.CARRIER_INACTIVE,
      'Carrier is inactive',
    );
  return carrier;
};
