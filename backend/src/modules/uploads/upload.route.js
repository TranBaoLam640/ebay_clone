import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { singleImage } from './upload.middleware.js';
import * as controller from './upload.controller.js';

export const uploadRoute = Router();
uploadRoute.use(authenticate);
uploadRoute.post('/avatar', singleImage, controller.uploadAvatar);
uploadRoute.post('/product-image', singleImage, controller.uploadProductImage);
