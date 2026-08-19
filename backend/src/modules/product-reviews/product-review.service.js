import * as repository from './product-review.repository.js';
import * as productRepository from '../products/product.repository.js';
import * as catalogProductRepository from '../catalog-products/catalog-product.repository.js';
import * as eligibilityService from '../orders/order-eligibility.service.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';

const notFound = (message) => new AppError(404, ERROR_CODES.NOT_FOUND, message);

const emptySummary = {
  available: false,
  averageRating: null,
  reviewCount: 0,
  ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const isValidEPID = (value) => typeof value === 'string' && value.trim() !== '';

const availableSummary = (summary) => ({
  available: true,
  ...summary,
});

const persistAggregate = async (catalogProductId, session) => {
  const aggregate = await repository.aggregateByCatalogProduct(
    catalogProductId,
    session,
  );
  await productRepository.updateCatalogReviewAggregate(
    catalogProductId,
    aggregate,
    session,
  );
};

const write = (catalogProductId, operation) =>
  repository.transaction(async (session) => {
    const review = await operation(session);
    await persistAggregate(catalogProductId, session);
    return repository.toPublic(review, session);
  });

// The route param is a public product uuid; resolve it to the internal
// ObjectId that review documents actually reference.
const resolveProductId = async (productUuid) => {
  const product =
    await productRepository.findVisibleInternalByUuid(productUuid);
  if (!product) throw notFound('Product not found');
  return product;
};

const resolveCatalogProduct = async (product) => {
  if (!product.catalogProductId)
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Product is not linked to a catalog product',
    );
  const catalogProduct = await catalogProductRepository.findById(
    product.catalogProductId,
  );
  if (!catalogProduct)
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Product catalog identity is invalid',
    );
  if (!isValidEPID(catalogProduct.ePID))
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Product catalog identity is invalid',
    );
  return catalogProduct;
};

const findReadableCatalogProduct = async (product) => {
  if (!product.catalogProductId) return null;
  const catalogProduct = await catalogProductRepository.findById(
    product.catalogProductId,
  );
  return catalogProduct && isValidEPID(catalogProduct.ePID)
    ? catalogProduct
    : null;
};

const assertNotSelfReview = async (buyerId, product) => {
  const seller = await sellerRepository.findById(product.sellerId);
  if (seller && String(seller.userId) === String(buyerId))
    throw new AppError(
      403,
      ERROR_CODES.FORBIDDEN,
      'Sellers cannot review their own listing',
    );
};

const createResolved = async ({ buyerId, orderId, orderItemId, productId }) => {
  const product = await productRepository.findByInternalId(productId);
  if (!product) throw notFound('Product not found');
  await assertNotSelfReview(buyerId, product);
  const catalogProduct = await resolveCatalogProduct(product);
  await eligibilityService.verifyDeliveredProductPurchase({
    buyerId,
    orderId,
    orderItemId,
    productId: product._id,
  });
  return { product, catalogProduct };
};

export const list = async (productUuid, query) => {
  const product = await resolveProductId(productUuid);
  const catalogProduct = await findReadableCatalogProduct(product);
  const { page, limit } = pagination(query);
  if (!catalogProduct)
    return {
      items: [],
      available: false,
      meta: paginationMeta(page, limit, 0),
    };
  const result = await repository.list(catalogProduct._id, {
    q: query.q,
    rating: query.rating,
    sort: query.sort,
    skip: (page - 1) * limit,
    limit,
  });
  return {
    items: result.items,
    available: true,
    meta: paginationMeta(page, limit, result.total),
  };
};

export const summary = async (productUuid) => {
  const product = await resolveProductId(productUuid);
  const catalogProduct = await findReadableCatalogProduct(product);
  if (!catalogProduct) return emptySummary;
  return availableSummary(
    await repository.aggregateByCatalogProduct(catalogProduct._id),
  );
};

export const createForOrderItem = async (
  buyerId,
  orderId,
  orderItemId,
  input,
) => {
  const purchase = await eligibilityService.verifyDeliveredOrderItemPurchase({
    buyerId,
    orderId,
    orderItemId,
  });
  const item = purchase.order.items[0];
  const { product, catalogProduct } = await createResolved({
    buyerId,
    orderId,
    orderItemId,
    productId: item.productId,
  });
  try {
    return await write(catalogProduct._id, (session) =>
      repository.create(
        {
          rating: input.rating,
          title: input.title,
          description: input.description,
          buyerId,
          orderId,
          orderItemId,
          productId: product._id,
          catalogProductId: catalogProduct._id,
          ePID: catalogProduct.ePID,
        },
        session,
      ),
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

export const create = async (buyerId, productUuid, input) => {
  const product = await resolveProductId(productUuid);
  const { catalogProduct } = await createResolved({
    buyerId,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    productId: product._id,
  });
  try {
    return await write(catalogProduct._id, (session) =>
      repository.create(
        {
          rating: input.rating,
          title: input.title,
          description: input.description,
          buyerId,
          orderId: input.orderId,
          orderItemId: input.orderItemId,
          productId: product._id,
          catalogProductId: catalogProduct._id,
          ePID: catalogProduct.ePID,
        },
        session,
      ),
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
    await persistAggregate(review.catalogProductId, session);
    return repository.toPublic(review, session);
  });

export const remove = (buyerId, reviewId) =>
  repository.transaction(async (session) => {
    const review = await repository.deleteOwned(buyerId, reviewId, session);
    if (!review) throw notFound('Review not found');
    await persistAggregate(review.catalogProductId, session);
    return { deleted: true };
  });

export const recent = (catalogProductId, limit) =>
  repository.recentByCatalogProduct(catalogProductId, limit);
