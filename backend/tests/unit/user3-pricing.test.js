import { describe, expect, it } from 'vitest';
import {
  allocateDiscount,
  calculateDiscount,
} from '../../src/common/services/pricing.service.js';

describe('User 3 pricing', () => {
  it('floors percentage discounts and applies maximum caps', () => {
    expect(
      calculateDiscount(
        { discountType: 'PERCENTAGE', discountValue: 15, maxDiscount: null },
        101,
      ),
    ).toBe(15);
    expect(
      calculateDiscount(
        { discountType: 'PERCENTAGE', discountValue: 50, maxDiscount: 20 },
        101,
      ),
    ).toBe(20);
  });

  it('caps fixed discounts at subtotal', () => {
    expect(
      calculateDiscount(
        { discountType: 'FIXED_AMOUNT', discountValue: 200, maxDiscount: null },
        100,
      ),
    ).toBe(100);
  });

  it('allocates floors and the remainder to the final sorted seller', () => {
    expect(
      allocateDiscount(
        [
          { sellerId: 'a', subtotal: 100 },
          { sellerId: 'b', subtotal: 200 },
        ],
        100,
      ),
    ).toEqual([
      { sellerId: 'a', subtotal: 100, discount: 33, total: 67 },
      { sellerId: 'b', subtotal: 200, discount: 67, total: 133 },
    ]);
  });
});
