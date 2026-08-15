import { success } from '../../common/utils/api-response.js';
import * as service from './coupon.service.js';
export const validate = async (req, res, next) => {
  try {
    success(res, await service.validate(req.user.id, req.validated.body));
  } catch (error) {
    next(error);
  }
};
