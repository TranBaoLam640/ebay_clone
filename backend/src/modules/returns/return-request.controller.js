import { success } from '../../common/utils/api-response.js';
import * as service from './return-request.service.js';

export const create = async (req, res, next) => {
  try {
    success(res, await service.create(req.user.id, req.validated.body), 201);
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const result = await service.list(req.user.id, req.validated.query);
    success(res, result.items, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    success(res, await service.get(req.user.id, req.validated.params.returnId));
  } catch (error) {
    next(error);
  }
};
