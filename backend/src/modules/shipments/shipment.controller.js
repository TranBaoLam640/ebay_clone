import { success } from '../../common/utils/api-response.js';
import * as service from './shipment.service.js';

export const list = async (req, res, next) => {
  try {
    const result = await service.listForShipper(
      req.user.id,
      req.validated.query,
    );
    success(res, result.items, 200, result.meta);
  } catch (error) {
    next(error);
  }
};

export const pickup = async (req, res, next) => {
  try {
    success(
      res,
      await service.pickup(req.user.id, req.validated.params.shipmentId),
    );
  } catch (error) {
    next(error);
  }
};

export const deliver = async (req, res, next) => {
  try {
    success(
      res,
      await service.deliver(req.user.id, req.validated.params.shipmentId),
    );
  } catch (error) {
    next(error);
  }
};
