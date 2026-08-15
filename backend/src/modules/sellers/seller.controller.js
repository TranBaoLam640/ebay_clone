import { success } from '../../common/utils/api-response.js';
import * as service from './seller.service.js';

export const getSeller = async (req, res, next) => {
  try {
    success(res, await service.getSeller(req.validated.params.sellerId));
  } catch (error) {
    next(error);
  }
};
