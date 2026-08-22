import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './replacement.controller.js';
import { replacementIdSchema } from './replacement.validation.js';

export const replacementRoute = Router();
replacementRoute.use(authenticate);
replacementRoute.post(
  '/:replacementId/accept',
  validate(replacementIdSchema),
  controller.accept,
);
replacementRoute.post(
  '/:replacementId/decline',
  validate(replacementIdSchema),
  controller.decline,
);
replacementRoute.post(
  '/:replacementId/shipment',
  validate(replacementIdSchema),
  controller.prepareShipment,
);
replacementRoute.post(
  '/:replacementId/confirm-received',
  validate(replacementIdSchema),
  controller.confirmReceived,
);
