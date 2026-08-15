import { CheckoutGroup } from './checkout-group.model.js';

const publicProjection = {
  _id: 1,
  orderIds: 1,
  paymentId: 1,
  couponId: 1,
  paymentMethod: 1,
  status: 1,
  subtotal: 1,
  discount: 1,
  shippingFee: 1,
  total: 1,
  currency: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const create = async (data, session) =>
  (await CheckoutGroup.create([data], { session }))[0];
export const setOrders = (id, orderIds, paymentId, session) =>
  CheckoutGroup.findByIdAndUpdate(
    id,
    { orderIds, paymentId },
    { session, returnDocument: 'after' },
  );
export const findOwned = (buyerId, id, session) =>
  CheckoutGroup.findOne({ _id: id, buyerId })
    .session(session || null)
    .lean();
export const findOwnedPublic = (buyerId, id) =>
  CheckoutGroup.findOne({ _id: id, buyerId }).select(publicProjection).lean();
export const confirmPayment = (buyerId, id, session) =>
  CheckoutGroup.findOneAndUpdate(
    { _id: id, buyerId, status: 'PAYMENT_PENDING' },
    { status: 'CONFIRMED' },
    { session, returnDocument: 'after' },
  ).lean();
export const markPaymentFailed = (buyerId, id, session) =>
  CheckoutGroup.findOneAndUpdate(
    { _id: id, buyerId, status: 'PAYMENT_PENDING' },
    { status: 'PAYMENT_FAILED' },
    { session, returnDocument: 'after' },
  ).lean();
export const markRestored = (buyerId, id, couponRestored, session) =>
  CheckoutGroup.findOneAndUpdate(
    { _id: id, buyerId, status: 'PAYMENT_FAILED', stockRestoredAt: null },
    {
      stockRestoredAt: new Date(),
      ...(couponRestored && { couponRestoredAt: new Date() }),
    },
    { session, returnDocument: 'after' },
  ).lean();

export const publicFields = publicProjection;
