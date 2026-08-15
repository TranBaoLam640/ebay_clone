import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './checkout-group.controller.js';
import { groupSchema } from './checkout-group.validation.js';

export const checkoutGroupRoute = Router();
checkoutGroupRoute.use(authenticate);
checkoutGroupRoute.get(
  '/:checkoutGroupId',
  validate(groupSchema),
  controller.get,
);
