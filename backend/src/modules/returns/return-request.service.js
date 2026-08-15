import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { USER4_NOTIFICATION_EVENTS } from '../../common/constants/user4-notification-events.js';
import { env } from '../../config/env.js';
import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as notificationService from '../notifications/service.js';
import * as orderRepository from '../orders/order.repository.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import * as repository from './return-request.repository.js';

const returnError = (status, code, message) =>
  new AppError(status, code, message);

const eligibleItem = (order, input, now = new Date()) => {
  const item = order?.items.find(
    (candidate) => String(candidate._id) === input.orderItemId,
  );
  const deliveredAt = order?.deliveredAt
    ? new Date(order.deliveredAt).getTime()
    : null;
  const age = deliveredAt === null ? null : now.getTime() - deliveredAt;
  const withinWindow =
    age !== null && age >= 0 && age <= env.RETURN_WINDOW_DAYS * 86_400_000;
  if (
    !order ||
    order.orderStatus !== 'DELIVERED' ||
    !item ||
    !withinWindow ||
    input.quantity > item.quantity
  )
    throw returnError(
      409,
      ERROR_CODES.RETURN_NOT_ELIGIBLE,
      'Order item is not eligible for return',
    );
  return item;
};

const notify = async (buyerId, sellerId, returnRequestId, session) => {
  await notificationService.createNotification(
    buyerId,
    {
      type: 'RETURN',
      title: 'Return requested',
      message: 'Return requested',
      referenceType: 'ReturnRequest',
      referenceId: returnRequestId,
      eventType: USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED,
      eventKey: `${USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED}:${returnRequestId}:BUYER`,
    },
    session,
  );
  const seller = await sellerRepository.findById(sellerId, session);
  if (seller)
    await notificationService.createNotification(
      seller.userId,
      {
        type: 'RETURN',
        title: 'Return requested',
        message: 'Return requested',
        referenceType: 'ReturnRequest',
        referenceId: returnRequestId,
        eventType: USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED,
        eventKey: `${USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED}:${returnRequestId}:SELLER`,
      },
      session,
    );
};

export const create = (buyerId, input) =>
  checkoutRepository.transaction(async (session) => {
    const order = await orderRepository.findOwned(
      buyerId,
      input.orderId,
      session,
    );
    const item = eligibleItem(order, input);
    try {
      const created = await repository.create(
        {
          buyerId,
          orderId: order._id,
          sellerId: order.sellerId,
          orderItemId: item._id,
          productId: item.productId,
          quantity: input.quantity,
          reason: input.reason,
          details: input.details,
        },
        session,
      );
      await notify(buyerId, order.sellerId, created._id, session);
      return repository.toPublic(created);
    } catch (error) {
      if (error?.code === 11000)
        throw returnError(
          409,
          ERROR_CODES.CONFLICT,
          'A return request already exists for this order',
        );
      throw error;
    }
  });

export const list = async (buyerId, query) => {
  const { page, limit } = pagination(query);
  const [items, total] = await Promise.all([
    repository.list(buyerId, (page - 1) * limit, limit),
    repository.count(buyerId),
  ]);
  return { items, meta: paginationMeta(page, limit, total) };
};

export const get = async (buyerId, id) => {
  const item = await repository.owned(buyerId, id);
  if (!item)
    throw returnError(
      404,
      ERROR_CODES.RETURN_REQUEST_NOT_FOUND,
      'Return request not found',
    );
  return item;
};
