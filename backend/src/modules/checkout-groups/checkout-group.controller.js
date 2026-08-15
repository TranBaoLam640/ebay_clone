import { success } from '../../common/utils/api-response.js';
import * as service from './checkout-group.service.js';

export const get = async (req, res, next) => {
  try {
    success(
      res,
      await service.get(req.user.id, req.validated.params.checkoutGroupId),
    );
  } catch (error) {
    next(error);
  }
};
