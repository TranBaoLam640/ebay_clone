import { success } from '../../common/utils/api-response.js';
import * as service from './inr-request.service.js';

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
