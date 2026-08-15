import * as repo from './repository.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
const missing = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Address not found');
export const list = (userId) => repo.list(userId);
export const makeDefault = (userId, id) =>
  repo.transaction(async (session) => {
    const address = await repo.owned(userId, id, session);
    if (!address) throw missing();
    await repo.clearDefault(userId, session);
    return repo.setDefault(userId, id, session);
  });
export const create = (userId, input) =>
  repo.transaction(async (session) => {
    const data = { ...input };
    if (!(await repo.exists(userId, session))) data.isDefault = true;
    if (data.isDefault) await repo.clearDefault(userId, session);
    return repo.create({ ...data, userId }, session);
  });
export const update = (userId, id, data) =>
  repo.transaction(async (session) => {
    const address = await repo.owned(userId, id, session);
    if (!address) throw missing();
    if (address.isDefault && data.isDefault === false)
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Set another address as default before unsetting this address',
      );
    if (data.isDefault) await repo.clearDefault(userId, session);
    return repo.updateOwned(userId, id, data, session);
  });
export const remove = (userId, id) =>
  repo.transaction(async (session) => {
    const address = await repo.deleteOwned(userId, id, session);
    if (!address) throw missing();
    if (address.isDefault) await repo.promoteOldest(userId, session);
    return { deleted: true };
  });
