import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { feedbackImages } from '../uploads/upload.middleware.js';
import * as controller from './seller-feedback.controller.js';
import {
  awaitingSellerFeedbackSchema,
  createOrderItemSellerFeedbackSchema,
  createSellerFeedbackSchema,
  deleteSellerFeedbackSchema,
  getOrderItemSellerFeedbackSchema,
  listSellerFeedbacksSchema,
  respondToSellerFeedbackSchema,
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

sellerFeedbackPublicRoute.get(
  '/:sellerId/feedback-summary',
  validate(listSellerFeedbacksSchema),
  controller.summary,
);

orderSellerFeedbackRoute.post(
  '/:orderId/seller-feedback',
  authenticate,
  feedbackImages,
  validate(createSellerFeedbackSchema),
  controller.create,
);

orderSellerFeedbackRoute.get(
  '/:orderId/items/:orderItemId/seller-feedback',
  authenticate,
  validate(getOrderItemSellerFeedbackSchema),
  controller.getForOrderItem,
);

orderSellerFeedbackRoute.post(
  '/:orderId/items/:orderItemId/seller-feedback',
  authenticate,
  feedbackImages,
  validate(createOrderItemSellerFeedbackSchema),
  controller.createForOrderItem,
);

sellerFeedbackRoute.get(
  '/awaiting',
  authenticate,
  validate(awaitingSellerFeedbackSchema),
  controller.awaiting,
);

sellerFeedbackRoute.post(
  '/:feedbackId/response',
  authenticate,
  validate(respondToSellerFeedbackSchema),
  controller.respond,
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
