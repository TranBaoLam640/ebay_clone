import { success } from '../../common/utils/api-response.js';
import * as service from './catalog-product.service.js';

export const list = async (req, res, next) => {
  try {
    const result = await service.list(req.validated.query);
    success(res, result.items, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    success(res, await service.get(req.params.catalogProductId));
  } catch (error) {
    next(error);
  }
};
