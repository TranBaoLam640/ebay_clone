import { success } from '../../common/utils/api-response.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as service from './inr-request.service.js';
import * as replacementChatService from '../replacements/replacement-chat.service.js';

export const create = async (req, res, next) => {
  try {
    success(res, await service.create(req.user.id, req.validated.body), 201);
  } catch (error) {
    next(error);
  }
};

export const listBuyer = async (req, res, next) => {
  try {
    const result = await service.listBuyer(req.user.id, req.validated.query);
    success(res, result.items, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

export const listSeller = async (req, res, next) => {
  try {
    const result = await service.listSeller(req.user.id, req.validated.query);
    success(res, result.items, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    success(
      res,
      await service.get(req.user.id, req.validated.params.requestId),
    );
  } catch (error) {
    next(error);
  }
};

export const close = async (req, res, next) => {
  try {
    success(
      res,
      await service.close(req.user.id, req.validated.params.requestId),
    );
  } catch (error) {
    next(error);
  }
};

export const updateTrackingEvidence = async (req, res, next) => {
  try {
    success(
      res,
      await service.updateTrackingEvidence(
        req.user.id,
        req.validated.params.requestId,
        req.validated.body,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const refundPreview = async (req, res, next) => {
  try {
    success(
      res,
      await service.refundPreview(req.user.id, req.validated.params.requestId),
    );
  } catch (error) {
    next(error);
  }
};

export const requestRefundInstead = async (req, res, next) => {
  try {
    const result = await service.requestRefundInstead(
      req.user.id,
      req.validated.params.requestId,
    );
    await replacementChatService.emitLatestReplacementUpdateForInr(
      req.validated.params.requestId,
    );
    success(res, result);
  } catch (error) {
    next(error);
  }
};

export const proposeReplacement = async (req, res, next) => {
  try {
    success(
      res,
      await replacementChatService.proposeForInr(
        req.user.id,
        req.validated.params.requestId,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const refund = async (req, res, next) => {
  try {
    const key = req.get('Idempotency-Key')?.trim();
    if (!key)
      throw new AppError(
        400,
        ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        'Idempotency-Key header is required',
      );
    const response = await service.refund(
      req.user.id,
      req.validated.params.requestId,
      key,
    );
    await replacementChatService.emitLatestReplacementUpdateForInr(
      req.validated.params.requestId,
    );
    res.status(response.status).json(response.body);
  } catch (error) {
    next(error);
  }
};
