import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { paginationMeta } from '../../common/utils/pagination.js';
import * as repository from './catalog-product.repository.js';

const notFound = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Catalog product not found');

export const list = async (query) => {
  const { page, limit } = query;
  const result = await repository.list({
    ...query,
    skip: (page - 1) * limit,
    limit,
  });
  return {
    items: result.items,
    meta: paginationMeta(page, limit, result.total),
  };
};

export const get = async (catalogProductId) => {
  const item = await repository.findPublicById(catalogProductId);
  if (!item) throw notFound();
  return item;
};

export const getByEPID = async (ePID) => {
  const item = await repository.findPublicByEPID(ePID);
  if (!item) throw notFound();
  return item;
};
