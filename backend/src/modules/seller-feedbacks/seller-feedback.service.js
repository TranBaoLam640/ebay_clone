import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import { logger } from '../../config/logger.js';
import * as orderEligibilityService from '../orders/order-eligibility.service.js';
import * as orderRepository from '../orders/order.repository.js';
import * as productRepository from '../products/product.repository.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import { deleteObject, uploadImage } from '../uploads/upload.service.js';
import * as repository from './seller-feedback.repository.js';

const missing = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller feedback not found');

const conflict = () =>
  new AppError(
    409,
    ERROR_CODES.CONFLICT,
    'Seller feedback already exists for this order item',
  );

const orderItemMissing = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Order item not found');

const forbidden = (message) =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

const DAY_MS = 86_400_000;
const SOURCE_DELIVERED_OR_EXPECTED_DAYS = 60;
const SOURCE_PURCHASE_FALLBACK_DAYS = 90;

const normalizeInput = (input) => {
  const out = { ...input };
  if (out.commentText === undefined && out.comment !== undefined) {
    out.commentText = out.comment;
    delete out.comment;
  }
  return out;
};

export const feedbackDeadline = (order) => {
  const expectedDeliveryDate = order.expectedDeliveryDate
    ? new Date(order.expectedDeliveryDate)
    : null;
  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
  if (expectedDeliveryDate) {
    const reference =
      deliveredAt && deliveredAt < expectedDeliveryDate
        ? deliveredAt
        : expectedDeliveryDate;
    return new Date(
      reference.getTime() + SOURCE_DELIVERED_OR_EXPECTED_DAYS * DAY_MS,
    );
  }
  const purchaseDate = order.createdAt ? new Date(order.createdAt) : null;
  if (!purchaseDate) return null;
  return new Date(
    purchaseDate.getTime() + SOURCE_PURCHASE_FALLBACK_DAYS * DAY_MS,
  );
};

const assertWithinFeedbackPeriod = (order, now = new Date()) => {
  const deadline = feedbackDeadline(order);
  if (deadline && now > deadline)
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Feedback period has expired',
    );
  return deadline;
};

const uploadFeedbackImages = async (files = []) => {
  const uploaded = [];
  try {
    for (const file of files) {
      if (!file?.size)
        throw new AppError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Feedback image is empty',
        );
      uploaded.push(await uploadImage(file, 'seller-feedbacks'));
    }
    return uploaded;
  } catch (error) {
    await cleanupFeedbackImages(uploaded);
    throw error;
  }
};

const cleanupFeedbackImages = async (images = []) => {
  for (const image of images) {
    try {
      await deleteObject(image.key);
    } catch (error) {
      logger.error(
        { error, key: image.key },
        'failed to delete seller feedback image',
      );
    }
  }
};

const persistAggregate = async (sellerId, session) => {
  const aggregate = await repository.aggregateForSeller(sellerId, session);
  const seller = await sellerRepository.updateFeedbackAggregate(
    sellerId,
    aggregate,
    session,
  );
  if (!seller) throw new Error('Seller aggregate update failed');
};

const verifySeller = async (sellerId, buyerId, session) => {
  if (!sellerId) throw orderItemMissing();
  const seller = await sellerRepository.findById(sellerId, session);
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');
  if (String(seller.userId) === String(buyerId))
    throw forbidden('Sellers cannot review themselves');
  return seller;
};

const createResolved = async (buyerId, order, item, input, files = []) => {
  await verifySeller(item.sellerId, buyerId);
  assertWithinFeedbackPeriod(order);
  const images = await uploadFeedbackImages(files);
  try {
    return await repository.transaction(async (session) => {
      const feedback = await repository.create(
        {
          ...normalizeInput(input),
          images,
          buyerId,
          orderId: order._id,
          orderItemId: item._id,
          sellerId: item.sellerId,
          productId: item.productId,
        },
        session,
      );
      await persistAggregate(item.sellerId, session);
      return repository.toPublic(feedback, session);
    });
  } catch (error) {
    await cleanupFeedbackImages(images);
    if (error?.code === 11000) throw conflict();
    throw error;
  }
};

export const createForOrderItem = async (
  buyerId,
  orderId,
  orderItemId,
  input,
  files,
) => {
  const order = await orderRepository.findOwned(buyerId, orderId);
  if (!order || order.orderStatus !== 'DELIVERED')
    throw forbidden('The order is not a delivered order from this seller');
  const item = order.items?.find(
    (candidate) => String(candidate._id) === String(orderItemId),
  );
  if (!item) throw orderItemMissing();
  return createResolved(buyerId, order, item, input, files);
};

export const create = async (buyerId, orderId, input, files) => {
  const eligibility = await orderEligibilityService.verifyDeliveredSellerOrder({
    buyerId,
    orderId,
  });
  const items = eligibility?.order?.items || [];
  if (items.length !== 1)
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'Legacy seller feedback endpoint only supports single-item orders',
    );
  return createResolved(buyerId, eligibility.order, items[0], input, files);
};

export const getForOrderItem = async (userId, orderId, orderItemId) => {
  const order = await orderRepository.findOrderItem({ orderId, orderItemId });
  const item = order?.items?.[0];
  if (!item) throw orderItemMissing();
  const seller = await sellerRepository.findByUserId(userId);
  const canAccess =
    String(order.buyerId) === String(userId) ||
    String(seller?._id) === String(item.sellerId);
  if (!canAccess) throw forbidden('The order item is not accessible');
  const feedback = await repository.findByOrderItem(orderId, orderItemId);
  if (!feedback) return { exists: false };
  return {
    exists: true,
    feedback: await repository.toPublic(feedback),
  };
};

export const awaiting = async (buyerId) => {
  const orders = await orderRepository.deliveredWithItemsForFeedback(buyerId);
  const items = orders.flatMap((order) =>
    (order.items || []).map((item) => ({ order, item })),
  );
  const feedbacked = await repository.feedbackedOrderItemIds(
    items.map(({ item }) => item._id),
  );
  const awaitingItems = items.filter(
    ({ order, item }) =>
      !feedbacked.has(String(item._id)) &&
      feedbackDeadline(order) &&
      new Date() <= feedbackDeadline(order),
  );
  const [products, sellers] = await Promise.all([
    productRepository.findPublicByIds(
      awaitingItems.map(({ item }) => item.productId),
    ),
    sellerRepository.findPublicByIds(
      awaitingItems.map(({ item }) => item.sellerId),
    ),
  ]);
  return awaitingItems.map(({ order, item }) => {
    const product = products.get(String(item.productId));
    const seller = sellers.get(String(item.sellerId));
    return {
      orderId: order._id,
      orderItemId: item._id,
      productId: item.productId,
      sellerId: item.sellerId,
      quantity: item.quantity,
      title: item.title,
      image: item.image,
      unitPrice: item.unitPrice,
      itemSubtotal: item.itemSubtotal,
      product: product
        ? {
            id: product.uuid,
            title: product.title,
            primaryImage: product.images?.[0] ?? null,
          }
        : null,
      seller: seller
        ? {
            id: seller._id,
            displayName: seller.displayName,
            avatarUrl: seller.avatarUrl,
          }
        : null,
      eligibleForSellerFeedback: true,
      feedbackDeadline: feedbackDeadline(order),
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
    };
  });
};

export const update = (buyerId, feedbackId, input) =>
  repository.transaction(async (session) => {
    const feedback = await repository.updateOwned(
      buyerId,
      feedbackId,
      normalizeInput(input),
      session,
    );
    if (!feedback) throw missing();
    await persistAggregate(feedback.sellerId, session);
    return repository.toPublic(feedback, session);
  });

export const remove = async (buyerId, feedbackId) => {
  let images = [];
  const result = await repository.transaction(async (session) => {
    const feedback = await repository.deleteOwned(buyerId, feedbackId, session);
    if (!feedback) throw missing();
    images = feedback.images || [];
    await persistAggregate(feedback.sellerId, session);
    return { deleted: true };
  });
  await cleanupFeedbackImages(images);
  return result;
};

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

export const summary = async (sellerId) => {
  const seller = await sellerRepository.activeById(sellerId);
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');
  return {
    sellerId,
    totalFeedbackCount: seller.feedbackCount,
    legacyAverageFeedbackRating: seller.averageFeedbackRating,
    ...(await repository.summaryForSeller(sellerId)),
  };
};

export const respond = async (userId, feedbackId, input) => {
  const feedback = await repository.findById(feedbackId);
  if (!feedback) throw missing();
  const seller = await sellerRepository.findByUserId(userId);
  if (!seller || String(seller._id) !== String(feedback.sellerId))
    throw forbidden('Only the feedback seller can respond');
  const updated = await repository.respondOnce(
    feedbackId,
    seller._id,
    input.commentText,
  );
  if (!updated)
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Seller response already exists for this feedback',
    );
  return repository.toPublic(updated);
};
