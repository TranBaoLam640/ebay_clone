import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './payment.controller.js';
import { paymentActionSchema } from './payment.validation.js';

export const paymentRoute = Router();
paymentRoute.use(authenticate);
paymentRoute.post(
  '/paypal/create',
  validate(paymentActionSchema),
  controller.createPayPal,
);
paymentRoute.post(
  '/paypal/capture',
  validate(paymentActionSchema),
  controller.capturePayPal,
);
paymentRoute.post(
  '/cod/confirm',
  validate(paymentActionSchema),
  controller.confirmCod,
);
