import mongoose from 'mongoose';
import { RefreshToken } from './refresh-token.model.js';
import { EmailVerificationToken } from './email-verification-token.model.js';
import { PasswordResetToken } from './password-reset-token.model.js';

export const transaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};
export const createRefresh = (data, session) =>
  session
    ? RefreshToken.create([data], { session }).then(([token]) => token)
    : RefreshToken.create(data);
export const findActiveRefresh = (userId, tokenHash, session) =>
  RefreshToken.findOne({
    userId,
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).session(session || null);
export const revokeRefresh = (tokenHash) =>
  RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { revokedAt: new Date() },
  );
export const revokeActiveRefresh = (userId, tokenHash, session) =>
  RefreshToken.updateOne(
    { userId, tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { revokedAt: new Date() },
    { session },
  );
export const revokeAll = (userId, session) =>
  RefreshToken.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() },
    { session },
  );
export const createVerification = (data, session) =>
  session
    ? EmailVerificationToken.create([data], { session }).then(
        ([token]) => token,
      )
    : EmailVerificationToken.create(data);
export const findLatestVerificationForUser = (userId, session) =>
  EmailVerificationToken.findOne({ userId })
    .sort({ createdAt: -1 })
    .session(session || null);
export const findActiveVerificationForUser = (userId, session) =>
  EmailVerificationToken.findOne({
    userId,
    otpHash: { $type: 'string' },
    usedAt: null,
    invalidatedAt: null,
  })
    .sort({ createdAt: -1 })
    .session(session || null);
export const incrementVerificationAttempts = (id) =>
  EmailVerificationToken.findOneAndUpdate(
    {
      _id: id,
      usedAt: null,
      invalidatedAt: null,
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  ).then(async (updated) => {
    if (updated && updated.attempts >= updated.maxAttempts) {
      return EmailVerificationToken.findOneAndUpdate(
        { _id: id, usedAt: null, invalidatedAt: null },
        { invalidatedAt: new Date() },
        { returnDocument: 'after' },
      );
    }
    return updated;
  });
export const consumeVerification = (id, otpHash, session) =>
  EmailVerificationToken.updateOne(
    {
      _id: id,
      otpHash,
      usedAt: null,
      invalidatedAt: null,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
    },
    { usedAt: new Date() },
    { session },
  );
export const invalidateActiveVerifications = (userId, session, exceptId) =>
  EmailVerificationToken.updateMany(
    {
      userId,
      usedAt: null,
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    },
    { invalidatedAt: new Date() },
    { session },
  );
export const replaceVerification = (data, session) => {
  const replace = async (activeSession) => {
    await invalidateActiveVerifications(data.userId, activeSession);
    return createVerification(data, activeSession);
  };
  return session ? replace(session) : transaction(replace);
};

// --- Password reset tokens (same lifecycle as email-verification tokens) ---
export const createPasswordReset = (data, session) =>
  session
    ? PasswordResetToken.create([data], { session }).then(([token]) => token)
    : PasswordResetToken.create(data);
export const findLatestPasswordResetForUser = (userId, session) =>
  PasswordResetToken.findOne({ userId })
    .sort({ createdAt: -1 })
    .session(session || null);
export const findActivePasswordResetForUser = (userId, session) =>
  PasswordResetToken.findOne({
    userId,
    otpHash: { $type: 'string' },
    usedAt: null,
    invalidatedAt: null,
  })
    .sort({ createdAt: -1 })
    .session(session || null);
export const incrementPasswordResetAttempts = (id) =>
  PasswordResetToken.findOneAndUpdate(
    {
      _id: id,
      usedAt: null,
      invalidatedAt: null,
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' },
  ).then(async (updated) => {
    if (updated && updated.attempts >= updated.maxAttempts) {
      return PasswordResetToken.findOneAndUpdate(
        { _id: id, usedAt: null, invalidatedAt: null },
        { invalidatedAt: new Date() },
        { returnDocument: 'after' },
      );
    }
    return updated;
  });
export const consumePasswordReset = (id, otpHash, session) =>
  PasswordResetToken.updateOne(
    {
      _id: id,
      otpHash,
      usedAt: null,
      invalidatedAt: null,
      expiresAt: { $gt: new Date() },
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
    },
    { usedAt: new Date() },
    { session },
  );
export const invalidateActivePasswordResets = (userId, session, exceptId) =>
  PasswordResetToken.updateMany(
    {
      userId,
      usedAt: null,
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    },
    { invalidatedAt: new Date() },
    { session },
  );
export const replacePasswordReset = (data, session) => {
  const replace = async (activeSession) => {
    await invalidateActivePasswordResets(data.userId, activeSession);
    return createPasswordReset(data, activeSession);
  };
  return session ? replace(session) : transaction(replace);
};
