import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as controller from './catalog-product.controller.js';
import {
  catalogProductIdSchema,
  listCatalogProductsSchema,
} from './catalog-product.validation.js';

export const catalogProductRoute = Router();

catalogProductRoute.get(
  '/',
  validate(listCatalogProductsSchema),
  controller.list,
);
catalogProductRoute.get(
  '/:catalogProductId',
  validate(catalogProductIdSchema),
  controller.get,
);
