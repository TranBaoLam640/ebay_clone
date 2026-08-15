import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './return-request.controller.js';
import {
  createSchema,
  idSchema,
  listSchema,
} from './return-request.validation.js';

export const returnRoute = Router();
returnRoute.use(authenticate);
returnRoute.post('/', validate(createSchema), controller.create);
returnRoute.get('/', validate(listSchema), controller.list);
returnRoute.get('/:returnId', validate(idSchema), controller.get);
