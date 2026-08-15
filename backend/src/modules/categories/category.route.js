import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './category.controller.js';
import {
  categoryIdSchema,
  listCategoriesSchema,
} from './category.validation.js';

export const categoryRoute = Router();

categoryRoute.get(
  '/',
  validate(listCategoriesSchema),
  controller.listCategories,
);
categoryRoute.get(
  '/:categoryId',
  validate(categoryIdSchema),
  controller.getCategory,
);
