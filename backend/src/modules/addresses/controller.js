import { success } from '../../common/utils/api-response.js';
import * as service from './service.js';
export const list = async (req, res, next) => {
  try {
    success(res, await service.list(req.user.id));
  } catch (e) {
    next(e);
  }
};
export const create = async (req, res, next) => {
  try {
    success(res, await service.create(req.user.id, req.validated.body), 201);
  } catch (e) {
    next(e);
  }
};
export const update = async (req, res, next) => {
  try {
    success(
      res,
      await service.update(
        req.user.id,
        req.params.addressId,
        req.validated.body,
      ),
    );
  } catch (e) {
    next(e);
  }
};
export const remove = async (req, res, next) => {
  try {
    success(res, await service.remove(req.user.id, req.params.addressId));
  } catch (e) {
    next(e);
  }
};
export const setDefault = async (req, res, next) => {
  try {
    success(res, await service.makeDefault(req.user.id, req.params.addressId));
  } catch (e) {
    next(e);
  }
};
