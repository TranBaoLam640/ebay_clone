import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { AppError } from '../../common/errors/app-error.js';
import * as repository from './seller.repository.js';

const toPublicSeller = (seller) => ({
  id: seller._id,
  displayName: seller.displayName,
  avatarUrl: seller.avatarUrl,
  description: seller.description,
  averageFeedbackRating: seller.averageFeedbackRating,
  feedbackCount: seller.feedbackCount,
});

export const getSeller = async (sellerId) => {
  const seller = await repository.findActiveById(sellerId);
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');

  return toPublicSeller(seller);
};
