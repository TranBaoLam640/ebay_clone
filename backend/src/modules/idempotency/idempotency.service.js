import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as repository from './idempotency.repository.js';

const RECORD_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
};

const conflict = (code, message) => new AppError(409, code, message);

export const requestHash = (input) =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(input)))
    .digest('hex');

export const find = repository.find;

export const assertCompatible = (record, hash) => {
  if (record?.requestHash !== hash)
    throw conflict(
      ERROR_CODES.IDEMPOTENCY_CONFLICT,
      'Idempotency key was used with another request',
    );
};

export const claim = async (scope, ownerId, key, hash, now = new Date()) => {
  const claimToken = randomUUID();
  const data = {
    claimToken,
    startedAt: now,
    lastAttemptAt: now,
    expiresAt: new Date(now.getTime() + RECORD_TTL_MS),
  };
  let record = await repository.find(scope, ownerId, key);
  if (!record) {
    try {
      record = await repository.createClaim({
        scope,
        ownerId,
        key,
        requestHash: hash,
        status: 'PROCESSING',
        attempts: 1,
        ...data,
      });
      return { claimToken, replay: null };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      record = await repository.find(scope, ownerId, key);
    }
  }
  assertCompatible(record, hash);
  if (record.status === 'COMPLETED')
    return {
      claimToken: null,
      replay: {
        status: record.responseStatus,
        body: record.responseBody,
      },
    };
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
  if (
    record.status === 'PROCESSING' &&
    new Date(record.lastAttemptAt) > staleBefore
  )
    throw conflict(
      ERROR_CODES.IDEMPOTENCY_PROCESSING,
      'An idempotent request is already processing',
    );
  const reclaimed = await repository.reclaim(
    scope,
    ownerId,
    key,
    hash,
    record.claimToken,
    staleBefore,
    data,
  );
  if (!reclaimed)
    throw conflict(
      ERROR_CODES.IDEMPOTENCY_PROCESSING,
      'An idempotent request is already processing',
    );
  return { claimToken, replay: null };
};

export const complete = (scope, ownerId, key, claimToken, data, session) =>
  repository.complete(
    scope,
    ownerId,
    key,
    claimToken,
    { ...data, completedAt: new Date() },
    session,
  );

export const fail = (scope, ownerId, key, claimToken, error) =>
  repository.fail(scope, ownerId, key, claimToken, {
    failedAt: new Date(),
    errorCode: error?.code || ERROR_CODES.INTERNAL_ERROR,
    errorMessage: error?.message || 'Checkout failed',
  });
