import { IdempotencyRecord } from './idempotency-record.model.js';

export const createClaim = async (data) => IdempotencyRecord.create(data);

export const find = (scope, ownerId, key, session) =>
  IdempotencyRecord.findOne({ scope, ownerId, key })
    .session(session || null)
    .lean();

export const reclaim = (
  scope,
  ownerId,
  key,
  requestHash,
  previousClaimToken,
  staleBefore,
  data,
) =>
  IdempotencyRecord.findOneAndUpdate(
    {
      scope,
      ownerId,
      key,
      requestHash,
      claimToken: previousClaimToken,
      $or: [
        { status: 'FAILED' },
        { status: 'PROCESSING', lastAttemptAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: {
        status: 'PROCESSING',
        claimToken: data.claimToken,
        startedAt: data.startedAt,
        lastAttemptAt: data.lastAttemptAt,
        expiresAt: data.expiresAt,
      },
      $inc: { attempts: 1 },
      $unset: {
        completedAt: 1,
        failedAt: 1,
        resourceId: 1,
        responseStatus: 1,
        responseBody: 1,
        errorCode: 1,
        errorMessage: 1,
      },
    },
    { returnDocument: 'after' },
  ).lean();

export const complete = (scope, ownerId, key, claimToken, data, session) =>
  IdempotencyRecord.findOneAndUpdate(
    { scope, ownerId, key, status: 'PROCESSING', claimToken },
    {
      $set: {
        status: 'COMPLETED',
        resourceId: data.resourceId,
        responseStatus: data.responseStatus,
        responseBody: data.responseBody,
        completedAt: data.completedAt,
      },
      $unset: { errorCode: 1, errorMessage: 1, failedAt: 1 },
    },
    { session, returnDocument: 'after' },
  ).lean();

export const fail = (scope, ownerId, key, claimToken, data) =>
  IdempotencyRecord.findOneAndUpdate(
    { scope, ownerId, key, status: 'PROCESSING', claimToken },
    {
      $set: {
        status: 'FAILED',
        failedAt: data.failedAt,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      },
    },
    { returnDocument: 'after' },
  ).lean();
