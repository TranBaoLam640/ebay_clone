import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './seller.controller.js';
import { sellerIdSchema } from './seller.validation.js';

export const sellerRoute = Router();

sellerRoute.get('/:sellerId', validate(sellerIdSchema), controller.getSeller);
