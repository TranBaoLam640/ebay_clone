import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import {
  availabilitySchema,
  detailSchema,
  listSchema,
} from './product.validation.js';
import * as controller from './product.controller.js';

export const productRoute = Router();
productRoute.get('/', validate(listSchema), controller.list);
// Registered before /:productId so the literal path isn't captured as an id.
productRoute.get(
  '/availability',
  validate(availabilitySchema),
  controller.availability,
);
productRoute.get('/:productId', validate(detailSchema), controller.detail);
