import { success } from '../../common/utils/api-response.js';
import * as service from './category.service.js';

export const listCategories = async (req, res, next) => {
  try {
    success(res, await service.listCategories(req.validated.query));
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    success(res, await service.getCategory(req.validated.params.categoryId));
  } catch (error) {
    next(error);
  }
};
