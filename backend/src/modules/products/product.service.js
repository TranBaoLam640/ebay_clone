import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { paginationMeta } from '../../common/utils/pagination.js';
import * as repository from './product.repository.js';
import * as categoryRepository from '../categories/category.repository.js';
import * as reviewRepository from '../product-reviews/product-review.repository.js';

export const list = async (query) => {
  // The category filter arrives as a public uuid; resolve to the internal id.
  let resolvedQuery = query;
  if (query.categoryId) {
    const categoryId = await categoryRepository.resolveIdByUuid(
      query.categoryId,
    );
    // Unknown category → no matches, not an error.
    if (!categoryId)
      return { items: [], meta: paginationMeta(query.page, query.limit, 0) };
    resolvedQuery = { ...query, categoryId: String(categoryId) };
  }
  const { items, totalItems } = await repository.listVisible(resolvedQuery);
  return { items, meta: paginationMeta(query.page, query.limit, totalItems) };
};

// Live stock/status for a batch of uuids — polled by the realtime buyer views.
export const availability = (uuids) =>
  repository.findAvailabilityByUuids(uuids);

export const detail = async (productUuid) => {
  const product = await repository.findVisibleById(productUuid);
  if (!product)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Product not found');
  // Reviews reference the internal ObjectId — resolve the public uuid first.
  const internalId = await repository.resolveIdByUuid(productUuid);
  return {
    ...product,
    recentReviews: await reviewRepository.recent(internalId, 5),
  };
};
