import * as repo from './repository.js';
import * as authRepository from '../auth/repository.js';
import * as notificationService from '../notifications/service.js';
import { verifyPassword, hashPassword } from '../../common/utils/hash.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
export const getProfile = (id) => repo.findById(id);
export const getAuthenticatedUser = (id) => repo.findById(id);
export const updateProfile = (id, data) => repo.updateById(id, data);
export const changePassword = async (id, { currentPassword, newPassword }) => {
  const profile = await repo.findById(id);
  if (!profile)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'User not found');
  const user = await repo.findByEmailWithPassword(profile.email);
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash)))
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Current password is incorrect',
    );
  const passwordHash = await hashPassword(newPassword);
  await authRepository.transaction(async (session) => {
    await repo.updatePassword(user.id, passwordHash, session);
    await authRepository.revokeAll(user.id, session);
    await notificationService.createAccountNotification(
      user.id,
      {
        title: 'Password changed',
        message:
          'Your password was changed and existing sessions were revoked.',
      },
      session,
    );
  });
  return { changed: true };
};
