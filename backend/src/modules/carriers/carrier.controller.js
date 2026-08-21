import { success } from '../../common/utils/api-response.js';
import * as service from './carrier.service.js';

export const list = async (_req, res, next) => {
  try {
    success(res, await service.list());
  } catch (error) {
    next(error);
  }
};
