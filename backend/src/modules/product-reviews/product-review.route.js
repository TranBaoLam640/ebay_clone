import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './product-review.controller.js';
import {
  createProductReviewSchema,
  createOrderItemProductReviewSchema,
  listProductReviewsSchema,
  productReviewIdSchema,
  reviewSummarySchema,
  updateProductReviewSchema,
} from './product-review.validation.js';

export const nestedProductReviewRoute = Router();
export const orderProductReviewRoute = Router();
export const productReviewRoute = Router();

nestedProductReviewRoute.get(
  '/:productId/reviews',
  validate(listProductReviewsSchema),
  controller.list,
);
nestedProductReviewRoute.get(
  '/:productId/review-summary',
  validate(reviewSummarySchema),
  controller.summary,
);
nestedProductReviewRoute.post(
  '/:productId/reviews',
  authenticate,
  validate(createProductReviewSchema),
  controller.create,
);
orderProductReviewRoute.post(
  '/:orderId/items/:orderItemId/product-review',
  authenticate,
  validate(createOrderItemProductReviewSchema),
  controller.createForOrderItem,
);
productReviewRoute.patch(
  '/:reviewId',
  authenticate,
  validate(updateProductReviewSchema),
  controller.update,
);
productReviewRoute.delete(
  '/:reviewId',
  authenticate,
  validate(productReviewIdSchema),
  controller.remove,
);
