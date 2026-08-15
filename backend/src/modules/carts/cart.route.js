import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './cart.controller.js';
import * as validation from './cart.validation.js';

export const cartRoute = Router();
cartRoute.use(authenticate);
cartRoute.get('/', controller.get);
cartRoute.post('/items', validate(validation.itemSchema), controller.add);
cartRoute.patch(
  '/items/:productId',
  validate(validation.updateItemSchema),
  controller.update,
);
cartRoute.delete(
  '/items/:productId',
  validate(validation.productIdSchema),
  controller.remove,
);
cartRoute.delete('/', controller.clear);
cartRoute.post('/sync', validate(validation.syncSchema), controller.sync);
