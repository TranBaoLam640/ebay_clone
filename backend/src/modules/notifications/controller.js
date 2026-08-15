import * as service from './service.js';
import { success } from '../../common/utils/api-response.js';
export const list = async (req, res, next) => {
  try {
    const out = await service.list(req.user.id, req.validated.query);
    success(res, out.items, 200, out.meta);
  } catch (e) {
    next(e);
  }
};
export const count = async (req, res, next) => {
  try {
    success(res, { count: await service.unreadCount(req.user.id) });
  } catch (e) {
    next(e);
  }
};
export const read = async (req, res, next) => {
  try {
    success(res, await service.read(req.user.id, req.params.notificationId));
  } catch (e) {
    next(e);
  }
};
export const readAll = async (req, res, next) => {
  try {
    success(res, await service.readAll(req.user.id));
  } catch (e) {
    next(e);
  }
};
