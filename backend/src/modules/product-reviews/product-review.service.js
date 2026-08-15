import * as repository from './product-review.repository.js';
import * as productRepository from '../products/product.repository.js';
import * as eligibilityService from '../orders/order-eligibility.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';

const notFound = (message) => new AppError(404, ERROR_CODES.NOT_FOUND, message);

const persistAggregate = async (productId, session) => {
  const aggregate = await repository.aggregate(productId, session);
  const product = await productRepository.updateReviewAggregate(
    productId,
    aggregate,
    session,
  );
  if (!product) throw new Error('Product aggregate update failed');
};

const write = (productId, operation) =>
  repository.transaction(async (session) => {
    const review = await operation(session);
    await persistAggregate(productId, session);
    return repository.toPublic(review, session);
  });

// The route param is a public product uuid; resolve it to the internal
// ObjectId that review documents actually reference.
const resolveProductId = async (productUuid) => {
  const productId = await productRepository.resolveIdByUuid(productUuid);
  if (!productId) throw notFound('Product not found');
  return productId;
};

export const list = async (productUuid, query) => {
  const productId = await resolveProductId(productUuid);
  const { page, limit } = pagination(query);
  const result = await repository.list(productId, {
    rating: query.rating,
    sort: query.sort,
    skip: (page - 1) * limit,
    limit,
  });
  return {
    items: result.items,
    meta: paginationMeta(page, limit, result.total),
  };
};

export const create = async (buyerId, productUuid, input) => {
  const productId = await resolveProductId(productUuid);
  await eligibilityService.verifyDeliveredProductPurchase({
    buyerId,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    productId,
  });
  try {
    return await write(productId, (session) =>
      repository.create({ ...input, buyerId, productId }, session),
    );
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.orderItemId)
      throw new AppError(
        409,
        ERROR_CODES.CONFLICT,
        'This order item has already been reviewed',
      );
    throw error;
  }
};

export const update = (buyerId, reviewId, input) =>
  repository.transaction(async (session) => {
    const review = await repository.updateOwned(
      buyerId,
      reviewId,
      input,
      session,
    );
    if (!review) throw notFound('Review not found');
    await persistAggregate(review.productId, session);
    return repository.toPublic(review, session);
  });

export const remove = (buyerId, reviewId) =>
  repository.transaction(async (session) => {
    const review = await repository.deleteOwned(buyerId, reviewId, session);
    if (!review) throw notFound('Review not found');
    await persistAggregate(review.productId, session);
    return { deleted: true };
  });

export const recent = (productId, limit) => repository.recent(productId, limit);
