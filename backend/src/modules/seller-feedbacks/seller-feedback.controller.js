import { success } from '../../common/utils/api-response.js';
import * as service from './seller-feedback.service.js';

export const create = async (req, res, next) => {
  try {
    success(
      res,
      await service.create(
        req.user.id,
        req.params.orderId,
        req.validated.body,
        req.files || [],
      ),
      201,
    );
  } catch (e) {
    next(e);
  }
};

export const createForOrderItem = async (req, res, next) => {
  try {
    success(
      res,
      await service.createForOrderItem(
        req.user.id,
        req.params.orderId,
        req.params.orderItemId,
        req.validated.body,
        req.files || [],
      ),
      201,
    );
  } catch (e) {
    next(e);
  }
};

export const getForOrderItem = async (req, res, next) => {
  try {
    success(
      res,
      await service.getForOrderItem(
        req.user.id,
        req.params.orderId,
        req.params.orderItemId,
      ),
    );
  } catch (e) {
    next(e);
  }
};

export const awaiting = async (req, res, next) => {
  try {
    success(res, await service.awaiting(req.user.id));
  } catch (e) {
    next(e);
  }
};

export const summary = async (req, res, next) => {
  try {
    success(res, await service.summary(req.params.sellerId));
  } catch (e) {
    next(e);
  }
};

export const respond = async (req, res, next) => {
  try {
    success(
      res,
      await service.respond(
        req.user.id,
        req.params.feedbackId,
        req.validated.body,
      ),
    );
  } catch (e) {
    next(e);
  }
};

export const createRevisionRequest = async (req, res, next) => {
  try {
    success(
      res,
      await service.createRevisionRequest(req.user.id, req.params.feedbackId),
      201,
    );
  } catch (e) {
    next(e);
  }
};

export const respondToRevisionRequest = async (req, res, next) => {
  try {
    success(
      res,
      await service.respondToRevisionRequest(
        req.user.id,
        req.params.feedbackId,
        req.validated.body,
      ),
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
