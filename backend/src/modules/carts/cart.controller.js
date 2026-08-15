import { success } from '../../common/utils/api-response.js';
import * as service from './cart.service.js';

const handle = (work) => async (req, res, next) => {
  try {
    success(res, await work(req));
  } catch (error) {
    next(error);
  }
};

export const get = handle((req) => service.get(req.user.id));
export const add = handle((req) =>
  service.add(req.user.id, req.validated.body),
);
export const update = handle((req) =>
  service.update(req.user.id, req.params.productId, req.validated.body),
);
export const remove = handle((req) =>
  service.remove(req.user.id, req.params.productId),
);
export const clear = handle((req) => service.clear(req.user.id));
export const sync = handle((req) =>
  service.sync(req.user.id, req.validated.body.items),
);
