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
export const AUTO_FEEDBACK_DELAY_MS = 120000;
export const AUTO_FEEDBACK_COMMENT = 'Automated positive feedback';
const AUTO_FEEDBACK_BATCH_SIZE = 100;
const REVISION_REQUEST_DAYS = 30;
const REVISION_RESPONSE_DAYS = 10;

const normalizeInput = (input) => {
  const out = { ...input };
  if (out.commentText === undefined && out.comment !== undefined) {
    out.commentText = out.comment;
    delete out.comment;
  }
  return out;
};

const normalizeBuyerFeedbackInput = (input) => ({
  ...normalizeInput(input),
  source: 'BUYER',
  submittedAt: new Date(),
});

const sourceOf = (feedback) => feedback.source || 'BUYER';
const submittedAtOf = (feedback) =>
  feedback.submittedAt ? new Date(feedback.submittedAt) : feedback.createdAt;

const revisionMissing = () =>
  new AppError(
    404,
    ERROR_CODES.NOT_FOUND,
    'Feedback revision request not found',
  );

const revisionConflict = (message) =>
  new AppError(409, ERROR_CODES.CONFLICT, message);

const isDuplicateKey = (error) => error?.code === 11000;

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
  const data = {
    ...normalizeBuyerFeedbackInput(input),
    images,
    buyerId,
    orderId: order._id,
    orderItemId: item._id,
    sellerId: item.sellerId,
    productId: item.productId,
  };
  try {
    return await repository.transaction(async (session) => {
      const existing = await repository.findByOrderItem(
        order._id,
        item._id,
        session,
      );
      if (existing) {
        if (sourceOf(existing) !== 'AUTOMATED') throw conflict();
        const replaced = await repository.replaceAutomatedWithBuyer(
          existing._id,
          buyerId,
          data,
          session,
        );
        if (!replaced) throw conflict();
        await persistAggregate(item.sellerId, session);
        return repository.toPublic(replaced, session);
      }
      const feedback = await repository.create(data, session);
      await persistAggregate(item.sellerId, session);
      return repository.toPublic(feedback, session);
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const existing = await repository.findByOrderItem(order._id, item._id);
      if (existing && sourceOf(existing) === 'AUTOMATED') {
        try {
          return await repository.transaction(async (session) => {
            const replaced = await repository.replaceAutomatedWithBuyer(
              existing._id,
              buyerId,
              data,
              session,
            );
            if (!replaced) throw conflict();
            await persistAggregate(item.sellerId, session);
            return repository.toPublic(replaced, session);
          });
        } catch (replaceError) {
          await cleanupFeedbackImages(images);
          throw replaceError;
        }
      }
      await cleanupFeedbackImages(images);
      throw conflict();
    }
    await cleanupFeedbackImages(images);
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

export const update = async (buyerId, feedbackId) => {
  const existing = await repository.findById(feedbackId);
  if (!existing || String(existing.buyerId) !== String(buyerId))
    throw missing();
  throw revisionConflict('Submitted seller feedback cannot be edited directly');
};

export const remove = async (buyerId, feedbackId) => {
  const existing = await repository.findById(feedbackId);
  if (!existing || String(existing.buyerId) !== String(buyerId))
    throw missing();
  throw revisionConflict(
    'Submitted seller feedback cannot be deleted directly',
  );
};

export const addFollowUp = async (buyerId, feedbackId, input) => {
  const existing = await repository.findById(feedbackId);
  if (!existing || String(existing.buyerId) !== String(buyerId))
    throw missing();
  if (sourceOf(existing) !== 'BUYER')
    throw revisionConflict(
      'Automated feedback cannot receive a buyer follow-up',
    );
  if (existing.followUpComment)
    throw revisionConflict('Follow-up comment already submitted');

  const updated = await repository.addFollowUp(
    feedbackId,
    buyerId,
    input.commentText,
    new Date(),
  );
  if (!updated) throw revisionConflict('Follow-up comment already submitted');
  return repository.toPublic(updated);
};

export const listPublic = async (sellerId, query) => {
  const seller = await sellerRepository.activeById(sellerId);
  if (!seller)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Seller not found');

  const { page, limit } = pagination(query);
  const result = await repository.listPublic(sellerId, {
    rating: query.rating,
    commentType: query.commentType,
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

export const createRevisionRequest = async (userId, feedbackId) => {
  const feedback = await repository.findById(feedbackId);
  if (!feedback) throw missing();
  const seller = await sellerRepository.findByUserId(userId);
  if (!seller || String(seller._id) !== String(feedback.sellerId))
    throw forbidden('Only the feedback seller can request revision');
  if (sourceOf(feedback) === 'AUTOMATED')
    throw revisionConflict(
      'Automated feedback cannot receive revision request',
    );
  if (feedback.revisionRequest)
    throw revisionConflict('Feedback revision request already exists');
  if (!['NEUTRAL', 'NEGATIVE'].includes(feedback.commentType))
    throw revisionConflict(
      'Feedback revision is only available for neutral or negative feedback',
    );

  const submittedAt = submittedAtOf(feedback);
  const now = new Date();
  if (
    !submittedAt ||
    now > new Date(submittedAt.getTime() + REVISION_REQUEST_DAYS * DAY_MS)
  )
    throw revisionConflict('Feedback revision request period has expired');

  const updated = await repository.createRevisionRequest(
    feedbackId,
    seller._id,
    {
      status: 'PENDING',
      requestedAt: now,
      expiresAt: new Date(now.getTime() + REVISION_RESPONSE_DAYS * DAY_MS),
    },
  );
  if (!updated)
    throw revisionConflict('Feedback revision request already exists');
  return repository.toPublic(updated);
};

export const respondToRevisionRequest = async (userId, feedbackId, input) => {
  const feedback = await repository.findById(feedbackId);
  if (!feedback) throw missing();
  if (String(feedback.buyerId) !== String(userId))
    throw forbidden('Only the feedback buyer can respond to revision request');
  const revision = feedback.revisionRequest;
  if (!revision) throw revisionMissing();
  const now = new Date();
  if (revision.status !== 'PENDING')
    throw revisionConflict('Feedback revision request is no longer pending');
  if (now > new Date(revision.expiresAt)) {
    await repository.expireRevisionRequest(feedbackId, now);
    throw revisionConflict('Feedback revision request has expired');
  }

  return repository.transaction(async (session) => {
    const updated =
      input.decision === 'ACCEPT'
        ? await repository.acceptRevisionRequest(
            feedbackId,
            userId,
            normalizeInput(input.feedback),
            now,
            session,
          )
        : await repository.declineRevisionRequest(
            feedbackId,
            userId,
            now,
            session,
          );
    if (!updated)
      throw revisionConflict('Feedback revision request is no longer pending');
    await persistAggregate(updated.sellerId, session);
    return repository.toPublic(updated, session);
  });
};

export const processAutomatedPositiveFeedback = async ({
  now = new Date(),
  delayMs = AUTO_FEEDBACK_DELAY_MS,
  limit = AUTO_FEEDBACK_BATCH_SIZE,
} = {}) => {
  const cutoff = new Date(now.getTime() - delayMs);
  const items = await orderRepository.findAutomatedFeedbackEligibleItems({
    cutoff,
    limit,
  });
  let created = 0;
  for (const item of items) {
    try {
      await repository.transaction(async (session) => {
        await repository.create(
          {
            orderId: item.orderId,
            orderItemId: item.orderItemId,
            buyerId: item.buyerId,
            sellerId: item.sellerId,
            productId: item.productId,
            commentType: 'POSITIVE',
            commentText: AUTO_FEEDBACK_COMMENT,
            source: 'AUTOMATED',
            submittedAt: now,
            images: [],
          },
          session,
        );
        await persistAggregate(item.sellerId, session);
      });
      created += 1;
    } catch (error) {
      if (isDuplicateKey(error)) continue;
      logger.error(
        { error, orderId: item.orderId, orderItemId: item.orderItemId },
        'automated seller feedback failed',
      );
    }
  }
  return { created };
};
