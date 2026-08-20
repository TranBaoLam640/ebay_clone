import { toAddressSnapshot } from '../addresses/address.mapper.js';
import { Order } from './order.model.js';

const publicProjection = {
  _id: 1,
  buyerId: 1,
  sellerId: 1,
  checkoutGroupId: 1,
  orderStatus: 1,
  paymentMethod: 1,
  subtotal: 1,
  discount: 1,
  shippingFee: 1,
  total: 1,
  currency: 1,
  shippingAddress: 1,
  deliveredAt: 1,
  items: 1,
  createdAt: 1,
  updatedAt: 1,
};
const sorts = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
};

const ownedFilter = (buyerId, query = {}) => {
  const filter = { buyerId };
  if (query.status) filter.orderStatus = query.status;
  if (query.sellerId) filter.sellerId = query.sellerId;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }
  return filter;
};

const toItemPublic = (item) => ({
  _id: item._id,
  productId: item.productId,
  sellerId: item.sellerId,
  quantity: item.quantity,
  ...(item.title !== undefined && { title: item.title }),
  ...(item.image !== undefined && { image: item.image }),
  ...(item.unitPrice !== undefined && { unitPrice: item.unitPrice }),
  ...(item.itemSubtotal !== undefined && { itemSubtotal: item.itemSubtotal }),
  ...(item.offerId && { offerId: item.offerId }),
  ...(item.originalPrice !== undefined && {
    originalPrice: item.originalPrice,
  }),
  ...(item.finalPrice !== undefined && { finalPrice: item.finalPrice }),
  ...(item.productUuid !== undefined && { productUuid: item.productUuid }),
  ...(item.productReviewAvailable !== undefined && {
    productReviewAvailable: item.productReviewAvailable,
  }),
  ...(item.catalogProduct !== undefined && {
    catalogProduct: item.catalogProduct,
  }),
  ...(item.productReview !== undefined && {
    productReview: item.productReview,
  }),
  ...(item.canWriteProductReview !== undefined && {
    canWriteProductReview: item.canWriteProductReview,
  }),
  ...(item.reviewed !== undefined && { reviewed: item.reviewed }),
  ...(item.sellerFeedbacked !== undefined && {
    sellerFeedbacked: item.sellerFeedbacked,
  }),
});

export const toPublic = (order) => {
  const source = order?.toObject ? order.toObject() : order;
  return {
    _id: source._id,
    sellerId: source.sellerId,
    ...(source.checkoutGroupId && { checkoutGroupId: source.checkoutGroupId }),
    orderStatus: source.orderStatus,
    ...(source.paymentMethod && { paymentMethod: source.paymentMethod }),
    ...(source.subtotal !== undefined && { subtotal: source.subtotal }),
    ...(source.discount !== undefined && { discount: source.discount }),
    ...(source.shippingFee !== undefined && {
      shippingFee: source.shippingFee,
    }),
    ...(source.total !== undefined && { total: source.total }),
    ...(source.currency && { currency: source.currency }),
    ...(source.shippingAddress && {
      shippingAddress: toAddressSnapshot(source.shippingAddress),
    }),
    ...(source.deliveredAt && { deliveredAt: source.deliveredAt }),
    ...(source.offerId && { offerId: source.offerId }),
    ...(source.shipment !== undefined && { shipment: source.shipment ?? null }),
    items: (source.items || []).map(toItemPublic),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

export const createMany = (orders, session) =>
  Order.create(orders, { session, ordered: true });

/**
 * Existing won-auction order for a buyer+product, if any. Auction-won orders
 * carry no checkoutGroupId, which distinguishes them from cart checkouts and
 * makes win-order creation idempotent under a double close.
 */
export const findAuctionWinOrder = (buyerId, productId) =>
  Order.findOne({
    buyerId,
    checkoutGroupId: { $exists: false },
    'items.productId': productId,
  }).lean();

export const listOwned = (buyerId, query, skip, limit) =>
  Order.find(ownedFilter(buyerId, query))
    .select(publicProjection)
    .sort(sorts[query.sort])
    .skip(skip)
    .limit(limit)
    .lean();

export const countOwned = (buyerId, query) =>
  Order.countDocuments(ownedFilter(buyerId, query));

export const findOwned = (buyerId, id, session) =>
  Order.findOne({ _id: id, buyerId })
    .session(session || null)
    .lean();

export const findOwnedPublic = (buyerId, id) =>
  Order.findOne({ _id: id, buyerId }).select(publicProjection).lean();

/**
 * Wrap a standalone PENDING_PAYMENT order (an auction / Buy-It-Now win, created
 * with no checkoutGroupId) into a checkout group at pay time: stamp the group
 * id, the chosen shipping-address snapshot, and the payment method. Guarded on
 * `checkoutGroupId` absent so a retry or a race wraps the order exactly once.
 * Returns the updated doc, or null if it was already wrapped or not payable.
 */
export const attachToGroup = (
  buyerId,
  orderId,
  { checkoutGroupId, shippingAddress, paymentMethod },
  session,
) =>
  Order.findOneAndUpdate(
    {
      _id: orderId,
      buyerId,
      orderStatus: 'PENDING_PAYMENT',
      checkoutGroupId: { $exists: false },
    },
    { $set: { checkoutGroupId, shippingAddress, paymentMethod } },
    { returnDocument: 'after', session },
  ).lean();

export const byGroup = (buyerId, checkoutGroupId, session) =>
  Order.find({ buyerId, checkoutGroupId })
    .session(session || null)
    .lean();

export const byGroupPublic = (buyerId, checkoutGroupId) =>
  Order.find({ buyerId, checkoutGroupId }).select(publicProjection).lean();

export const setGroupStatus = (
  buyerId,
  checkoutGroupId,
  orderStatus,
  session,
) =>
  Order.updateMany({ buyerId, checkoutGroupId }, { orderStatus }, { session });

export const markGroupConfirmed = (buyerId, checkoutGroupId, session) =>
  Order.updateMany(
    { buyerId, checkoutGroupId, orderStatus: 'PENDING_PAYMENT' },
    { $set: { orderStatus: 'CONFIRMED' }, $unset: { deliveredAt: '' } },
    { session },
  );

export const markDeliveredFromShipment = (orderId, deliveredAt, session) =>
  Order.findOneAndUpdate(
    { _id: orderId, orderStatus: 'CONFIRMED' },
    { orderStatus: 'DELIVERED', deliveredAt },
    { session, returnDocument: 'after', projection: publicProjection },
  ).lean();

// Undo a wrap: detach the order(s) from a (failed) group and reset them to
// PENDING_PAYMENT so an auction-win order stays re-payable after a capture
// failure. `$unset checkoutGroupId` re-arms the `attachToGroup` guard so a fresh
// checkout can wrap the order again.
export const detachFromGroup = (buyerId, checkoutGroupId, session) =>
  Order.updateMany(
    { buyerId, checkoutGroupId },
    {
      $set: { orderStatus: 'PENDING_PAYMENT' },
      $unset: { checkoutGroupId: '' },
    },
    { session },
  );

export const findDeliveredProductPurchase = ({
  buyerId,
  orderId,
  orderItemId,
  productId,
}) =>
  Order.findOne({
    _id: orderId,
    buyerId,
    orderStatus: 'DELIVERED',
    items: { $elemMatch: { _id: orderItemId, productId } },
  })
    .select({
      _id: 1,
      buyerId: 1,
      sellerId: 1,
      orderStatus: 1,
      items: { $elemMatch: { _id: orderItemId, productId } },
      createdAt: 1,
      updatedAt: 1,
    })
    .lean()
    .exec();

export const findDeliveredOrderItemPurchase = ({
  buyerId,
  orderId,
  orderItemId,
  session,
}) =>
  Order.findOne({
    _id: orderId,
    buyerId,
    orderStatus: 'DELIVERED',
    items: { $elemMatch: { _id: orderItemId } },
  })
    .select({
      _id: 1,
      buyerId: 1,
      sellerId: 1,
      orderStatus: 1,
      items: { $elemMatch: { _id: orderItemId } },
      createdAt: 1,
      updatedAt: 1,
    })
    .session(session || null)
    .lean()
    .exec();

export const findOrderItem = ({ orderId, orderItemId, session }) =>
  Order.findOne({
    _id: orderId,
    items: { $elemMatch: { _id: orderItemId } },
  })
    .select({
      _id: 1,
      buyerId: 1,
      sellerId: 1,
      orderStatus: 1,
      items: { $elemMatch: { _id: orderItemId } },
      createdAt: 1,
      updatedAt: 1,
    })
    .session(session || null)
    .lean()
    .exec();

export const deliveredWithItemsForFeedback = (buyerId) =>
  Order.find({ buyerId, orderStatus: 'DELIVERED' })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .lean()
    .exec();

export const findAutomatedFeedbackEligibleItems = ({ cutoff, limit = 100 }) =>
  Order.aggregate([
    {
      $match: {
        orderStatus: 'DELIVERED',
        $or: [
          { deliveredAt: { $lte: cutoff } },
          { deliveredAt: { $exists: false }, createdAt: { $lte: cutoff } },
          { deliveredAt: null, createdAt: { $lte: cutoff } },
        ],
      },
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'sellerprofiles',
        localField: 'items.sellerId',
        foreignField: '_id',
        as: 'seller',
      },
    },
    { $unwind: '$seller' },
    {
      $match: {
        $expr: { $ne: ['$buyerId', '$seller.userId'] },
      },
    },
    {
      $lookup: {
        from: 'sellerfeedbacks',
        let: { orderId: '$_id', orderItemId: '$items._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$orderId', '$$orderId'] },
                  { $eq: ['$orderItemId', '$$orderItemId'] },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
        ],
        as: 'feedback',
      },
    },
    { $match: { feedback: { $size: 0 } } },
    { $sort: { deliveredAt: 1, createdAt: 1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        orderId: '$_id',
        orderItemId: '$items._id',
        buyerId: 1,
        sellerId: '$items.sellerId',
        sellerUserId: '$seller.userId',
        productId: '$items.productId',
        referenceAt: { $ifNull: ['$deliveredAt', '$createdAt'] },
      },
    },
  ]);

export const findDeliveredSellerOrder = ({ buyerId, orderId, sellerId }) => {
  const filter = {
    _id: orderId,
    buyerId,
    orderStatus: 'DELIVERED',
  };
  if (sellerId) filter.sellerId = sellerId;

  return Order.findOne(filter)
    .select({
      _id: 1,
      buyerId: 1,
      sellerId: 1,
      orderStatus: 1,
      items: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean()
    .exec();
};
