import * as repo from './repository.js';
import * as authRepository from '../auth/repository.js';
import * as notificationService from '../notifications/service.js';
import { verifyPassword, hashPassword } from '../../common/utils/hash.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';

const toUserView = (user) => {
  if (!user) return null;
  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: String(source._id),
    email: source.email,
    fullName: source.fullName,
    phone: source.phone ?? null,
    avatarUrl: source.avatarUrl ?? null,
    role: source.role,
    status: source.status,
    isEmailVerified: source.isEmailVerified,
    emailVerifiedAt: source.emailVerifiedAt ?? null,
    lastLoginAt: source.lastLoginAt ?? null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

export const getProfile = async (id) => toUserView(await repo.findById(id));
export const getAuthenticatedUser = (id) => repo.findById(id);
export const updateProfile = async (id, data) =>
  toUserView(await repo.updateById(id, data));
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
