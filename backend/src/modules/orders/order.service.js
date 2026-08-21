import { pagination, paginationMeta } from '../../common/utils/pagination.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as repository from './order.repository.js';
import * as productRepository from '../products/product.repository.js';
import * as reviewRepository from '../product-reviews/product-review.repository.js';
import * as sellerFeedbackRepository from '../seller-feedbacks/seller-feedback.repository.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as checkoutGroupService from '../checkout-groups/checkout-group.service.js';
import * as paymentRepository from '../payments/payment.repository.js';
import * as addressRepository from '../addresses/repository.js';
import * as shipmentRepository from '../shipments/shipment.repository.js';
import { toAddressSnapshot } from '../addresses/address.mapper.js';

/**
 * Enrich orders with client-facing fields (batched across all orders):
 * - `productUuid`: the public product id used to link/review/fetch a product.
 * - `reviewed` (per item): whether this line already has a product review (one
 *   per item), so the UI can disable an already-used review button.
 * - `productReview` / `canWriteProductReview`: exact per-order-item product
 *   review state, based on Product -> CatalogProduct -> valid ePID.
 * - `sellerFeedbacked` (per item): whether this line already has seller
 *   feedback. `sellerRated` remains as a legacy per-order convenience flag.
 */
const enrichItems = async (orders) => {
  const items = orders.flatMap((order) => order.items || []);
  if (items.length === 0) return orders;
  const productIds = items.map((item) => item.productId);
  const orderItemIds = items.map((item) => item._id);
  const orderIds = orders.map((order) => order._id);
  const [
    uuidById,
    reviewByOrderItemId,
    productReviewAvailabilityById,
    feedbackedItemIds,
    feedbackedOrderIds,
  ] = await Promise.all([
    productRepository.resolveUuidsByIds(productIds),
    reviewRepository.reviewsByOrderItemIds(orderItemIds),
    productRepository.reviewAvailabilityByIds(productIds),
    sellerFeedbackRepository.feedbackedOrderItemIds(orderItemIds),
    sellerFeedbackRepository.feedbackedOrderIds(orderIds),
  ]);
  return orders.map((order) => ({
    ...order,
    sellerRated: feedbackedOrderIds.has(String(order._id)),
    items: (order.items || []).map((item) => {
      const review = reviewByOrderItemId.get(String(item._id)) ?? null;
      const reviewAvailability = productReviewAvailabilityById.get(
        String(item.productId),
      );
      const productReviewAvailable = Boolean(
        reviewAvailability?.productReviewAvailable,
      );
      return {
        ...item,
        productUuid: uuidById.get(String(item.productId)) ?? null,
        productReviewAvailable,
        catalogProduct: reviewAvailability?.catalogProduct ?? null,
        productReview: review,
        reviewed: Boolean(review),
        canWriteProductReview:
          order.orderStatus === 'DELIVERED' &&
          productReviewAvailable &&
          !review &&
          String(reviewAvailability?.sellerUserId ?? '') !==
            String(order.buyerId),
        sellerFeedbacked: feedbackedItemIds.has(String(item._id)),
      };
    }),
  }));
};

const attachShipments = async (orders) => {
  if (orders.length === 0) return orders;
  const shipments = await shipmentRepository.findByOrderIds(
    orders.map((order) => order._id),
  );
  const shipmentByOrderId = new Map(
    shipments.map((shipment) => [
      String(shipment.orderId),
      shipmentRepository.toBuyerPublic(shipment),
    ]),
  );
  return orders.map((order) => ({
    ...order,
    shipment: shipmentByOrderId.get(String(order._id)) ?? null,
  }));
};

export const list = async (buyerId, query) => {
  const { page, limit } = pagination(query);
  const [items, total] = await Promise.all([
    repository.listOwned(buyerId, query, (page - 1) * limit, limit),
    repository.countOwned(buyerId, query),
  ]);
  return {
    items: (await attachShipments(await enrichItems(items))).map(
      repository.toPublic,
    ),
    meta: paginationMeta(page, limit, total),
  };
};

export const get = async (buyerId, id) => {
  const order = await repository.findOwnedPublic(buyerId, id);
  if (!order) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  const [enriched] = await attachShipments(await enrichItems([order]));
  return repository.toPublic(enriched);
};

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

/**
 * Check out an existing standalone order — an auction / Buy-It-Now win, created
 * with no checkoutGroupId or shipping address (see auctions createOrderForWin).
 * Wraps it in a fresh checkout group + payment and stamps the chosen address, so
 * the normal COD/PayPal payment endpoints (keyed by checkoutGroupId) can finalize
 * it — the same eBay flow as a cart order, just on a pre-created win order.
 * Idempotent: an order already attached to a group is returned as-is so a retry
 * (or a double click) never creates a second group.
 */
export const checkoutOrder = async (buyerId, orderId, input) => {
  const existing = await repository.findOwned(buyerId, orderId);
  if (!existing)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Order not found');
  if (existing.checkoutGroupId)
    return json(
      await checkoutGroupService.get(buyerId, existing.checkoutGroupId),
    );
  if (existing.orderStatus !== 'PENDING_PAYMENT')
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'Order is not awaiting payment',
    );
  const address = await addressRepository.owned(buyerId, input.addressId);
  if (!address)
    throw new AppError(404, ERROR_CODES.ADDRESS_NOT_FOUND, 'Address not found');
  const shippingAddress = toAddressSnapshot(address);
  const currency = existing.currency || 'VND';
  return checkoutRepository.transaction(async (session) => {
    const group = await checkoutGroupService.create(
      {
        buyerId,
        orderIds: [],
        couponId: null,
        paymentMethod: input.paymentMethod,
        status: 'PAYMENT_PENDING',
        subtotal: existing.subtotal,
        discount: existing.discount ?? 0,
        shippingFee: 0,
        total: existing.total,
        currency,
        auctionWin: true,
      },
      session,
    );
    const attached = await repository.attachToGroup(
      buyerId,
      orderId,
      {
        checkoutGroupId: group._id,
        shippingAddress,
        paymentMethod: input.paymentMethod,
      },
      session,
    );
    if (!attached)
      throw new AppError(
        409,
        ERROR_CODES.CONFLICT,
        'Order is no longer awaiting payment',
      );
    const payment = await paymentRepository.create(
      {
        buyerId,
        checkoutGroupId: group._id,
        method: input.paymentMethod,
        status: 'PENDING',
        amount: existing.total,
        currency,
      },
      session,
    );
    const updatedGroup = await checkoutGroupService.setOrders(
      group._id,
      [attached._id],
      payment._id,
      session,
    );
    return json({
      ...checkoutGroupService.toPublic(updatedGroup),
      orders: [repository.toPublic(attached)],
      payment: paymentDto(payment),
    });
  });
};
