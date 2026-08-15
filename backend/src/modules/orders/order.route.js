import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './order.controller.js';
import {
  checkoutOrderSchema,
  getSchema,
  listSchema,
} from './order.validation.js';
export const orderRoute = Router();
orderRoute.use(authenticate);
orderRoute.get('/', validate(listSchema), controller.list);
orderRoute.get('/:orderId', validate(getSchema), controller.get);
// Pay for a standalone auction / Buy-It-Now win order: choose address + method,
// then finalize through the existing COD/PayPal payment endpoints.
orderRoute.post(
  '/:orderId/checkout',
  validate(checkoutOrderSchema),
  controller.checkout,
);
