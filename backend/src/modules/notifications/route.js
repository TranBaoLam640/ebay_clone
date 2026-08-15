import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { listSchema, notificationIdSchema } from './validation.js';
import * as c from './controller.js';
export const notificationRoute = Router();
notificationRoute.use(authenticate);
notificationRoute.get('/', validate(listSchema), c.list);
notificationRoute.get('/unread-count', c.count);
notificationRoute.patch('/read-all', c.readAll);
notificationRoute.patch(
  '/:notificationId/read',
  validate(notificationIdSchema),
  c.read,
);
