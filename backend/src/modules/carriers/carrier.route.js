import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import * as controller from './carrier.controller.js';

export const carrierRoute = Router();
carrierRoute.use(authenticate);
carrierRoute.get('/', controller.list);
