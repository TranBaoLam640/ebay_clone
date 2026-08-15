# Swagger UI Guide

## Start and open

From `backend/`:

```sh
npm run dev
```

- UI: <http://localhost:4000/api-docs/>
- OpenAPI JSON: <http://localhost:4000/api-docs/openapi.json>

The OpenAPI 3.0.3 document covers 43 paths and 52 operations, including health/readiness and all current User 3/User 4 Cart, Coupon, Checkout, CheckoutGroup, Order read, Payment action, and Return routes.

## Covered routes

The Swagger document currently covers these runtime routes:

| Area                 | Routes                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation           | `GET /health`, `GET /ready`                                                                                                                                                                                                                                                                                                                                                  |
| Auth                 | `GET /api/v1/auth/csrf-token`, `POST /api/v1/auth/register`, `POST /api/v1/auth/verify-email`, `POST /api/v1/auth/resend-verification`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`                                                                                                                                                   |
| Users                | `GET /api/v1/users/me`, `PATCH /api/v1/users/me`, `PATCH /api/v1/users/me/password`                                                                                                                                                                                                                                                                                          |
| Addresses            | `GET /api/v1/addresses`, `POST /api/v1/addresses`, `PATCH /api/v1/addresses/{addressId}`, `DELETE /api/v1/addresses/{addressId}`, `PATCH /api/v1/addresses/{addressId}/default`                                                                                                                                                                                              |
| Notifications        | `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/read-all`, `PATCH /api/v1/notifications/{notificationId}/read`                                                                                                                                                                                                           |
| Catalog              | `GET /api/v1/categories`, `GET /api/v1/categories/{categoryId}`, `GET /api/v1/products`, `GET /api/v1/products/{productId}`, `GET /api/v1/sellers/{sellerId}`                                                                                                                                                                                                                |
| Reviews and feedback | `GET /api/v1/products/{productId}/reviews`, `POST /api/v1/products/{productId}/reviews`, `PATCH /api/v1/product-reviews/{reviewId}`, `DELETE /api/v1/product-reviews/{reviewId}`, `GET /api/v1/sellers/{sellerId}/feedbacks`, `POST /api/v1/orders/{orderId}/seller-feedback`, `PATCH /api/v1/seller-feedbacks/{feedbackId}`, `DELETE /api/v1/seller-feedbacks/{feedbackId}` |
| Cart and coupons     | `GET /api/v1/cart`, `DELETE /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH /api/v1/cart/items/{productId}`, `DELETE /api/v1/cart/items/{productId}`, `POST /api/v1/cart/sync`, `POST /api/v1/coupons/validate`                                                                                                                                                             |
| Checkout and orders  | `POST /api/v1/checkout/preview`, `POST /api/v1/checkout`, `GET /api/v1/checkout-groups/{checkoutGroupId}`, `GET /api/v1/orders`, `GET /api/v1/orders/{orderId}`                                                                                                                                                                                                              |
| Payments             | `POST /api/v1/payments/paypal/create`, `POST /api/v1/payments/paypal/capture`, `POST /api/v1/payments/cod/confirm`                                                                                                                                                                                                                                                           |
| Returns              | `POST /api/v1/returns`, `GET /api/v1/returns`, `GET /api/v1/returns/{returnId}`                                                                                                                                                                                                                                                                                              |

## Public requests

Public `GET` operations can be executed directly. Unsafe public auth operations still require CSRF: call `GET /api/v1/auth/csrf-token`, copy `data.csrfToken`, retain the browser-set cookie, and send the value as `X-CSRF-Token`.

## Protected requests

1. Obtain a CSRF token and associated cookie.
2. Register if needed, then verify the email address; verification remains required before login.
3. Obtain a fresh CSRF token and log in with `X-CSRF-Token`.
4. Let the browser retain and automatically send the `accessToken` and `refreshToken` HttpOnly cookies.
5. Call protected `GET` operations directly. Before each protected `POST`, `PATCH`, or `DELETE`, fetch a fresh CSRF token and send it in `X-CSRF-Token`.
6. Refresh or log out with the refresh/access cookie required by the operation and a fresh CSRF token.

HttpOnly cookie values are intentionally invisible to Swagger UI and browser JavaScript. Their absence from the UI does not mean the browser failed to store them; inspect response status and browser cookie storage without copying credentials into documentation.

Errors use the API's standardized JSON error body. A `401` usually means the required auth cookie is absent or expired; a `403` commonly indicates CSRF failure, account state, ownership, or eligibility rules. Read the returned code/message rather than adding tokens to the OpenAPI document.

## Configuration and validation

`SWAGGER_ENABLED=false` disables both UI and JSON routes. `SWAGGER_PATH=/api-docs` configures the base path without a trailing slash. Documentation defaults to disabled in production; do not expose it there without explicit review and appropriate access restrictions.

Validate the document without starting MongoDB:

```sh
npm run docs:check
```
