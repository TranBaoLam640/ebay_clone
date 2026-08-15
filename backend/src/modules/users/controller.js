import { success } from '../../common/utils/api-response.js';
import * as service from './service.js';
export const getMe = async (req, res, next) => {
  try {
    success(res, await service.getProfile(req.user.id));
  } catch (e) {
    next(e);
  }
};
export const patchMe = async (req, res, next) => {
  try {
    success(res, await service.updateProfile(req.user.id, req.validated.body));
  } catch (e) {
    next(e);
  }
};
export const password = async (req, res, next) => {
  try {
    success(res, await service.changePassword(req.user.id, req.validated.body));
  } catch (e) {
    next(e);
  }
};
