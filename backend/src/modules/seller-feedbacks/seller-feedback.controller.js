import { success } from '../../common/utils/api-response.js';
import * as service from './seller-feedback.service.js';

export const create = async (req, res, next) => {
  try {
    success(
      res,
      await service.create(req.user.id, req.params.orderId, req.validated.body),
      201,
    );
  } catch (e) {
    next(e);
  }
};

export const update = async (req, res, next) => {
  try {
    success(
      res,
      await service.update(
        req.user.id,
        req.params.feedbackId,
        req.validated.body,
      ),
    );
  } catch (e) {
    next(e);
  }
};

export const remove = async (req, res, next) => {
  try {
    success(res, await service.remove(req.user.id, req.params.feedbackId));
  } catch (e) {
    next(e);
  }
};

export const listPublic = async (req, res, next) => {
  try {
    const out = await service.listPublic(
      req.params.sellerId,
      req.validated.query,
    );
    success(res, out.items, 200, out.meta);
  } catch (e) {
    next(e);
  }
};
