import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as orderRepository from './order.repository.js';

const forbidden = (message) =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

export const verifyDeliveredProductPurchase = async ({
  buyerId,
  orderId,
  orderItemId,
  productId,
}) => {
  const order = await orderRepository.findDeliveredProductPurchase({
    buyerId,
    orderId,
    orderItemId,
    productId,
  });
  const item = order?.items?.[0];
  if (!item || String(item.sellerId) !== String(order.sellerId)) {
    throw forbidden(
      'The order item is not a delivered purchase of this product',
    );
  }
  return { order, sellerId: order.sellerId };
};

export const verifyDeliveredSellerOrder = async ({
  buyerId,
  orderId,
  sellerId,
}) => {
  const order = await orderRepository.findDeliveredSellerOrder({
    buyerId,
    orderId,
    sellerId,
  });
  if (!order)
    throw forbidden('The order is not a delivered order from this seller');
  return { order, sellerId: order.sellerId };
};
