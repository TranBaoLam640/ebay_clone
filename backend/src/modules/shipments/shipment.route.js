import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './shipment.controller.js';
import { actionSchema, listSchema } from './shipment.validation.js';

export const shipmentRoute = Router();
shipmentRoute.use(authenticate, authorize('SHIPPER'));
shipmentRoute.get('/', validate(listSchema), controller.list);
shipmentRoute.patch(
  '/:shipmentId/pickup',
  validate(actionSchema),
  controller.pickup,
);
shipmentRoute.patch(
  '/:shipmentId/deliver',
  validate(actionSchema),
  controller.deliver,
);
