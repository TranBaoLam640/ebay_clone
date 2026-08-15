import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as orderRepository from '../orders/order.repository.js';
import * as paymentRepository from '../payments/payment.repository.js';
import * as repository from './checkout-group.repository.js';

export const create = (...args) => repository.create(...args);
export const setOrders = (...args) => repository.setOrders(...args);
export const confirmPayment = (...args) => repository.confirmPayment(...args);
export const markPaymentFailed = (...args) =>
  repository.markPaymentFailed(...args);
export const markRestored = (...args) => repository.markRestored(...args);

export const toPublic = (group) => {
  const source = group?.toObject ? group.toObject() : group;
  return {
    _id: source._id,
    orderIds: source.orderIds,
    paymentId: source.paymentId,
    couponId: source.couponId,
    paymentMethod: source.paymentMethod,
    status: source.status,
    subtotal: source.subtotal,
    discount: source.discount,
    shippingFee: source.shippingFee,
    total: source.total,
    currency: source.currency,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

export const get = async (buyerId, id) => {
  const group = await repository.findOwnedPublic(buyerId, id);
  if (!group)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Checkout group not found');
  const [orders, payment] = await Promise.all([
    orderRepository.byGroupPublic(buyerId, id),
    paymentRepository.ownedByGroup(buyerId, id),
  ]);
  return {
    ...group,
    orders: orders.map(orderRepository.toPublic),
    payment,
  };
};
