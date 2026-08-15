import { success } from '../../common/utils/api-response.js';
import * as service from './payment.service.js';

export const createPayPal = async (req, res, next) => {
  try {
    success(
      res,
      await service.createPayPal(
        req.user.id,
        req.validated.body.checkoutGroupId,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const capturePayPal = async (req, res, next) => {
  try {
    success(
      res,
      await service.capturePayPal(
        req.user.id,
        req.validated.body.checkoutGroupId,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const confirmCod = async (req, res, next) => {
  try {
    success(
      res,
      await service.confirmCod(req.user.id, req.validated.body.checkoutGroupId),
    );
  } catch (error) {
    next(error);
  }
};
