import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { calculateDiscount } from '../../common/services/pricing.service.js';
import * as cartRepository from '../carts/cart.repository.js';
import { hydrate } from '../carts/cart.service.js';
import * as repository from './coupon.repository.js';
import * as usageRepository from './coupon-usage.repository.js';
import * as counterRepository from './coupon-user-usage-counter.repository.js';

const fail = (code, message) => new AppError(409, code, message);
const isPurchasable = (item) =>
  item.product?.status === 'ACTIVE' &&
  item.product.stock > 0 &&
  Boolean(item.product.seller);

const buyerUsageCount = async (couponId, buyerId, session) => {
  const [counter, legacyCount] = await Promise.all([
    counterRepository.find(couponId, buyerId, session),
    usageRepository.countByBuyer(couponId, buyerId, session),
  ]);
  return Math.max(counter?.usageCount || 0, legacyCount);
};

export const evaluate = async (
  buyerId,
  code,
  subtotal,
  now = new Date(),
  session,
) => {
  const coupon = await repository.findByCode(code, session);
  if (!coupon) throw fail(ERROR_CODES.COUPON_NOT_FOUND, 'Coupon not found');
  if (coupon.status !== 'ACTIVE')
    throw fail(ERROR_CODES.COUPON_INACTIVE, 'Coupon is inactive');
  if (now < coupon.startsAt)
    throw fail(ERROR_CODES.COUPON_NOT_STARTED, 'Coupon has not started');
  if (now >= coupon.expiresAt)
    throw fail(ERROR_CODES.COUPON_EXPIRED, 'Coupon has expired');
  if (subtotal < coupon.minOrderValue)
    throw fail(
      ERROR_CODES.COUPON_MINIMUM_NOT_MET,
      'Minimum order value not met',
    );
  if (coupon.usageLimit !== null) {
    const actualUsageCount = await usageRepository.countByCoupon(
      coupon._id,
      session,
    );
    if (Math.max(coupon.usageCount || 0, actualUsageCount) >= coupon.usageLimit)
      throw fail(
        ERROR_CODES.COUPON_USAGE_LIMIT_REACHED,
        'Coupon usage limit reached',
      );
  }
  if (
    coupon.perUserLimit !== null &&
    (await buyerUsageCount(coupon._id, buyerId, session)) >= coupon.perUserLimit
  )
    throw fail(
      ERROR_CODES.COUPON_USER_LIMIT_REACHED,
      'Buyer coupon limit reached',
    );
  return {
    couponId: String(coupon._id),
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    perUserLimit: coupon.perUserLimit,
    subtotal,
    discount: calculateDiscount(coupon, subtotal),
  };
};

export const consume = async (
  coupon,
  buyerId,
  checkoutGroupId,
  orderIds,
  session,
) => {
  const legacyGlobalUsageCount = await usageRepository.countByCoupon(
    coupon.couponId,
    session,
  );
  if (
    !(await repository.consumeAvailableFromFloor(
      coupon.couponId,
      legacyGlobalUsageCount,
      session,
    ))
  )
    throw fail(
      ERROR_CODES.COUPON_USAGE_LIMIT_REACHED,
      'Coupon usage limit reached',
    );
  const legacyUsageCount = await usageRepository.countByBuyer(
    coupon.couponId,
    buyerId,
    session,
  );
  if (
    !(await counterRepository.incrementWithinLimit(
      coupon.couponId,
      buyerId,
      coupon.perUserLimit,
      legacyUsageCount,
      session,
    ))
  )
    throw fail(
      ERROR_CODES.COUPON_USER_LIMIT_REACHED,
      'Buyer coupon limit reached',
    );
  return usageRepository.create(
    {
      couponId: coupon.couponId,
      buyerId,
      checkoutGroupId,
      orderIds,
    },
    session,
  );
};

export const reverse = async (couponId, checkoutGroupId, session) => {
  const usage = await usageRepository.removeByCheckoutGroup(
    couponId,
    checkoutGroupId,
    session,
  );
  if (!usage) return null;
  await repository.decrementUsage(couponId, session);
  await counterRepository.decrement(couponId, usage.buyerId, session);
  return usage;
};

export const validate = async (buyerId, { code, selectedCartItemIds }) => {
  const cart = await hydrate(await cartRepository.findByUser(buyerId));
  const selected = new Set(selectedCartItemIds);
  if (selected.size !== selectedCartItemIds.length)
    throw fail(ERROR_CODES.CART_SELECTION_INVALID, 'Cart selection is invalid');
  const items = cart.items.filter((item) => selected.has(item.id));
  if (
    items.length !== selected.size ||
    items.some((item) => !isPurchasable(item))
  )
    throw fail(ERROR_CODES.CART_SELECTION_INVALID, 'Cart selection is invalid');
  const subtotal = items.reduce((sum, item) => sum + item.itemSubtotal, 0);
  return evaluate(buyerId, code, subtotal);
};
