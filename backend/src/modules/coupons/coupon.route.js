import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate as validateRequest } from '../../common/middleware/validate.js';
import { validateSchema } from './coupon.validation.js';
import * as controller from './coupon.controller.js';
export const couponRoute = Router();
couponRoute.use(authenticate);
couponRoute.post(
  '/validate',
  validateRequest(validateSchema),
  controller.validate,
);
