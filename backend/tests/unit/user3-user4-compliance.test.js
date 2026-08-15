import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Coupon } from '../../src/modules/coupons/coupon.model.js';
import { CouponUsage } from '../../src/modules/coupons/coupon-usage.model.js';
import { CouponUserUsageCounter } from '../../src/modules/coupons/coupon-user-usage-counter.model.js';
import { IdempotencyRecord } from '../../src/modules/idempotency/idempotency-record.model.js';
import { Payment } from '../../src/modules/payments/payment.model.js';
import { ReturnRequest } from '../../src/modules/returns/return-request.model.js';
import {
  captureOrder,
  createOrder,
  validCaptureOutcome,
  validCreateOutcome,
  validFailureOutcome,
} from '../../src/modules/payments/providers/paypal-simulation.provider.js';

const id = () => new mongoose.Types.ObjectId();
const coupon = (overrides = {}) =>
  new Coupon({
    code: ' repair10 ',
    description: 'Repair coupon',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    startsAt: new Date('2030-01-01T00:00:00.000Z'),
    expiresAt: new Date('2030-02-01T00:00:00.000Z'),
    ...overrides,
  });

const validationError = async (document) => {
  await expect(document.validate()).rejects.toMatchObject({
    name: 'ValidationError',
  });
};

describe('User 3/User 4 direct compliance contracts', () => {
  it('enforces Coupon normalization and cross-field invariants', async () => {
    const valid = coupon();
    await valid.validate();
    expect(valid.code).toBe('REPAIR10');
    await validationError(coupon({ discountValue: 101 }));
    await validationError(
      coupon({
        discountType: 'FIXED_AMOUNT',
        discountValue: 100,
        maxDiscount: 10,
      }),
    );
    await validationError(
      coupon({
        expiresAt: new Date('2029-12-31T23:59:59.000Z'),
      }),
    );
    await validationError(coupon({ usageLimit: 1, usageCount: 2 }));
    await validationError(coupon({ usageLimit: 0 }));
    await validationError(coupon({ usageLimit: 1.5 }));
    await validationError(coupon({ perUserLimit: 0 }));
    await validationError(coupon({ perUserLimit: 1.5 }));
  });

  it('requires complete coupon usage and nonnegative integer buyer counters', async () => {
    const usage = new CouponUsage({
      couponId: id(),
      buyerId: id(),
      checkoutGroupId: id(),
      orderIds: [],
    });
    await validationError(usage);
    await validationError(
      new CouponUserUsageCounter({
        couponId: id(),
        buyerId: id(),
        usageCount: 1.5,
      }),
    );
  });

  it('defines complete idempotency fields and a zero-second TTL index', () => {
    const paths = IdempotencyRecord.schema.paths;
    expect(paths).toEqual(
      expect.objectContaining({
        requestHash: expect.anything(),
        claimToken: expect.anything(),
        attempts: expect.anything(),
        startedAt: expect.anything(),
        lastAttemptAt: expect.anything(),
        completedAt: expect.anything(),
        failedAt: expect.anything(),
        responseStatus: expect.anything(),
        responseBody: expect.anything(),
        errorCode: expect.anything(),
        expiresAt: expect.anything(),
      }),
    );
    expect(IdempotencyRecord.schema.indexes()).toContainEqual([
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ]);
  });

  it('enforces payment provider identity and durable claim/restoration fields', async () => {
    expect(Payment.schema.paths).toEqual(
      expect.objectContaining({
        providerCreateClaimToken: expect.anything(),
        providerCreateClaimedAt: expect.anything(),
        providerCaptureClaimToken: expect.anything(),
        providerCaptureClaimedAt: expect.anything(),
      }),
    );
    await validationError(
      new Payment({
        buyerId: id(),
        checkoutGroupId: id(),
        method: 'PAYPAL',
        status: 'CREATED',
        amount: 10,
        currency: 'VND',
        restorationStatus: 'PENDING',
      }),
    );
    const paypal = new Payment({
      buyerId: id(),
      checkoutGroupId: id(),
      method: 'PAYPAL',
      status: 'CREATED',
      amount: 10,
      currency: 'VND',
      providerOrderId: 'SIM-EXACT',
      restorationStatus: 'PENDING',
    });
    await paypal.validate();
    expect(paypal.restorationStatus).toBe('PENDING');
  });

  it('invokes the PayPal provider with exact create, capture, and failure outcomes', async () => {
    await expect(
      createOrder({ checkoutGroupId: 'group', amount: 125, currency: 'VND' }),
    ).resolves.toEqual({
      providerOrderId: 'SIM-group',
      status: 'CREATED',
      amount: 125,
      currency: 'VND',
    });
    await expect(captureOrder('SIM-group')).resolves.toEqual({
      providerOrderId: 'SIM-group',
      status: 'CAPTURED',
    });
    expect(
      validCreateOutcome(
        {
          providerOrderId: 'SIM-group',
          status: 'CREATED',
          amount: 124,
          currency: 'VND',
        },
        { amount: 125, currency: 'VND' },
      ),
    ).toBe(false);
    expect(
      validCaptureOutcome(
        { providerOrderId: 'SIM-other', status: 'CAPTURED' },
        'SIM-group',
      ),
    ).toBe(false);
    expect(
      validFailureOutcome(
        {
          providerOrderId: 'SIM-group',
          status: 'FAILED',
          reason: 'OTHER',
        },
        'SIM-group',
        'DECLINED',
      ),
    ).toBe(false);
  });

  it('enforces exact return reasons/statuses and one unique request per order', async () => {
    const reason = ReturnRequest.schema.path('reason').options.enum;
    const status = ReturnRequest.schema.path('status').options.enum;
    expect(reason).toEqual([
      'DAMAGED',
      'DEFECTIVE',
      'WRONG_ITEM',
      'NOT_AS_DESCRIBED',
      'MISSING_PARTS',
      'CHANGED_MIND',
      'OTHER',
    ]);
    expect(status).toEqual([
      'REQUESTED',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
      'CANCELLED',
    ]);
    expect(ReturnRequest.schema.indexes()).toContainEqual([
      { orderId: 1 },
      { unique: true },
    ]);
    await validationError(
      new ReturnRequest({
        buyerId: id(),
        orderId: id(),
        sellerId: id(),
        orderItemId: id(),
        productId: id(),
        quantity: 1,
        reason: 'Damaged',
      }),
    );
  });
});
