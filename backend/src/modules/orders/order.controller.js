import { success } from '../../common/utils/api-response.js';
import * as service from './order.service.js';
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
    success(res, await service.get(req.user.id, req.validated.params.orderId));
  } catch (error) {
    next(error);
  }
};
export const checkout = async (req, res, next) => {
  try {
    success(
      res,
      await service.checkoutOrder(
        req.user.id,
        req.validated.params.orderId,
        req.validated.body,
      ),
    );
  } catch (error) {
    next(error);
  }
};
