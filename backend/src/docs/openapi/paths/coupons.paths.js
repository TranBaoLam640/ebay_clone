import {
  body,
  operation,
  ref,
  response,
  security,
} from '../components/index.js';

export const couponPaths = {
  '/coupons/validate': {
    post: operation({
      tag: 'Coupons',
      operationId: 'validateCoupon',
      summary: 'Validate a coupon for selected cart items',
      description:
        'Evaluates current selected Cart prices, active dates, minimum subtotal, global usage, and Buyer usage without mutating coupon state.',
      requestBody: body({
        $ref: '#/components/schemas/CouponValidationRequest',
      }),
      success: response('Coupon evaluation', ref('CouponEvaluation')),
      errors: [400, 401, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
};
