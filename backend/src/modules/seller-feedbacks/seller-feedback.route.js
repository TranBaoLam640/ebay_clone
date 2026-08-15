import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './seller-feedback.controller.js';
import {
  createSellerFeedbackSchema,
  deleteSellerFeedbackSchema,
  listSellerFeedbacksSchema,
  updateSellerFeedbackSchema,
} from './seller-feedback.validation.js';

export const sellerFeedbackPublicRoute = Router();
export const orderSellerFeedbackRoute = Router();
export const sellerFeedbackRoute = Router();

sellerFeedbackPublicRoute.get(
  '/:sellerId/feedbacks',
  validate(listSellerFeedbacksSchema),
  controller.listPublic,
);

orderSellerFeedbackRoute.post(
  '/:orderId/seller-feedback',
  authenticate,
  validate(createSellerFeedbackSchema),
  controller.create,
);

sellerFeedbackRoute.patch(
  '/:feedbackId',
  authenticate,
  validate(updateSellerFeedbackSchema),
  controller.update,
);

sellerFeedbackRoute.delete(
  '/:feedbackId',
  authenticate,
  validate(deleteSellerFeedbackSchema),
  controller.remove,
);
