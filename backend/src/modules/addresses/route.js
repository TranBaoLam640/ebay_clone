import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { addressIdSchema, createSchema, updateSchema } from './validation.js';
import * as c from './controller.js';
export const addressRoute = Router();
addressRoute.use(authenticate);
addressRoute.get('/', c.list);
addressRoute.post('/', validate(createSchema), c.create);
addressRoute.patch('/:addressId', validate(updateSchema), c.update);
addressRoute.delete('/:addressId', validate(addressIdSchema), c.remove);
addressRoute.patch(
  '/:addressId/default',
  validate(addressIdSchema),
  c.setDefault,
);
