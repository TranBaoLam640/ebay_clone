import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as productRepository from '../products/product.repository.js';
import * as offerRepository from './offer.repository.js';

// Best Offer, buyer half: a buyer proposes a price on an offers-enabled FIXED
// listing, sees it in My Offers, and can withdraw it while pending. The seller
// Accept/Decline/Counter side is out of scope (needs a seller actor).

const OFFER_TTL_MS = 48 * 60 * 60 * 1000;

// Resolve a public product uuid → internal ObjectId, or throw 404.
const resolveProductId = async (productUuid) => {
  const productId = await productRepository.resolveIdByUuid(productUuid);
  if (!productId)
    throw new AppError(404, ERROR_CODES.AUCTION_NOT_FOUND, 'Product not found');
  return productId;
};

const toOfferView = (offer, product) => ({
  id: String(offer._id),
  productUuid: product?.uuid ?? null,
  productTitle: product?.title ?? null,
  productImage: product?.images?.[0] ?? null,
  amount: offer.amount,
  quantity: offer.quantity,
  message: offer.message ?? null,
  status: offer.status,
  expiresAt: offer.expiresAt,
  createdAt: offer.createdAt,
});

export const createOffer = async ({
  productUuid,
  buyerId,
  amount,
  quantity = 1,
  message,
}) => {
  const productId = await resolveProductId(productUuid);
  const product = await productRepository.findOfferable(productId);
  if (!product)
    throw new AppError(404, ERROR_CODES.AUCTION_NOT_FOUND, 'Product not found');
  if (product.listingType !== 'FIXED' || !product.offersEnabled)
    throw new AppError(
      409,
      ERROR_CODES.OFFERS_NOT_ENABLED,
      'This listing does not accept offers',
    );
  const offer = await offerRepository.create({
    productId,
    buyerId,
    amount,
    quantity,
    message,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + OFFER_TTL_MS),
  });
  return toOfferView(offer, product);
};

export const withdrawOffer = async (buyerId, offerId) => {
  const offer = await offerRepository.withdrawIfPending(buyerId, offerId);
  if (!offer)
    throw new AppError(
      404,
      ERROR_CODES.OFFER_NOT_FOUND,
      'No pending offer to withdraw',
    );
  return { id: String(offer._id), status: offer.status };
};

export const listMyOffers = async (buyerId) => {
  const offers = await offerRepository.listByBuyer(buyerId);
  const productMap = await productRepository.findPublicByIds(
    offers.map((o) => o.productId),
  );
  return offers.map((offer) =>
    toOfferView(offer, productMap.get(String(offer.productId))),
  );
};
