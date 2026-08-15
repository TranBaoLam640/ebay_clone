import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import * as orderEligibilityService from '../orders/order-eligibility.service.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import * as repository from './seller-feedback.repository.js';

const missing = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller feedback not found');

const conflict = () =>
  new AppError(
    409,
    ERROR_CODES.CONFLICT,
    'Seller feedback already exists for this order',
  );

const persistAggregate = async (sellerId, session) => {
  const aggregate = await repository.aggregateForSeller(sellerId, session);
  const seller = await sellerRepository.updateFeedbackAggregate(
    sellerId,
    aggregate,
    session,
  );
  if (!seller) throw new Error('Seller aggregate update failed');
};

export const create = async (buyerId, orderId, input) => {
  const eligibility = await orderEligibilityService.verifyDeliveredSellerOrder({
    buyerId,
    orderId,
  });
  const sellerId = eligibility?.sellerId ?? eligibility?.order?.sellerId;
  if (!sellerId)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Eligible order not found');

  const seller = await sellerRepository.findById(sellerId);
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');
  if (String(seller.userId) === String(buyerId))
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Sellers cannot review themselves',
    );

  try {
    return await repository.transaction(async (session) => {
      const feedback = await repository.create(
        { ...input, buyerId, orderId, sellerId },
        session,
      );
      await persistAggregate(sellerId, session);
      return repository.toPublic(feedback, session);
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.orderId) throw conflict();
    throw error;
  }
};

export const update = (buyerId, feedbackId, input) =>
  repository.transaction(async (session) => {
    const feedback = await repository.updateOwned(
      buyerId,
      feedbackId,
      input,
      session,
    );
    if (!feedback) throw missing();
    await persistAggregate(feedback.sellerId, session);
    return repository.toPublic(feedback, session);
  });

export const remove = (buyerId, feedbackId) =>
  repository.transaction(async (session) => {
    const feedback = await repository.deleteOwned(buyerId, feedbackId, session);
    if (!feedback) throw missing();
    await persistAggregate(feedback.sellerId, session);
    return { deleted: true };
  });

export const listPublic = async (sellerId, query) => {
  const seller = await sellerRepository.activeById(sellerId);
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');

  const { page, limit } = pagination(query);
  const result = await repository.listPublic(sellerId, {
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
