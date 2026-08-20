import { Router } from 'express';
import { authRoute } from '../modules/auth/route.js';
import { userRoute } from '../modules/users/route.js';
import { addressRoute } from '../modules/addresses/route.js';
import { notificationRoute } from '../modules/notifications/route.js';
import { categoryRoute } from '../modules/categories/category.route.js';
import { sellerRoute } from '../modules/sellers/seller.route.js';
import { productRoute } from '../modules/products/product.route.js';
import { catalogProductRoute } from '../modules/catalog-products/catalog-product.route.js';
import {
  auctionMeRoute,
  nestedAuctionRoute,
} from '../modules/auctions/auction.route.js';
import {
  conversationOfferRoute,
  nestedOfferRoute,
  offerActionRoute,
  offerMeRoute,
} from '../modules/offers/offer.route.js';
import {
  nestedProductReviewRoute,
  orderProductReviewRoute,
  productReviewRoute,
} from '../modules/product-reviews/product-review.route.js';
import {
  orderSellerFeedbackRoute,
  sellerFeedbackPublicRoute,
  sellerFeedbackRoute,
} from '../modules/seller-feedbacks/seller-feedback.route.js';
import { cartRoute } from '../modules/carts/cart.route.js';
import { couponRoute } from '../modules/coupons/coupon.route.js';
import { checkoutRoute } from '../modules/checkout/checkout.route.js';
import { checkoutGroupRoute } from '../modules/checkout-groups/checkout-group.route.js';
import { orderRoute } from '../modules/orders/order.route.js';
import { paymentRoute } from '../modules/payments/payment.route.js';
import { returnRoute } from '../modules/returns/return-request.route.js';
import { shipmentRoute } from '../modules/shipments/shipment.route.js';
import { uploadRoute } from '../modules/uploads/upload.route.js';
import { conversationRoute } from '../modules/conversations/conversation.route.js';

export const routes = Router();
routes.use('/auth', authRoute);
routes.use('/users', userRoute);
routes.use('/addresses', addressRoute);
routes.use('/notifications', notificationRoute);
routes.use('/categories', categoryRoute);
routes.use('/catalog-products', catalogProductRoute);
routes.use(
  '/products',
  productRoute,
  nestedProductReviewRoute,
  nestedAuctionRoute,
  nestedOfferRoute,
);
routes.use('/me', auctionMeRoute, offerMeRoute);
routes.use('/offers', offerActionRoute);
routes.use('/sellers', sellerRoute, sellerFeedbackPublicRoute);
routes.use('/product-reviews', productReviewRoute);
routes.use(
  '/orders',
  orderProductReviewRoute,
  orderSellerFeedbackRoute,
  orderRoute,
);
routes.use('/seller-feedbacks', sellerFeedbackRoute);
routes.use('/cart', cartRoute);
routes.use('/coupons', couponRoute);
routes.use('/checkout', checkoutRoute);
routes.use('/checkout-groups', checkoutGroupRoute);
routes.use('/payments', paymentRoute);
routes.use('/returns', returnRoute);
routes.use('/shipments', shipmentRoute);
routes.use('/uploads', uploadRoute);
routes.use('/conversations', conversationRoute, conversationOfferRoute);
