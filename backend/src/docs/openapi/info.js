import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

export const info = {
  title: 'SBay Buyer API',
  version,
  description: `Buyer-facing backend APIs for the academic eBay Clone project.

## Authentication workflow

1. Call \`GET {API_PREFIX}/auth/csrf-token\` before any unsafe request and retain the response cookies.
2. Read the anti-CSRF value from \`data.csrfToken\` and send it as \`X-CSRF-Token\` on every POST, PATCH, PUT, or DELETE request.
3. Register with \`POST {API_PREFIX}/auth/register\`. A six-digit verification OTP is delivered by email and is never returned by the API.
4. Verify the account with \`POST {API_PREFIX}/auth/verify-email\` using the email and OTP; use \`POST {API_PREFIX}/auth/resend-verification\` if a replacement code is needed. Only the newest OTP is valid.
5. Log in with \`POST {API_PREFIX}/auth/login\`. The server sets \`accessToken\` and \`refreshToken\` as HttpOnly cookies.
6. Include credentials on subsequent requests so the browser sends cookies. HttpOnly authentication cookies cannot be read, copied, or entered through JavaScript or Swagger authorization controls.
7. Use protected GET operations with the access cookie. Protected writes require both the access cookie and the current \`X-CSRF-Token\` value.
8. When access expires, call \`POST {API_PREFIX}/auth/refresh\` with credentials and CSRF protection. Refresh rotation replaces both HttpOnly authentication cookies.
9. Call \`POST {API_PREFIX}/auth/logout\` with the CSRF token to revoke a refresh session when present and clear authentication cookies.

## Covered endpoint groups

The document includes health/readiness, authentication, current user profile, addresses, notifications, categories, buyer product catalog, public seller detail, product reviews, seller feedback, Cart, Coupon validation, Checkout Preview and final Checkout, CheckoutGroup detail, Order reads, PayPal/COD payment actions, Buyer Returns, buyer/seller Messaging, Offers, attachments, and accepted-offer checkout payloads.

## Realtime messaging events

Socket.IO runs on the default \`/socket.io/\` path with the same access cookie authentication as protected REST APIs. Clients join authorized rooms with \`conversation:join\` using a conversation id. Event payload schemas are documented under components as \`ConversationMessage\`, \`OfferUpdatedEvent\`, and \`ConversationUpdatedEvent\`. Accepted-offer checkout emits \`offer:updated\` with a PURCHASED offer and \`conversation:updated\` with POST_PURCHASE and orderId only after the checkout transaction commits.`,
};

export const tags = [
  'Foundation',
  'Authentication',
  'Users',
  'Addresses',
  'Notifications',
  'Categories',
  'Products',
  'Product Reviews',
  'Sellers',
  'Seller Feedback',
  'Cart',
  'Coupons',
  'Checkout',
  'Checkout Groups',
  'Orders',
  'Payments',
  'Returns',
  'Messaging',
  'Offers',
].map((name) => ({ name }));
