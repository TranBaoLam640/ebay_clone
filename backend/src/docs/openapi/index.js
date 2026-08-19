import { env } from '../../config/env.js';
import { components } from './components/index.js';
import { info, tags } from './info.js';
import { authPaths } from './paths/auth.paths.js';
import { userPaths } from './paths/users.paths.js';
import { addressPaths } from './paths/addresses.paths.js';
import { notificationPaths } from './paths/notifications.paths.js';
import { categoryPaths } from './paths/categories.paths.js';
import { catalogProductPaths } from './paths/catalog-products.paths.js';
import { productPaths } from './paths/products.paths.js';
import { sellerPaths } from './paths/sellers.paths.js';
import { productReviewPaths } from './paths/product-reviews.paths.js';
import { sellerFeedbackPaths } from './paths/seller-feedbacks.paths.js';
import { systemPaths } from './paths/foundation.paths.js';
import { cartPaths } from './paths/carts.paths.js';
import { couponPaths } from './paths/coupons.paths.js';
import { checkoutPaths } from './paths/checkout.paths.js';
import { checkoutGroupPaths } from './paths/checkout-groups.paths.js';
import { orderPaths } from './paths/orders.paths.js';
import { paymentPaths } from './paths/payments.paths.js';
import { returnPaths } from './paths/returns.paths.js';
import { conversationPaths } from './paths/conversations.paths.js';
import { offerPaths } from './paths/offers.paths.js';

const prefix = `/${env.API_PREFIX.split('/').filter(Boolean).join('/')}`;
const pathGroups = [
  authPaths,
  userPaths,
  addressPaths,
  notificationPaths,
  categoryPaths,
  catalogProductPaths,
  productPaths,
  sellerPaths,
  productReviewPaths,
  sellerFeedbackPaths,
  cartPaths,
  couponPaths,
  checkoutPaths,
  checkoutGroupPaths,
  orderPaths,
  paymentPaths,
  returnPaths,
  conversationPaths,
  offerPaths,
];
const paths = {
  ...Object.fromEntries(
    pathGroups.flatMap((group) =>
      Object.entries(group).map(([path, item]) => [`${prefix}${path}`, item]),
    ),
  ),
  ...systemPaths,
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    ...info,
    description: info.description.replaceAll('{API_PREFIX}', prefix),
  },
  servers: [{ url: '/' }],
  tags,
  paths,
  components,
};

export default openApiDocument;
