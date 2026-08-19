import { success } from '../../common/utils/api-response.js';
import * as service from './product-review.service.js';

export const list = async (req, res, next) => {
  try {
    const result = await service.list(
      req.params.productId,
      req.validated.query,
    );
    success(res, result.items, 200, {
      ...result.meta,
      available: result.available,
    });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  try {
    success(
      res,
      await service.create(
        req.user.id,
        req.params.productId,
        req.validated.body,
      ),
      201,
    );
  } catch (error) {
    next(error);
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
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const summary = async (req, res, next) => {
  try {
    success(res, await service.summary(req.params.productId));
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    success(
      res,
      await service.update(
        req.user.id,
        req.params.reviewId,
        req.validated.body,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    success(res, await service.remove(req.user.id, req.params.reviewId));
  } catch (error) {
    next(error);
  }
};
