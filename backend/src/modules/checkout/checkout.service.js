import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { USER4_NOTIFICATION_EVENTS } from '../../common/constants/user4-notification-events.js';
import { allocateDiscount } from '../../common/services/pricing.service.js';
import * as addressRepository from '../addresses/repository.js';
import { toAddressSnapshot } from '../addresses/address.mapper.js';
import * as cartRepository from '../carts/cart.repository.js';
import { hydrate } from '../carts/cart.service.js';
import {
  consume as consumeCoupon,
  evaluate as evaluateCoupon,
} from '../coupons/coupon.service.js';
import * as productRepository from '../products/product.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import * as paymentRepository from '../payments/payment.repository.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import * as notificationService from '../notifications/service.js';
import * as idempotencyService from '../idempotency/idempotency.service.js';
import * as checkoutGroupService from '../checkout-groups/checkout-group.service.js';
import * as repository from './checkout.repository.js';

const conflict = (code, message) => new AppError(409, code, message);
const json = (value) => JSON.parse(JSON.stringify(value));
const paymentDto = (payment) => ({
  _id: String(payment._id),
  checkoutGroupId: String(payment.checkoutGroupId),
  method: payment.method,
  status: payment.status,
  amount: payment.amount,
  currency: payment.currency,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const isPurchasable = (item) =>
  item.product?.status === 'ACTIVE' &&
  item.product.stock > 0 &&
  Boolean(item.product.seller);

const selection = async (buyerId, input, session) => {
  const address = await addressRepository.owned(
    buyerId,
    input.addressId,
    session,
  );
  if (!address)
    throw new AppError(404, ERROR_CODES.ADDRESS_NOT_FOUND, 'Address not found');
  const cart = await hydrate(
    await cartRepository.findByUser(buyerId, session),
    session,
  );
  const selectedIds = new Set(input.selectedCartItemIds);
  if (selectedIds.size !== input.selectedCartItemIds.length)
    throw conflict(
      ERROR_CODES.CART_SELECTION_INVALID,
      'Cart selection is invalid',
    );
  const selectedItems = cart.items.filter((item) => selectedIds.has(item.id));
  if (selectedItems.length !== selectedIds.size)
    throw conflict(
      ERROR_CODES.CART_SELECTION_INVALID,
      'Cart selection is invalid',
    );
  if (selectedItems.some((item) => !isPurchasable(item)))
    throw conflict(
      ERROR_CODES.PRODUCT_UNAVAILABLE,
      'Selected product is unavailable',
    );
  if (selectedItems.some((item) => item.quantity > item.product.stock))
    throw conflict(
      ERROR_CODES.INSUFFICIENT_STOCK,
      'Selected quantity exceeds stock',
    );
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.itemSubtotal,
    0,
  );
  const coupon = input.couponCode
    ? await evaluateCoupon(
        buyerId,
        input.couponCode,
        subtotal,
        new Date(),
        session,
      )
    : null;
  const discount = coupon?.discount || 0;
  const grouped = Object.values(
    selectedItems.reduce((groups, item) => {
      const sellerId = item.product.seller.id;
      groups[sellerId] ||= {
        sellerId,
        sellerDisplayName: item.product.seller.displayName,
        items: [],
        subtotal: 0,
      };
      groups[sellerId].items.push(item);
      groups[sellerId].subtotal += item.itemSubtotal;
      return groups;
    }, {}),
  ).sort((a, b) => a.sellerId.localeCompare(b.sellerId));
  return {
    selectedItems,
    sellerGroups: allocateDiscount(grouped, discount),
    address: toAddressSnapshot(address),
    subtotal,
    discount,
    total: subtotal - discount,
    stockWarnings: [],
    paymentMethods: ['COD', 'PAYPAL'],
    selectedPaymentMethod: input.paymentMethod,
    currency: 'VND',
    shippingFee: 0,
    coupon,
  };
};

export const preview = (buyerId, input) => selection(buyerId, input);

const notifySellers = async (groupId, sellerGroups, session) => {
  for (const sellerGroup of sellerGroups) {
    const seller = await sellerRepository.findById(
      sellerGroup.sellerId,
      session,
    );
    if (seller)
      await notificationService.createNotification(
        seller.userId,
        {
          type: 'ORDER',
          title: 'New order',
          message: 'A new order was placed',
          referenceType: 'CheckoutGroup',
          referenceId: groupId,
          eventType: USER4_NOTIFICATION_EVENTS.ORDER_PLACED,
          eventKey: `${USER4_NOTIFICATION_EVENTS.ORDER_PLACED}:${groupId}:${sellerGroup.sellerId}`,
        },
        session,
      );
  }
};

export const execute = async (buyerId, key, input) => {
  const hash = idempotencyService.requestHash(input);
  const claim = await idempotencyService.claim('CHECKOUT', buyerId, key, hash);
  if (claim.replay) return claim.replay;
  try {
    return await repository.transaction(async (session) => {
      const checkout = await selection(buyerId, input, session);
      // cart.service.hydrate() now exposes the public uuid as item.productId.
      // Resolve all uuids → internal ObjectIds once (batch) before any DB writes.
      const uuids = checkout.selectedItems.map((item) => item.productId);
      const uuidToId = await productRepository.resolveIdsByUuids(uuids);
      for (const item of checkout.selectedItems) {
        const internalId = uuidToId.get(item.productId);
        if (!internalId)
          throw conflict(
            ERROR_CODES.INSUFFICIENT_STOCK,
            'Selected quantity exceeds stock',
          );
        if (
          !(await productRepository.deductStock(
            internalId,
            item.quantity,
            session,
          ))
        )
          throw conflict(
            ERROR_CODES.INSUFFICIENT_STOCK,
            'Selected quantity exceeds stock',
          );
      }
      const group = await checkoutGroupService.create(
        {
          buyerId,
          orderIds: [],
          couponId: checkout.coupon?.couponId || null,
          paymentMethod: input.paymentMethod,
          status: 'PAYMENT_PENDING',
          subtotal: checkout.subtotal,
          discount: checkout.discount,
          shippingFee: 0,
          total: checkout.total,
          currency: 'VND',
        },
        session,
      );
      const address = checkout.address;
      const orders = await orderRepository.createMany(
        checkout.sellerGroups.map((sellerGroup) => ({
          buyerId,
          checkoutGroupId: group._id,
          sellerId: sellerGroup.sellerId,
          orderStatus: 'PENDING_PAYMENT',
          paymentMethod: input.paymentMethod,
          subtotal: sellerGroup.subtotal,
          discount: sellerGroup.discount,
          shippingFee: 0,
          total: sellerGroup.total,
          currency: 'VND',
          shippingAddress: address,
          items: sellerGroup.items.map((item) => ({
            // item.productId is the public uuid; resolve to internal ObjectId.
            productId: uuidToId.get(item.productId),
            sellerId: sellerGroup.sellerId,
            quantity: item.quantity,
            title: item.product.title,
            // Snapshot the image so order detail never depends on a later fetch.
            image: item.product.primaryImage ?? null,
            unitPrice: item.product.price,
            itemSubtotal: item.itemSubtotal,
          })),
        })),
        session,
      );
      const payment = await paymentRepository.create(
        {
          buyerId,
          checkoutGroupId: group._id,
          method: input.paymentMethod,
          status: 'PENDING',
          amount: checkout.total,
          currency: 'VND',
        },
        session,
      );
      const updatedGroup = await checkoutGroupService.setOrders(
        group._id,
        orders.map((order) => order._id),
        payment._id,
        session,
      );
      if (checkout.coupon)
        await consumeCoupon(
          checkout.coupon,
          buyerId,
          group._id,
          orders.map((order) => order._id),
          session,
        );
      await cartRepository.removeSelected(
        buyerId,
        input.selectedCartItemIds,
        session,
      );
      await notifySellers(group._id, checkout.sellerGroups, session);
      const data = {
        ...checkoutGroupService.toPublic(updatedGroup),
        orders: orders.map(orderRepository.toPublic),
        payment: paymentDto(payment),
      };
      const response = { success: true, data: json(data) };
      const completed = await idempotencyService.complete(
        'CHECKOUT',
        buyerId,
        key,
        claim.claimToken,
        {
          resourceId: group._id,
          responseStatus: 201,
          responseBody: response,
        },
        session,
      );
      if (!completed)
        throw conflict(
          ERROR_CODES.IDEMPOTENCY_PROCESSING,
          'Idempotency claim was lost',
        );
      return { status: 201, body: response };
    });
  } catch (error) {
    await idempotencyService.fail(
      'CHECKOUT',
      buyerId,
      key,
      claim.claimToken,
      error,
    );
    throw error;
  }
};
