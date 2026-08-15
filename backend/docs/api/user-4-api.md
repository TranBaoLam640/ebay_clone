# User 4 API

All routes use `/api/v1`, require the authenticated Buyer cookie, and unsafe methods require `x-csrf-token` obtained from `GET /api/v1/auth/csrf-token`.

`RETURN_WINDOW_DAYS` is a positive integer with default `30`. `PAYPAL_SIMULATION_ENABLED` is `true|false` with default `true`; when disabled, PayPal provider actions fail without changing checkout persistence.

## Exact route inventory

- `POST /checkout`
- `GET /checkout-groups/:checkoutGroupId`
- `GET /orders`
- `GET /orders/:orderId`
- `POST /payments/paypal/create`
- `POST /payments/paypal/capture`
- `POST /payments/cod/confirm`
- `POST /returns`
- `GET /returns`
- `GET /returns/:returnId`

There is no CheckoutGroup list route, Payment GET route, direct payment-fail route, `/return-requests` mount, or Return PATCH/DELETE route.

## Transactional checkout

`POST /checkout` accepts the Checkout Preview body and requires `Idempotency-Key`. It revalidates owned Address, exact Cart item IDs, Product/Seller/Category eligibility, current price/stock, Coupon dates and limits, and deterministic Seller allocation.

The Buyer/key idempotency record stores canonical request hash, atomic claim token, attempts, PROCESSING/COMPLETED/FAILED lifecycle, exact status/body, timestamps, failure data, and a 24-hour TTL. Same-hash COMPLETED calls replay the exact body; changed payloads and live PROCESSING claims conflict; stale/FAILED claims are atomically reclaimable.

One transaction decrements stock/status; creates CheckoutGroup, Seller Orders, and a `PENDING` Payment; atomically guards and increments the maximum of stale global Coupon `usageCount` and the persisted legacy CouponUsage floor; atomically updates the Buyer counter; creates CouponUsage; removes selected Cart items; writes typed seller notifications; and stores exact idempotency completion. Response CheckoutGroup, Orders, Payment, and Address snapshot use explicit allowlists and expose no `buyerId`, `__v`, Address `_id`/`userId`/default metadata, restoration, or provider-internal fields.

Checkout never calls a payment provider. COD and PayPal both remain `PAYMENT_PENDING`/`PENDING` until the dedicated action route.

## Payments

Every action body is `{ "checkoutGroupId": "<id>" }`.

`POST /payments/paypal/create` first verifies Buyer ownership, PAYPAL method, and PENDING state. It atomically claims a tokenized lease, invokes the provider outside a retryable MongoDB transaction, validates exact provider order ID/status/amount/currency, then conditionally persists `CREATED` only for that token with a typed transactional notification. A stale worker cannot complete or release a newer generation. Rejection or invalid output token-conditionally releases its own lease and leaves the Payment retryable without a provider ID.

`POST /payments/paypal/capture` verifies ownership/method/state and atomically claims a tokenized capture lease before invoking the provider with the persisted provider order ID. Only one concurrent caller invokes the provider. Exact matching CAPTURED output conditionally confirms the same lease token and transactionally confirms group, Orders, and notification. Exact matching FAILED output conditionally consumes the same token, claims restoration, fails state, restores stock/status, reverses CouponUsage/global/Buyer counts, writes one notification, and completes restoration. Invalid/mismatched output token-conditionally releases the lease; stale workers cannot mutate newer claims.

`POST /payments/cod/confirm` verifies ownership, COD method, and PENDING state, then transactionally confirms Payment/group/Orders and one typed notification. All actions are idempotent in terminal success/failure states and method mismatches conflict.

## CheckoutGroup and Orders

`GET /checkout-groups/:checkoutGroupId` returns the owned safe group plus safe Orders and Payment.

`GET /orders` supports independent `status`, `sellerId`, `from`, and `to` filters; pagination; and stable `newest`/`oldest` sorting only. `GET /orders/:orderId` is owner-scoped. All API records and embedded items pass through explicit allowlist mappers. Shipping Address snapshots contain only `fullName`, `phone`, `addressLine`, `ward`, `district`, `province`, `country`, and optional `postalCode`.

## Returns

Create body uses `orderId`, `orderItemId`, positive `quantity`, exact `reason`, and optional `details`. Reasons are `DAMAGED`, `DEFECTIVE`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, `MISSING_PARTS`, `CHANGED_MIND`, `OTHER`. Persisted statuses are `REQUESTED`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`.

Creation requires an owned DELIVERED Order, exact item, quantity no greater than purchased, and a present `deliveredAt` that is neither future nor older than `RETURN_WINDOW_DAYS`. A unique Order index permits exactly one ReturnRequest per Order. Create and typed Buyer/seller notifications share one transaction. Buyer scope exposes create, list, and detail only.
