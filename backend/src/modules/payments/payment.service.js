import { randomUUID } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { USER4_NOTIFICATION_EVENTS } from '../../common/constants/user4-notification-events.js';
import { emailService } from '../../common/services/email.service.js';
import { logger } from '../../config/logger.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as checkoutGroupService from '../checkout-groups/checkout-group.service.js';
import * as orderRepository from '../orders/order.repository.js';
import * as productRepository from '../products/product.repository.js';
import * as userRepository from '../users/repository.js';
import { reverse as reverseCoupon } from '../coupons/coupon.service.js';
import * as notificationService from '../notifications/service.js';
import * as shipmentService from '../shipments/shipment.service.js';
import {
  captureOrder as capturePayPalOrder,
  createOrder as createPayPalOrder,
  validCaptureOutcome,
  validCreateOutcome,
  validFailureOutcome,
} from './providers/paypal-simulation.provider.js';
import * as repository from './payment.repository.js';

const notFound = () =>
  new AppError(404, ERROR_CODES.PAYMENT_NOT_FOUND, 'Payment not found');
const invalidState = (message) =>
  new AppError(409, ERROR_CODES.PAYMENT_INVALID_STATE, message);
const providerError = (message) =>
  new AppError(502, ERROR_CODES.PAYMENT_PROVIDER_ERROR, message);
const PROVIDER_LEASE_MS = 5 * 60_000;
const providerLease = () => {
  const now = new Date();
  return {
    claimToken: randomUUID(),
    now,
    staleBefore: new Date(now.getTime() - PROVIDER_LEASE_MS),
  };
};

const internalPayment = async (buyerId, groupId, session) => {
  const item = await repository.ownedByGroupInternal(buyerId, groupId, session);
  if (!item) throw notFound();
  return item;
};

const publicPayment = async (buyerId, groupId, session) => {
  const item = await repository.ownedByGroup(buyerId, groupId, session);
  if (!item) throw notFound();
  return item;
};

const paymentNotification = (
  buyerId,
  groupId,
  eventType,
  title,
  message,
  session,
) =>
  notificationService.createNotification(
    buyerId,
    {
      type: 'PAYMENT',
      title,
      message,
      referenceType: 'CheckoutGroup',
      referenceId: groupId,
      eventType,
      eventKey: `${eventType}:${groupId}`,
    },
    session,
  );

const shipmentReadyNotification = (buyerId, shipment, session) =>
  notificationService.createNotification(
    buyerId,
    {
      type: 'ORDER',
      title: 'Shipment ready',
      message: 'Your order is ready for pickup by an SBay shipper',
      referenceType: 'Order',
      referenceId: shipment.orderId,
      eventType: USER4_NOTIFICATION_EVENTS.SHIPMENT_READY,
      eventKey: `${USER4_NOTIFICATION_EVENTS.SHIPMENT_READY}:${shipment._id}:BUYER`,
    },
    session,
  );

const sendPurchaseFeedbackEmail = async (buyerId, groupId) => {
  try {
    const [buyer, orders] = await Promise.all([
      userRepository.findById(buyerId),
      orderRepository.byGroupPublic(buyerId, groupId),
    ]);
    if (!buyer?.email) return false;
    return emailService.sendPurchaseFeedbackEmail({
      to: buyer.email,
      buyerName: buyer.fullName,
      checkoutGroupId: String(groupId),
      items: orders.flatMap((order) =>
        (order.items || []).map((item) => ({
          title: item.title || 'Purchased item',
          quantity: item.quantity,
        })),
      ),
    });
  } catch (error) {
    logger.warn(
      { error, buyerId: String(buyerId), checkoutGroupId: String(groupId) },
      'Purchase feedback email dispatch failed',
    );
    return false;
  }
};

const confirmOrdersAndCreateShipments = async (
  buyerId,
  groupId,
  session,
  now = new Date(),
) => {
  await orderRepository.markGroupConfirmed(buyerId, groupId, session);
  const orders = await orderRepository.byGroup(buyerId, groupId, session);
  for (const order of orders) {
    const shipment = await shipmentService.createForOrder(order, {
      session,
      now,
    });
    await shipmentReadyNotification(buyerId, shipment, session);
  }
};

export const createPayPal = async (buyerId, groupId) => {
  const current = await internalPayment(buyerId, groupId);
  if (current.method !== 'PAYPAL')
    throw invalidState('Payment method is not PayPal');
  if (current.status === 'CREATED') return publicPayment(buyerId, groupId);
  if (!['PENDING', 'PROVIDER_CREATING'].includes(current.status))
    throw invalidState('PayPal order cannot be created');
  const lease = providerLease();
  const claimed = await repository.claimPayPalCreate(
    buyerId,
    groupId,
    lease.claimToken,
    lease.now,
    lease.staleBefore,
  );
  if (!claimed) {
    const latest = await internalPayment(buyerId, groupId);
    if (latest.status === 'CREATED') return publicPayment(buyerId, groupId);
    throw invalidState('PayPal order creation is already processing');
  }
  try {
    const outcome = await createPayPalOrder({
      checkoutGroupId: String(groupId),
      amount: claimed.amount,
      currency: claimed.currency,
    });
    if (
      !validCreateOutcome(outcome, {
        amount: claimed.amount,
        currency: claimed.currency,
      })
    )
      throw providerError('PayPal create returned an invalid outcome');
    return await checkoutRepository.transaction(async (session) => {
      const completed = await repository.completePayPalCreate(
        buyerId,
        groupId,
        outcome.providerOrderId,
        lease.claimToken,
        session,
      );
      if (!completed)
        throw invalidState('PayPal order creation claim was lost');
      await paymentNotification(
        buyerId,
        groupId,
        USER4_NOTIFICATION_EVENTS.PAYPAL_CREATED,
        'PayPal order created',
        'Your PayPal order is ready for capture',
        session,
      );
      return completed;
    });
  } catch (error) {
    await repository.releasePayPalCreate(claimed._id, lease.claimToken);
    throw error;
  }
};

const confirmCapture = async (
  buyerId,
  groupId,
  providerOrderId,
  claimToken,
) => {
  const result = await checkoutRepository.transaction(async (session) => {
    const captured = await repository.capture(
      buyerId,
      groupId,
      providerOrderId,
      claimToken,
      session,
    );
    if (!captured) {
      const latest = await internalPayment(buyerId, groupId, session);
      if (latest.status === 'CAPTURED')
        return {
          payment: await repository.ownedByGroup(buyerId, groupId, session),
          shouldEmail: false,
        };
      throw invalidState('Payment cannot be captured');
    }
    await checkoutGroupService.confirmPayment(buyerId, groupId, session);
    await confirmOrdersAndCreateShipments(buyerId, groupId, session);
    await paymentNotification(
      buyerId,
      groupId,
      USER4_NOTIFICATION_EVENTS.PAYPAL_CAPTURED,
      'PayPal payment captured',
      'Your PayPal payment was captured',
      session,
    );
    return { payment: captured, shouldEmail: true };
  });
  if (result.shouldEmail) await sendPurchaseFeedbackEmail(buyerId, groupId);
  return result.payment;
};

const failCapture = (buyerId, groupId, outcome, claimToken) =>
  checkoutRepository.transaction(async (session) => {
    const failed = await repository.claimFailureRestoration(
      buyerId,
      groupId,
      outcome.providerOrderId,
      claimToken,
      outcome.reason,
      session,
    );
    if (!failed) {
      const latest = await internalPayment(buyerId, groupId, session);
      if (latest.status === 'FAILED')
        return repository.ownedByGroup(buyerId, groupId, session);
      throw invalidState('Payment cannot fail');
    }
    const group = await checkoutGroupService.markPaymentFailed(
      buyerId,
      groupId,
      session,
    );
    if (!group) throw invalidState('Payment cannot fail');
    if (group.auctionWin) {
      // Auction / Buy-It-Now win: no cart stock was reserved, and the winner
      // still owes payment, so detach the order and reset it to PENDING_PAYMENT
      // (re-payable) instead of restoring stock and stranding it as FAILED.
      await orderRepository.detachFromGroup(buyerId, groupId, session);
    } else {
      const orders = await orderRepository.byGroup(buyerId, groupId, session);
      for (const order of orders)
        for (const item of order.items)
          await productRepository.restoreStock(
            item.productId,
            item.quantity,
            session,
          );
      await orderRepository.setGroupStatus(
        buyerId,
        groupId,
        'PAYMENT_FAILED',
        session,
      );
    }
    const couponRestored = group.couponId
      ? Boolean(await reverseCoupon(group.couponId, groupId, session))
      : false;
    await checkoutGroupService.markRestored(
      buyerId,
      groupId,
      couponRestored,
      session,
    );
    const restored = await repository.completeRestoration(failed._id, session);
    await paymentNotification(
      buyerId,
      groupId,
      USER4_NOTIFICATION_EVENTS.PAYPAL_FAILED,
      'PayPal payment failed',
      'Your PayPal payment failed and reserved stock was restored',
      session,
    );
    return restored;
  });

export const capturePayPal = async (buyerId, groupId) => {
  const current = await internalPayment(buyerId, groupId);
  if (current.method !== 'PAYPAL')
    throw invalidState('Payment method is not PayPal');
  if (current.status === 'CAPTURED' || current.status === 'FAILED')
    return publicPayment(buyerId, groupId);
  if (
    !['CREATED', 'PROVIDER_CAPTURING'].includes(current.status) ||
    !current.providerOrderId
  )
    throw invalidState('Payment cannot be captured');
  const lease = providerLease();
  const claimed = await repository.claimPayPalCapture(
    buyerId,
    groupId,
    current.providerOrderId,
    lease.claimToken,
    lease.now,
    lease.staleBefore,
  );
  if (!claimed) throw invalidState('PayPal capture is already processing');
  try {
    const outcome = await capturePayPalOrder(claimed.providerOrderId);
    if (validCaptureOutcome(outcome, claimed.providerOrderId))
      return await confirmCapture(
        buyerId,
        groupId,
        claimed.providerOrderId,
        lease.claimToken,
      );
    if (validFailureOutcome(outcome, claimed.providerOrderId, outcome?.reason))
      return await failCapture(buyerId, groupId, outcome, lease.claimToken);
    throw providerError('PayPal capture returned an invalid outcome');
  } catch (error) {
    await repository.releasePayPalCapture(claimed._id, lease.claimToken);
    throw error;
  }
};

export const confirmCod = async (buyerId, groupId) => {
  const result = await checkoutRepository.transaction(async (session) => {
    const current = await internalPayment(buyerId, groupId, session);
    if (current.method !== 'COD')
      throw invalidState('Payment method is not COD');
    if (current.status === 'CONFIRMED')
      return {
        payment: await repository.ownedByGroup(buyerId, groupId, session),
        shouldEmail: false,
      };
    if (current.status !== 'PENDING')
      throw invalidState('COD payment cannot be confirmed');
    const confirmed = await repository.confirmCod(buyerId, groupId, session);
    if (!confirmed) throw invalidState('COD payment cannot be confirmed');
    await checkoutGroupService.confirmPayment(buyerId, groupId, session);
    await confirmOrdersAndCreateShipments(buyerId, groupId, session);
    await paymentNotification(
      buyerId,
      groupId,
      USER4_NOTIFICATION_EVENTS.COD_CONFIRMED,
      'COD order confirmed',
      'Your cash-on-delivery order was confirmed',
      session,
    );
    return { payment: confirmed, shouldEmail: true };
  });
  if (result.shouldEmail) await sendPurchaseFeedbackEmail(buyerId, groupId);
  return result.payment;
};
