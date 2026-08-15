# Architecture

The backend is a modular monolith:

```text
Route → Middleware → Controller → Service → Repository → Mongoose Model → MongoDB
```

Repositories are the normal production model-import boundary. Services own authorization/business rules and transaction boundaries. `src/scripts/seed.js` is the explicit direct-model exception.

Durable business, auth/session/revocation, idempotency, Coupon usage/counters, payment restoration, Return, and notification state lives in MongoDB. Core checkout/payment/Return flows require a replica set or sharded cluster and do not require sticky sessions for business correctness.

Historical User1 `express-rate-limit` middleware still uses its default process-local memory counters. Therefore rate-limit counters are per process unless future infrastructure adds a shared store; this repair does not alter User1 limiting or add Redis. “Stateless” claims in current docs refer to durable application/business/auth state, not those best-effort infrastructure counters.

## User3/User4 boundaries

- Cart sync atomically merges raw references and emits sorted, response-only stale-item warnings.
- Checkout atomically changes stock/status, Coupon global/Buyer counters, CheckoutGroup/Orders/PENDING Payment/CouponUsage, selected Cart items, seller notifications, and exact idempotency completion.
- PayPal provider create is invoked after ownership outside checkout and outside retryable transactions; validated persistence/notification then shares a transaction.
- PayPal capture and COD confirmation validate ownership/method/state. Capture failure uses a durable exactly-once restoration marker.
- Return create and typed Buyer/seller notifications share one transaction; Buyer Return scope is create/list/detail only.
- Review/Product-rating and Feedback/Seller-rating transaction boundaries remain unchanged.

## Read boundaries

Checkout response, CheckoutGroup detail, Payment, Order, and Return APIs use explicit safe allowlists. Public `sellerId` values are SellerProfile IDs. Delivered Order fields remain backward compatible with Product Review and Seller Feedback eligibility.
