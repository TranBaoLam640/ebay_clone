import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import * as userRepository from '../users/repository.js';
import * as authRepository from './repository.js';
import * as notificationService from '../notifications/service.js';
import { emailService } from '../../common/services/email.service.js';
import {
  generateEmailOtp,
  hashEmailOtp,
  hashPassword,
  sha256,
  verifyEmailOtpHash,
  verifyPassword,
} from '../../common/utils/hash.js';
import { signAccess, signRefresh } from '../../common/utils/token.js';
import { USER_STATUS } from '../../common/constants/user-status.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';

const tokenExpiry = (token) => {
  const payload = jwt.decode(token);
  if (!payload?.exp) throw new Error('invalid token expiry');
  return new Date(payload.exp * 1000);
};
const normalizeEmail = (email) => email.trim().toLowerCase();
const verificationExpiry = () =>
  new Date(Date.now() + env.EMAIL_OTP_TTL_MINUTES * 60 * 1000);
const genericAuthError = () =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid credentials');
const invalidOtpError = () =>
  new AppError(
    400,
    ERROR_CODES.INVALID_EMAIL_VERIFICATION_OTP,
    'Invalid verification code',
  );
const expiredOtpError = () =>
  new AppError(
    400,
    ERROR_CODES.EMAIL_VERIFICATION_OTP_EXPIRED,
    'Verification code has expired',
  );
const maxAttemptsError = () =>
  new AppError(
    400,
    ERROR_CODES.EMAIL_VERIFICATION_OTP_MAX_ATTEMPTS,
    'Verification code has reached the maximum number of attempts',
  );
const deliveryError = () =>
  new AppError(
    502,
    ERROR_CODES.EMAIL_DELIVERY_FAILED,
    'Verification email could not be delivered',
  );
const issueVerificationOtp = async (user, session) => {
  const otp = generateEmailOtp();
  const otpHash = hashEmailOtp(user.email, otp, env.EMAIL_OTP_HMAC_SECRET);
  await authRepository.replaceVerification(
    {
      userId: user.id,
      otpHash,
      tokenHash: otpHash,
      expiresAt: verificationExpiry(),
      attempts: 0,
      maxAttempts: env.EMAIL_OTP_MAX_ATTEMPTS,
      lastSentAt: new Date(),
    },
    session,
  );
  return otp;
};
const sendVerificationOtp = async (email, otp) => {
  const sent = await emailService.sendVerificationEmail({
    to: email,
    otp,
    expiresInMinutes: env.EMAIL_OTP_TTL_MINUTES,
    verificationUrl: env.EMAIL_VERIFICATION_URL,
  });
  if (!sent) throw deliveryError();
};
export const register = async ({ email, password, fullName }) => {
  const normalizedEmail = normalizeEmail(email);
  if (await userRepository.findByEmail(normalizedEmail)) {
    const error = new Error('duplicate email');
    error.code = 11000;
    throw error;
  }
  const { user, otp } = await authRepository.transaction(async (session) => {
    const createdUser = await userRepository.create(
      {
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        fullName,
        verificationSentAt: new Date(),
      },
      session,
    );
    const verificationOtp = await issueVerificationOtp(createdUser, session);
    await notificationService.createAccountNotification(
      createdUser.id,
      {
        title: 'Account registered',
        message: 'Your account was created. Verify your email to continue.',
      },
      session,
    );
    return { user: createdUser, otp: verificationOtp };
  });
  await sendVerificationOtp(user.email, otp);
  return {
    user,
    otpExpiresInSeconds: env.EMAIL_OTP_TTL_MINUTES * 60,
    resendAvailableInSeconds: env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS,
  };
};
export const login = async (email, password, ipAddress, userAgent) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmailWithPassword(normalizedEmail);
  logger.warn({
    email: normalizedEmail,
    userFound: !!user,
    hasPasswordHash: !!user?.passwordHash,
    status: user?.status,
    role: user?.role,
    isEmailVerified: user?.isEmailVerified,
  }, 'LOGIN DEBUG user lookup');
  const passwordMatched = user
    ? await verifyPassword(password, user.passwordHash)
    : false;
  logger.warn({
    email: normalizedEmail,
    passwordMatched,
  }, 'LOGIN DEBUG password check');
  if (!user || !passwordMatched)
    throw genericAuthError();
  if (user.status === USER_STATUS.PENDING_VERIFICATION)
    throw new AppError(
      403,
      ERROR_CODES.EMAIL_NOT_VERIFIED,
      'Email is not verified',
    );
  if (
    user.status === USER_STATUS.LOCKED ||
    user.status === USER_STATUS.DISABLED
  )
    throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Account is unavailable');
  if (user.status !== USER_STATUS.ACTIVE) throw genericAuthError();
  const accessToken = signAccess(user);
  const refreshToken = signRefresh(user);
  const loggedInUser = await userRepository.markLogin(user.id);
  await authRepository.createRefresh({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: tokenExpiry(refreshToken),
    ipAddress,
    userAgent,
  });
  return { user: loggedInUser, accessToken, refreshToken };
};
export const verifyEmail = async ({ email, otp }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) throw invalidOtpError();
  if (user.isEmailVerified)
    throw new AppError(
      400,
      ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      'Email is already verified',
    );
  const verification = await authRepository.findActiveVerificationForUser(
    user.id,
  );
  if (!verification) {
    const latest = await authRepository.findLatestVerificationForUser(user.id);
    if (latest?.attempts >= latest?.maxAttempts) throw maxAttemptsError();
    throw invalidOtpError();
  }
  if (verification.attempts >= verification.maxAttempts)
    throw maxAttemptsError();
  if (verification.expiresAt <= new Date()) throw expiredOtpError();
  const otpHash = hashEmailOtp(normalizedEmail, otp, env.EMAIL_OTP_HMAC_SECRET);
  if (!verifyEmailOtpHash(otpHash, verification.otpHash)) {
    const updated = await authRepository.incrementVerificationAttempts(
      verification.id,
    );
    if (updated?.attempts >= updated?.maxAttempts) throw maxAttemptsError();
    throw invalidOtpError();
  }
  await authRepository.transaction(async (session) => {
    const consumed = await authRepository.consumeVerification(
      verification.id,
      otpHash,
      session,
    );
    if (consumed.modifiedCount !== 1) throw invalidOtpError();
    const verifiedUser = await userRepository.markVerified(user.id, session);
    if (!verifiedUser) throw invalidOtpError();
    await authRepository.invalidateActiveVerifications(
      user.id,
      session,
      verification.id,
    );
    await notificationService.createAccountNotification(
      verifiedUser.id,
      {
        title: 'Email verified',
        message: 'Your email address was verified successfully.',
      },
      session,
    );
  });
};
export const resendVerification = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user || user.isEmailVerified) return {};
  const otp = await authRepository.transaction(async (session) => {
    const currentUser = await userRepository.findById(user.id, session);
    if (!currentUser || currentUser.isEmailVerified) return null;
    const latest = await authRepository.findLatestVerificationForUser(
      currentUser.id,
      session,
    );
    const latestSentAt =
      latest?.lastSentAt || latest?.createdAt || currentUser.verificationSentAt;
    const nextAllowedAt = latestSentAt
      ? new Date(
          latestSentAt.getTime() + env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
        )
      : null;
    if (nextAllowedAt && nextAllowedAt > new Date())
      throw new AppError(
        429,
        ERROR_CODES.EMAIL_VERIFICATION_RESEND_TOO_SOON,
        'Please wait before requesting another verification code',
      );
    const verificationOtp = await issueVerificationOtp(currentUser, session);
    await userRepository.markVerificationSent(currentUser.id, session);
    return verificationOtp;
  });
  if (!otp) return {};
  await sendVerificationOtp(user.email, otp);
  return {};
};
// --- Password reset (mirrors the email-verification OTP flow) ---
const resetInvalidOtpError = () =>
  new AppError(
    400,
    ERROR_CODES.INVALID_PASSWORD_RESET_OTP,
    'Invalid password reset code',
  );
const resetExpiredOtpError = () =>
  new AppError(
    400,
    ERROR_CODES.PASSWORD_RESET_OTP_EXPIRED,
    'Password reset code has expired',
  );
const resetMaxAttemptsError = () =>
  new AppError(
    400,
    ERROR_CODES.PASSWORD_RESET_OTP_MAX_ATTEMPTS,
    'Password reset code has reached the maximum number of attempts',
  );
const resetDeliveryError = () =>
  new AppError(
    502,
    ERROR_CODES.EMAIL_DELIVERY_FAILED,
    'Password reset email could not be delivered',
  );
const issuePasswordResetOtp = async (user, session) => {
  const otp = generateEmailOtp();
  const otpHash = hashEmailOtp(user.email, otp, env.EMAIL_OTP_HMAC_SECRET);
  await authRepository.replacePasswordReset(
    {
      userId: user.id,
      otpHash,
      tokenHash: otpHash,
      expiresAt: verificationExpiry(),
      attempts: 0,
      maxAttempts: env.EMAIL_OTP_MAX_ATTEMPTS,
      lastSentAt: new Date(),
    },
    session,
  );
  return otp;
};
const sendPasswordResetOtp = async (email, otp) => {
  const sent = await emailService.sendPasswordResetEmail({
    to: email,
    otp,
    expiresInMinutes: env.EMAIL_OTP_TTL_MINUTES,
    resetUrl: env.PASSWORD_RESET_URL,
  });
  if (!sent) throw resetDeliveryError();
};

/**
 * Start a password reset: issue and email an OTP. Always resolves without
 * revealing whether the email exists (no account enumeration). Only verified,
 * active accounts can reset — unverified users go through verification instead.
 */
export const forgotPassword = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  const eligible =
    user && user.isEmailVerified && user.status === USER_STATUS.ACTIVE;
  if (!eligible) return {};
  const otp = await authRepository.transaction(async (session) => {
    const latest = await authRepository.findLatestPasswordResetForUser(
      user.id,
      session,
    );
    const latestSentAt = latest?.lastSentAt || latest?.createdAt;
    const nextAllowedAt = latestSentAt
      ? new Date(
          latestSentAt.getTime() + env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS * 1000,
        )
      : null;
    if (nextAllowedAt && nextAllowedAt > new Date())
      throw new AppError(
        429,
        ERROR_CODES.PASSWORD_RESET_RESEND_TOO_SOON,
        'Please wait before requesting another password reset code',
      );
    return issuePasswordResetOtp(user, session);
  });
  await sendPasswordResetOtp(user.email, otp);
  return {};
};

/** Same as forgotPassword — a distinct entry point for the resend button. */
export const resendPasswordReset = (email) => forgotPassword(email);

/** Verify the reset OTP and set the new password, revoking all sessions. */
export const resetPassword = async ({ email, otp, newPassword }) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) throw resetInvalidOtpError();
  const reset = await authRepository.findActivePasswordResetForUser(user.id);
  if (!reset) {
    const latest = await authRepository.findLatestPasswordResetForUser(user.id);
    if (latest?.attempts >= latest?.maxAttempts) throw resetMaxAttemptsError();
    throw resetInvalidOtpError();
  }
  if (reset.attempts >= reset.maxAttempts) throw resetMaxAttemptsError();
  if (reset.expiresAt <= new Date()) throw resetExpiredOtpError();
  const otpHash = hashEmailOtp(normalizedEmail, otp, env.EMAIL_OTP_HMAC_SECRET);
  if (!verifyEmailOtpHash(otpHash, reset.otpHash)) {
    const updated = await authRepository.incrementPasswordResetAttempts(
      reset.id,
    );
    if (updated?.attempts >= updated?.maxAttempts)
      throw resetMaxAttemptsError();
    throw resetInvalidOtpError();
  }
  await authRepository.transaction(async (session) => {
    const consumed = await authRepository.consumePasswordReset(
      reset.id,
      otpHash,
      session,
    );
    if (consumed.modifiedCount !== 1) throw resetInvalidOtpError();
    await userRepository.updatePassword(
      user.id,
      await hashPassword(newPassword),
      session,
    );
    await authRepository.invalidateActivePasswordResets(
      user.id,
      session,
      reset.id,
    );
    // A password reset ends every existing session.
    await authRepository.revokeAll(user.id, session);
    await notificationService.createAccountNotification(
      user.id,
      {
        title: 'Password reset',
        message:
          'Your password was reset. If this was not you, contact support.',
      },
      session,
    );
  });
  return {};
};

export const rotate = async (raw, ipAddress, userAgent) => {
  if (!raw) throw genericAuthError();
  const payload = jwt.verify(raw, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
  });
  if (
    typeof payload !== 'object' ||
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    !payload.exp
  )
    throw genericAuthError();
  const tokenHash = sha256(raw);
  return authRepository.transaction(async (session) => {
    const old = await authRepository.findActiveRefresh(
      payload.sub,
      tokenHash,
      session,
    );
    if (!old) throw genericAuthError();
    const user = await userRepository.findById(payload.sub, session);
    if (!user || user.status !== USER_STATUS.ACTIVE) throw genericAuthError();
    const revoked = await authRepository.revokeActiveRefresh(
      user.id,
      tokenHash,
      session,
    );
    if (revoked.modifiedCount !== 1) throw genericAuthError();
    const refreshToken = signRefresh(user);
    await authRepository.createRefresh(
      {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: tokenExpiry(refreshToken),
        ipAddress,
        userAgent,
      },
      session,
    );
    return {
      user,
      accessToken: signAccess(user),
      refreshToken,
    };
  });
};
export const logout = async (raw) => {
  if (!raw) return;
  await authRepository.revokeRefresh(sha256(raw));
};
