# Project Context

## Project Overview

- Project: **eBay Clone – Buyer**.
- Backend: Node.js 20+, Express 5, MongoDB, and Mongoose. The planned frontend uses React.
- Architecture: modular monolith in one ESM npm package.
- Default API prefix: `/api/v1` (configurable with `API_PREFIX`). `/health` and `/ready` are outside the prefix.
- Durable business/auth state is MongoDB-backed and does not require sticky sessions. Historical User1 rate-limit counters remain process-local infrastructure state.

## Repository Structure

The repository root contains only `backend/` and `frontend/` (plus hidden `.git/`). The standard backend working directory is `backend/`; run backend commands after `cd backend`.

- `backend/`: complete Node.js/Express backend project.
- `src/`: application source; `src/server.js` is the process entrypoint and `src/modules/` contains business modules and Mongoose models.
- `tests/`: Vitest setup, integration suites, and configuration unit tests.
- `docs/`: API documentation, architecture notes, and historical/current audits.
- `infrastructure/`: future User 6 deployment placeholders; no infrastructure is implemented.
- `PROJECT_CONTEXT.md`: backend state and integration contracts for developers and AI tools.
- `README.md`: complete backend/project setup, behavior, API, and commands.
- `frontend/`: repository-root React placeholder for User 5; it is not initialized.

## Completed Scope

### Người 1

Implemented with existing source/integration regression coverage: backend foundation, authentication, email verification, refresh-token rotation/revocation, user profile, addresses, security middleware, simple notifications, structured logging/redaction, standardized error handling, and health/readiness. This describes tested project scope, not a comprehensive security audit.

### Người 2

Implemented: active Category reads; active SellerProfile reads; buyer-visible Product search/detail; typed dynamic attributes; MongoDB filtering/sorting/pagination; Product Review CRUD with purchase eligibility; Seller Feedback CRUD with order eligibility; the delivered Order eligibility contract; deterministic seed data; tests; and API documentation. Category, Seller, and Product write APIs are not implemented. User 4 now creates Orders internally during checkout and exposes Buyer-owned Order reads, but no public general Order creation or lifecycle mutation API.

### Người 3

Implemented: MongoDB Cart CRUD/sync with raw reference persistence, nested safe Product DTO hydration, stale server-only warnings, and transactional merge; invariant-rich Coupon schema, dedicated CouponUsage repository, read-only validation, shared integer discount/allocation pricing; and stateless Checkout Preview with owned Address and deterministic SellerProfile grouping.

### Người 4

Implemented: transactional final checkout with exact-response atomic claim/replay/FAILED/stale reclaim; atomic stock/status and mixed legacy/current global/Buyer Coupon accounting; multi-seller CheckoutGroups/Orders, selected Cart removal, and typed deduplicated notifications; PENDING checkout Payments followed by owned exact PayPal create/capture or COD confirm actions; durable exactly-once reversal; explicit safe CheckoutGroup/Payment/Order/Return allowlists with Order filters/sorts; and one-per-Order Return create/list/detail with strict delivery eligibility.

## Architecture Rules

```text
Route
→ Middleware
→ Controller
→ Service
→ Repository
→ Mongoose Model
→ MongoDB
```

- Controllers adapt HTTP requests/responses and do not hold substantial business logic.
- Services implement business rules and transaction boundaries.
- Repositories own database queries and normal model access.
- Never connect MongoDB from a controller or create a second application connection.
- Do not duplicate Mongoose models.
- Cross-module access goes through an exported service or repository. `src/scripts/seed.js` is the explicit direct-model exception.

## Statelessness Rules

All durable business data belongs in MongoDB. Never implement runtime storage such as:

```javascript
let products = [];
let reviews = [];
const feedbacks = new Map();
const categories = {};
```

MongoDB stores users, refresh tokens, email verification OTP records, addresses, notifications, categories, seller profiles, products, product reviews, seller feedbacks, and orders.

- Do not use `express-session` MemoryStore.
- Do not store uploads on a Pod's local disk.
- Do not cache business records in globals.
- Do not write application logs to local files.
- Do not depend on sticky sessions for business/auth correctness.
- User1 `express-rate-limit` currently uses default per-process memory counters; do not describe those quotas as shared across Pods. This repair does not change that historical middleware or add Redis.

## Database Collections

Mongoose uses these actual/default collection names:

- `users`: Buyer identities, credentials, profile, role, and status.
- `refreshtokens`: hashed refresh-token records and revocation state.
- `emailverificationtokens`: HMAC-protected email OTP hashes, expiration, attempts, resend timing, invalidation, and one-time consumption state.
- `addresses`: user-owned delivery addresses and default selection.
- `notifications`: persisted user notifications and read state.
- `categories`: hierarchy, slug, description, and ACTIVE/INACTIVE visibility.
- `sellerprofiles`: public seller identity, status, and persisted feedback aggregates; public `sellerId` means this collection's `_id`, not a User ID.
- `products`: seller listings, category, price/stock, images, typed dynamic attributes, visibility, and persisted review aggregates.
- `productreviews`: Buyer review tied uniquely to an eligible delivered Order Item.
- `sellerfeedbacks`: Buyer-to-Seller feedback tied uniquely to an eligible delivered Order.
- `orders`: Buyer/SellerProfile orders with lifecycle, checkout, pricing/address snapshots, and preserved delivered eligibility fields.
- `checkoutgroups`: Buyer checkout aggregate linking multi-seller Orders and one Payment.
- `idempotencyrecords`: durable Buyer/key claims, request hashes, exact responses/failures, and TTL.
- `couponusages`: immutable Coupon/Buyer/CheckoutGroup/Order usage records.
- `couponuserusagecounters`: atomic unique Coupon/Buyer usage counters.
- `payments`: COD/PayPal provider state and durable exactly-once restoration markers.
- `returnrequests`: Buyer-owned, one-per-Order return requests with strict lifecycle state.

## Important Business Rules

### Product

- A Product is one sellable listing owned by a SellerProfile.
- Buyer APIs expose only `ACTIVE` and `OUT_OF_STOCK` products whose Category and SellerProfile are active.
- Attributes are dynamic typed values; do not add universal fixed fields such as RAM, CPU, or shoe size.

### Product Review

- The authenticated Buyer must own the Order; it must be `DELIVERED`, and the specified Order Item must match the Product.
- One Order Item can be reviewed once (`orderItemId` is unique).
- Create/update/delete and recalculation of Product `averageRating`/`reviewCount` occur in one MongoDB transaction using persisted reviews.

### Seller Feedback

- The authenticated Buyer must own a `DELIVERED` Order; SellerProfile is derived from the Order and must match it.
- One Order can receive one Seller Feedback (`orderId` is unique).
- Create/update/delete and recalculation of SellerProfile `averageFeedbackRating`/`feedbackCount` occur in one MongoDB transaction using persisted feedback.

## API Inventory

All prefixed paths below use the current default `/api/v1`.

### Public API

- `GET /health`, `GET /ready`
- `GET /api/v1/auth/csrf-token`
- `POST /api/v1/auth/register`, `/verify-email`, `/resend-verification`, `/login`, `/refresh`, `/logout` (unsafe requests require CSRF; auth state varies by operation)
- `GET /api/v1/categories`, `/categories/:categoryId`
- `GET /api/v1/products`, `/products/:productId`, `/products/:productId/reviews`
- `GET /api/v1/sellers/:sellerId`, `/sellers/:sellerId/feedbacks`

### Protected API

- `GET|PATCH /api/v1/users/me`, `PATCH /api/v1/users/me/password`
- `GET|POST /api/v1/addresses`; `PATCH|DELETE /api/v1/addresses/:addressId`; `PATCH /api/v1/addresses/:addressId/default`
- `GET /api/v1/notifications`, `/notifications/unread-count`; `PATCH /api/v1/notifications/:notificationId/read`, `/notifications/read-all`
- `POST /api/v1/products/:productId/reviews`
- `PATCH|DELETE /api/v1/product-reviews/:reviewId`
- `POST /api/v1/orders/:orderId/seller-feedback`
- `PATCH|DELETE /api/v1/seller-feedbacks/:feedbackId`
- `GET /api/v1/cart`; `POST /api/v1/cart/items`; `PATCH|DELETE /api/v1/cart/items/:productId`; `DELETE /api/v1/cart`; `POST /api/v1/cart/sync`
- `POST /api/v1/coupons/validate`, `/checkout/preview`, `/checkout`
- `GET /api/v1/checkout-groups/:checkoutGroupId`
- `GET /api/v1/orders`, `/orders/:orderId`
- `POST /api/v1/payments/paypal/create`, `/payments/paypal/capture`, `/payments/cod/confirm`
- `POST|GET /api/v1/returns`; `GET /api/v1/returns/:returnId`

### Người 1 API

Auth, users, addresses, notifications, health, and readiness endpoints listed above.

### Người 2 API

The Category, Product, Seller, Product Review, and Seller Feedback endpoints listed above. There is no Product write API or general Order API.

## Environment Variables

Backend environment variables belong in the ignored `.env`; the committed template is `.env.example`. Both paths are relative to the `backend/` working directory.

Required regardless of database mode: `CLIENT_ORIGIN`, `JWT_ACCESS_SECRET` (32+ characters), `JWT_REFRESH_SECRET` (32+), and `CSRF_SECRET` (32+).

Database: `MONGODB_URI` is optional when component configuration is used. Without it, `MONGODB_HOST` and `MONGODB_DATABASE` are required. `MONGODB_PORT`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_AUTH_SOURCE`, `MONGODB_REPLICA_SET`, `MONGODB_TLS`, `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`, and `MONGODB_SERVER_SELECTION_TIMEOUT_MS` configure the target and pool. Username/password must be supplied together.

Runtime/API: `NODE_ENV`, `PORT`, `API_PREFIX`, `TRUST_PROXY`, `LOG_LEVEL`. Swagger: `SWAGGER_ENABLED` controls whether UI and JSON routes are mounted (enabled by default outside production and disabled by default in production); `SWAGGER_PATH` sets their base path and defaults to `/api-docs`.

Auth/cookies: `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`.

Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_VERIFICATION_URL`, `EMAIL_OTP_TTL_MINUTES`, `EMAIL_OTP_MAX_ATTEMPTS`, `EMAIL_OTP_RESEND_COOLDOWN_SECONDS`, and `EMAIL_OTP_HMAC_SECRET`. SMTP is optional in development. Registration and resend send a six-digit OTP; verification accepts `{ "email": "...", "otp": "......" }`. Raw OTPs are never stored or returned, only HMAC-protected hashes are persisted, OTPs expire, max attempts and resend cooldown are enforced, and only the newest OTP is valid.

User4: `RETURN_WINDOW_DAYS` is a positive integer (default `30`); `SHIPMENT_ETA_DAYS` is a positive integer (default `3`) for the internal Shipment foundation ETA; `PAYPAL_SIMULATION_ENABLED` is `true|false` (default `true`) and gates the simulation provider actions. The complete authoritative inventory is `.env.example` and `src/config/env.js`.

## Database Connection

The backend accepts either a complete `MONGODB_URI` or component configuration (host, port, database, optional encoded username/password, authSource, replicaSet, and TLS). A non-empty complete URI takes precedence. `src/config/database.js` creates one memoized Mongoose connection at server startup with configured pool and server-selection options. It is not recreated per request.

```sh
cd backend
npm run db:check
```

## Testing

- Framework: Vitest; API tests use Supertest.
- Run verification from the backend package:

  ```sh
  cd backend
  npm test
  npm run test:coverage
  npm run lint
  ```

- Append a file and `-t` to `npm test --` to focus a suite/test.
- Integration suites start `MongoMemoryReplSet`, replace `MONGODB_URI`, and import/connect afterward; file parallelism is disabled.
- The rebased integrated baseline passes **164/164 tests** with the OTP/Swagger and User3/User4 scopes together.
- Swagger verification includes **7 Swagger integration tests**.
- `npm run docs:check` validates the OpenAPI 3.0.3 parser, exact 43-path/52-operation route inventory, unique operation IDs, and scope.
- Current User3/User4 focused/full totals are recorded in `docs/audits/USER_3_USER_4_COMPLIANCE_REPAIR_AUDIT.md`.
- User3/User4 focused coverage includes exact routes, DTO/raw boundaries, stale warnings, schema invariants, idempotency concurrency/reclaim, isolated Coupon races, provider outcomes, ownership/method state, Order filters/sorts, Return eligibility, and repository-stage rollback injection.
- Người 2 integration coverage includes visibility/search/detail, category filtering, dynamic attributes, seller projection, review/feedback CRUD and pagination, eligibility/ownership, auth/CSRF, duplicate prevention, aggregate transactions, and rollback.

## Documentation Paths

- `README.md`
- `docs/api/user-2-api.md`
- `docs/api/swagger-ui.md`
- `docs/architecture/README.md`
- `docs/audits/SWAGGER_IMPLEMENTATION_AUDIT.md`
- `docs/audits/`

## Swagger/OpenAPI

- Implementation: `src/docs/swagger.js` mounts Swagger UI and JSON; `src/docs/openapi/index.js` assembles the modular OpenAPI 3.0.3 document from components and path groups.
- Routes: default UI `/api-docs/`, JSON `/api-docs/openapi.json`, with `/api-docs` redirecting to the trailing-slash UI. The document has 43 paths and 52 actual operations, including health/readiness and all current User3/User4 routes.
- Version: OpenAPI 3.0.3 with a relative `/` server so the UI follows the serving origin.
- Validation script: `npm run docs:check` runs `src/scripts/check-openapi.js` to validate parser correctness, exact route inventory, unique operation IDs, and excluded future scope.
- Browser workflow: obtain a CSRF token and cookie, register if needed, verify email, obtain a fresh CSRF token, log in, rely on browser-managed HttpOnly cookies, and provide fresh CSRF tokens for unsafe requests. See `docs/api/swagger-ui.md`.
- Environment: `SWAGGER_ENABLED` and `SWAGGER_PATH`; production defaults to disabled and should remain disabled unless exposure is reviewed and restricted.
- Tests: `tests/integration/swagger.test.js` contains 7 checks for availability without database readiness, identity/server configuration, exact inventory, representative security, User3/User4 contracts, OTP preservation, and secret-field exclusion. The rebased integrated suite passes 164/164 tests.

## Pending Modules

The React frontend, Redis, and all deployment infrastructure remain pending. Repository-root `frontend/` and backend-local `infrastructure/` are placeholders, not implemented modules.

## Integration Contracts

Người 2 depends on this minimal Order shape:

```text
buyerId
sellerId                 # SellerProfile ID
orderStatus              # currently DELIVERED
items[]
  _id                    # orderItemId
  productId
  sellerId               # same SellerProfile as the order
  quantity
```

Review eligibility uses Buyer ownership, `DELIVERED`, exact item ID, and Product/Seller match. Feedback uses Buyer ownership, `DELIVERED`, and the Order's SellerProfile. The User 4 Order implementation preserves this contract while adding checkout fields and Buyer-owned reads.

## Last Updated

2026-07-21. Email verification uses six-digit HMAC-protected OTPs with persisted expiry, attempt limits, resend cooldown, newest-code-only invalidation, and transactional one-time consumption. Swagger UI and OpenAPI 3.0.3 are available at `/api-docs/` and `/api-docs/openapi.json`; the exact document inventory is **43 paths and 52 operations**, including all current User3/User4 routes. The rebased integrated full suite passes **164/164 tests**. Seed was not run. See `docs/audits/SWAGGER_IMPLEMENTATION_AUDIT.md` and `docs/audits/USER_3_USER_4_COMPLIANCE_REPAIR_AUDIT.md`.
