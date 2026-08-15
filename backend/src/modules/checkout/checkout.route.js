import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { executeSchema, previewSchema } from './checkout.validation.js';
import * as controller from './checkout.controller.js';

export const checkoutRoute = Router();
checkoutRoute.use(authenticate);
checkoutRoute.post('/', validate(executeSchema), controller.execute);
checkoutRoute.post('/preview', validate(previewSchema), controller.preview);
