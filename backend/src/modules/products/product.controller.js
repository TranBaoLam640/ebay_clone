import { success } from '../../common/utils/api-response.js';
import * as service from './product.service.js';

export const list = async (req, res, next) => {
  try {
    const result = await service.list(req.validated.query);
    success(res, result.items, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

export const availability = async (req, res, next) => {
  try {
    success(res, await service.availability(req.validated.query.ids));
  } catch (error) {
    next(error);
  }
};

export const detail = async (req, res, next) => {
  try {
    success(res, await service.detail(req.validated.params.productId));
  } catch (error) {
    next(error);
  }
};
