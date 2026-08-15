# SBay User Backend

Buyer-focused eBay Clone project with an ESM Node.js/Express/MongoDB backend. Người 1 covers foundation, authentication, users, addresses, security, and notifications. Người 2 adds catalog and reputation. Người 3 adds Cart, Coupon validation, pricing, and Checkout Preview. Người 4 adds transactional checkout, multi-seller Orders, COD and PayPal simulation Payments, owned reads, and Return Requests.

Pending work includes User 5's React frontend and User 6's Docker/MongoDB/Redis/Nginx/Jenkins/Kubernetes/autoscaling infrastructure.

## Repository structure

```text
/
├── backend/   # Complete Express backend, docs, tests, and future infrastructure placeholders
└── frontend/  # Uninitialized React placeholder for User 5
```

The Git repository root contains only these two visible folders. Backend source, tests, documentation, audits, configuration, and User 6 infrastructure placeholders live under `backend/`. Run backend commands after `cd backend`; if the terminal is already there, run the npm commands directly.

## Requirements

- Node.js 20+
- MongoDB for runtime. Use a replica set or sharded cluster because refresh rotation, verification, notification creation, and address consistency use transactions.
- Tests use `mongodb-memory-server` with `MongoMemoryReplSet` so transactions are exercised locally.

## Setup

From the repository root:

```sh
cd backend
cp .env.example .env
npm install
npm run dev
```

When already inside `backend/`, omit `cd backend`. Other verification and data commands are:

```sh
cd backend
npm test
npm run test:coverage
npm run lint
npm run db:check
npm run seed
```

Copy `.env.example` to `.env`. Supported variables are `NODE_ENV`, `PORT`, `API_PREFIX`; `MONGODB_URI` or component-mode `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_AUTH_SOURCE`, `MONGODB_REPLICA_SET`, `MONGODB_TLS`, `MONGODB_MAX_POOL_SIZE`, `MONGODB_MIN_POOL_SIZE`, `MONGODB_SERVER_SELECTION_TIMEOUT_MS`; `CLIENT_ORIGIN`, `TRUST_PROXY`; `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`; `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `COOKIE_DOMAIN`; `CSRF_SECRET`; `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_VERIFICATION_URL`; `LOG_LEVEL`, `RETURN_WINDOW_DAYS`, and `PAYPAL_SIMULATION_ENABLED`. JWT/CSRF secrets require 32+ characters.

### Remote MongoDB configuration

A complete URI takes precedence over component variables:

```env
MONGODB_URI=mongodb://<username>:<password>@<server-ip>:27017/<database>?authSource=admin
```

Alternatively, leave `MONGODB_URI` empty and configure components:

```env
MONGODB_HOST=<server-ip>
MONGODB_PORT=27017
MONGODB_DATABASE=ebay_buyer
MONGODB_USERNAME=<username>
MONGODB_PASSWORD=<password>
MONGODB_AUTH_SOURCE=admin
MONGODB_REPLICA_SET=rs0
MONGODB_TLS=false
```

Copy `.env.example` to `.env`; never commit `.env`. Component-mode username/password values are URL encoded by the backend. If writing a URI manually, URL encode credentials yourself. Restrict the MongoDB firewall and `bindIp` to required client addresses, never expose MongoDB to the whole internet, and grant the database user only required privileges.

The application uses transactions, so MongoDB should be a replica set or sharded cluster. Standalone servers may fail transactional flows; do not remove transactions to hide topology problems. `MONGODB_REPLICA_SET=rs0` adds the option in component mode. If a complete URI already contains `replicaSet`, nothing is appended. When connecting by IP/DNS, every member hostname advertised by the replica set must also be reachable from the backend.

### Check the connection

```sh
npm run db:check
```

On success, the command reports the database name, MongoDB version, Mongoose ready state, and replica-set name when available, then closes the connection. It never prints the credential URI. Common failures include authentication failure, connection refusal, timeout, incorrect `authSource`, replica-set mismatch or unreachable advertised members, a closed firewall, and MongoDB `bindIp` rejecting remote clients.

## Email

Configure SMTP manually in `.env` with `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, and `EMAIL_VERIFICATION_URL`. Use `EMAIL_SECURE=true` for implicit TLS such as port 465; use `false` for STARTTLS transports such as port 587. When SMTP is not configured in development, verification emails are suppressed safely.

Registration sends a six-digit email OTP. Submit `{ "email": "buyer@example.com", "otp": "042731" }` to `/api/v1/auth/verify-email`, and `{ "email": "buyer@example.com" }` to `/api/v1/auth/resend-verification`. OTPs expire after `EMAIL_OTP_TTL_MINUTES` (10 minutes by default), allow `EMAIL_OTP_MAX_ATTEMPTS` attempts (5), and can be resent after `EMAIL_OTP_RESEND_COOLDOWN_SECONDS` (60). Only the newest OTP is valid. Raw OTPs are never stored or returned; MongoDB stores only an HMAC-SHA256 hash in the existing `emailverificationtokens` collection.

Tests mock `emailService.sendVerificationEmail` and capture the six-digit OTP from its outbound argument. The API does not return verification OTPs.

## Scripts

- `npm run dev` - start with Node watch mode
- `npm start` - start the API
- `npm test` - run Vitest once
- `npm run test:watch` - run Vitest in watch mode
- `npm run test:coverage` - run Vitest with V8 coverage
- `npm run lint` - ESLint and Prettier check for source, tests, and project files
- `npm run format` - Prettier write
- `npm run seed` - recreate deterministic fake Buyer, Seller, Category, Product, and delivered Order development fixtures after deleting matching fixed IDs
- `npm run db:check` - validate configuration, connect, ping MongoDB, print safe server metadata, and disconnect
- `npm run docs:check` - parse and validate the OpenAPI document, exact route inventory, unique operation IDs, and scope

## Swagger UI and OpenAPI

From `backend/`, start the API:

```sh
npm run dev
```

Then open:

- Swagger UI: <http://localhost:4000/api-docs/>
- OpenAPI JSON: <http://localhost:4000/api-docs/openapi.json>

The document uses OpenAPI 3.0.3 and currently describes all 43 paths and 52 operations, including `/health`, `/ready`, and every implemented User 3/User 4 Cart, Coupon, Checkout, CheckoutGroup, Order read, Payment action, and Return route. Swagger UI assets are served locally and the custom CSS changes layout and spacing only, leaving Swagger's own colors intact to avoid conflicts with browser dark-mode extensions. No external UI assets or validators are loaded.

### Servers selector

The **Servers** selector defines the base URL used when Swagger UI executes a request through **Try it out**. Its current value is `/`, which means same origin: the browser uses the protocol, host, and port that served Swagger UI. For example, Swagger opened at `http://localhost:4000/api-docs/` sends API calls to `http://localhost:4000/...`. Keeping this value relative avoids hard-coding localhost, a remote IP, or a production domain, so the same OpenAPI document works across development and deployment environments.

`SWAGGER_ENABLED` enables or disables both documentation endpoints; `SWAGGER_PATH` changes the base path without a trailing slash. Swagger defaults to enabled outside production and disabled in production. Do not enable interactive API documentation in production unless its exposure has been explicitly reviewed and access is appropriately restricted.

Validate documentation without starting the server or connecting to MongoDB:

```sh
npm run docs:check
```

### Authenticated Swagger workflow

HttpOnly authentication cookies are intentionally invisible to Swagger UI and browser JavaScript. The browser still stores and sends them because Swagger requests include credentials. Use this workflow:

1. Open Swagger UI in the same browser context that will hold the cookies.
2. Call `GET /api/v1/auth/csrf-token`.
3. Copy `data.csrfToken` from the response; retain the associated CSRF cookie automatically set by the browser.
4. Call `POST /api/v1/auth/register` with the copied value in `X-CSRF-Token` if the Buyer does not exist.
5. Complete `POST /api/v1/auth/verify-email`; email verification remains required before login.
6. If needed, fetch a fresh CSRF token, then call `POST /api/v1/auth/login` with `X-CSRF-Token`.
7. Confirm the browser accepted the `accessToken` and `refreshToken` HttpOnly cookies; their values will not appear in Swagger UI.
8. Fetch a fresh CSRF token before each protected unsafe `POST`, `PATCH`, or `DELETE`, and send it in `X-CSRF-Token`; protected `GET` requests need only the automatically sent access cookie.
9. Use `POST /api/v1/auth/refresh` with the refresh cookie and a fresh CSRF token when required, then `POST /api/v1/auth/logout` with a fresh CSRF token to revoke the session and clear cookies.

See [`docs/api/swagger-ui.md`](docs/api/swagger-ui.md) for concise testing guidance.

`RETURN_WINDOW_DAYS` is a positive integer and defaults to `30`. `PAYPAL_SIMULATION_ENABLED` accepts `true` or `false` and defaults to `true`; disabling it makes PayPal provider actions fail without changing checkout persistence.

## Security model

All auth tokens are delivered only as HttpOnly cookies: `accessToken` and `refreshToken`. Refresh cookies contain signed HS256 JWTs with unique IDs; signature, algorithm, type, subject, and expiration are verified before the SHA-256 hash is looked up in MongoDB. Refresh rotation atomically revokes the previous hash and creates the replacement in a MongoDB transaction; logout and password change revoke active refresh records.

Unsafe `/api/v1` requests require a `csrf-csrf` double-submit CSRF token from `GET /api/v1/auth/csrf-token` in the `X-CSRF-Token` header. Responses include Helmet headers, strict CORS for configured origins, request IDs, generic auth errors, standardized error bodies, and rate-limit middleware. Logs redact passwords, password hashes, token fields, cookies, authorization, and CSRF headers.

Durable business/auth state is multipod-safe: users, tokens/revocation, addresses, notifications, carts, checkout idempotency, Coupon counters, payments/restoration, Orders, and Returns are stored in MongoDB, while credentials use cookies/JWTs. User 1 security regression coverage verifies its existing auth, CSRF, authorization, redaction, and rate-limit behavior; it is not a complete security audit. Historical User1 `express-rate-limit` instances still use process-local default memory counters, so rate-limit quotas are per process until future infrastructure provides a shared store; this repair does not alter them or add Redis.

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /api/v1/auth/csrf-token`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `PATCH /api/v1/users/me/password`
- `GET /api/v1/addresses`
- `POST /api/v1/addresses`
- `PATCH /api/v1/addresses/:addressId`
- `DELETE /api/v1/addresses/:addressId`
- `PATCH /api/v1/addresses/:addressId/default`
- `GET /api/v1/notifications?page=1&limit=20&isRead=false&type=SYSTEM`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/:notificationId/read`
- `PATCH /api/v1/notifications/read-all`
- `GET /api/v1/categories?parentId=<categoryId>`
- `GET /api/v1/categories/:categoryId`
- `GET /api/v1/products?page=1&limit=20&search=laptop&categoryId=<id>&sellerId=<id>&minPrice=100000&maxPrice=30000000&sort=price_asc`
- `GET /api/v1/products/:productId`
- `GET /api/v1/products/:productId/reviews?page=1&limit=20&rating=5&sort=newest`
- `POST /api/v1/products/:productId/reviews`
- `PATCH /api/v1/product-reviews/:reviewId`
- `DELETE /api/v1/product-reviews/:reviewId`
- `GET /api/v1/sellers/:sellerId`
- `GET /api/v1/sellers/:sellerId/feedbacks?page=1&limit=20`
- `POST /api/v1/orders/:orderId/seller-feedback`
- `PATCH /api/v1/seller-feedbacks/:feedbackId`
- `DELETE /api/v1/seller-feedbacks/:feedbackId`
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH|DELETE /api/v1/cart/items/:productId`
- `DELETE /api/v1/cart`
- `POST /api/v1/cart/sync`
- `POST /api/v1/coupons/validate`
- `POST /api/v1/checkout/preview`
- `POST /api/v1/checkout` (requires `Idempotency-Key`)
- `GET /api/v1/checkout-groups/:checkoutGroupId`
- `GET /api/v1/orders`, `/orders/:orderId`
- `POST /api/v1/payments/paypal/create`
- `POST /api/v1/payments/paypal/capture`
- `POST /api/v1/payments/cod/confirm`
- `POST|GET /api/v1/returns`
- `GET /api/v1/returns/:returnId`

Public `sellerId` values are SellerProfile IDs. Dynamic Product attributes are category-independent and retain type metadata, for example `{ "name": "RAM", "normalizedName": "ram", "value": 16, "dataType": "number", "unit": "GB" }`.

The Order contract preserves `buyerId`, SellerProfile `sellerId`, statuses including `DELIVERED`, and embedded `_id`, `productId`, `sellerId`, and `quantity`, while adding checkout, payment, immutable pricing/address snapshots, and Buyer reads. Review creation and Seller Feedback continue to require delivered Orders.

Email OTP request/response contracts are in [`docs/api/auth-email-otp.md`](docs/api/auth-email-otp.md). Detailed contracts are in [`docs/api/user-2-api.md`](docs/api/user-2-api.md), [`docs/api/user-3-api.md`](docs/api/user-3-api.md), and [`docs/api/user-4-api.md`](docs/api/user-4-api.md). Swagger usage is in [`docs/api/swagger-ui.md`](docs/api/swagger-ui.md), with its implementation audit in [`docs/audits/SWAGGER_IMPLEMENTATION_AUDIT.md`](docs/audits/SWAGGER_IMPLEMENTATION_AUDIT.md). Checkout Preview remains write-free. Final checkout creates a PENDING Payment without calling a provider; dedicated PayPal create/capture and COD confirm routes enforce ownership, method, and state. Checkout uses atomic claim/replay idempotency, stock/status transitions, Coupon global/Buyer counters, safe allowlists, and typed transactional notifications. Provider capture failure restores stock and Coupon state exactly once. Buyer Returns expose create/list/detail with exact enums and one record per Order. See also [`docs/architecture/README.md`](docs/architecture/README.md), [`docs/audits/USER_3_USER_4_COMPLIANCE_REPAIR_AUDIT.md`](docs/audits/USER_3_USER_4_COMPLIANCE_REPAIR_AUDIT.md), and [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).

## Người 2: catalog and reputation

### Product model and dynamic attributes

A Product is a sellable listing owned by one SellerProfile. Persisted fields include `sellerId`, `categoryId`, `title`, `description`, `price`, `stock`, `images`, `attributes`, `status`, `averageRating`, and `reviewCount`. Buyer APIs show only `ACTIVE` and `OUT_OF_STOCK` listings whose SellerProfile and Category are active.

Attributes are category-independent typed values:

```json
{
  "name": "RAM",
  "normalizedName": "ram",
  "value": 16,
  "dataType": "number",
  "unit": "GB"
}
```

Do not define one fixed field set such as RAM, CPU, or shoe size for every Category.

### Product search

```http
GET /api/v1/products?page=1&limit=20&search=iphone&categoryId=<id>&minPrice=1000000&maxPrice=30000000&sort=price_asc
```

Supported query fields are `page`, `limit`, `search`, `categoryId`, `sellerId`, `minPrice`, `maxPrice`, `inStock`, and `sort`. Filtering, text search, active Seller/Category lookups, sorting, pagination, and counting execute in MongoDB aggregation rather than loading and filtering the catalog in JavaScript.

### Product Review

Review writes require authentication and CSRF. The Buyer must own a `DELIVERED` Order whose exact `orderItemId` belongs to the requested Product and Seller. A unique `orderItemId` permits one Review per Order Item. Review create/update/delete and recalculation of Product `averageRating`/`reviewCount` run in one transaction against persisted records.

### Seller Feedback

Seller Feedback is separate from Product Review: it rates the SellerProfile for a complete Order. The authenticated Buyer must own a `DELIVERED` Order; the Seller is derived from that Order. A unique `orderId` permits one Seller Feedback per Order. Mutations and recalculation of SellerProfile `averageFeedbackRating`/`feedbackCount` run in one transaction.

### Minimal Order eligibility contract

Người 2 uses Order only as a read-only integration contract:

```text
buyerId
sellerId
orderStatus
items[]
```

Each Order Item provides:

```text
_id
productId
sellerId
quantity
```

User4 checkout creates Orders internally and exposes only Buyer-owned reads; there is no public general Order creation or lifecycle route. The implemented Order contract preserves Buyer ownership, SellerProfile IDs, embedded item IDs/product/seller fields, and `DELIVERED` eligibility semantics.

### Người 2 API

Public:

- `GET /api/v1/categories`
- `GET /api/v1/categories/:categoryId`
- `GET /api/v1/products`
- `GET /api/v1/products/:productId`
- `GET /api/v1/products/:productId/reviews`
- `GET /api/v1/sellers/:sellerId`
- `GET /api/v1/sellers/:sellerId/feedbacks`

Protected and CSRF-checked:

- `POST /api/v1/products/:productId/reviews`
- `PATCH /api/v1/product-reviews/:reviewId`
- `DELETE /api/v1/product-reviews/:reviewId`
- `POST /api/v1/orders/:orderId/seller-feedback`
- `PATCH /api/v1/seller-feedbacks/:feedbackId`
- `DELETE /api/v1/seller-feedbacks/:feedbackId`

### Indexes and performance

- Category: unique `slug`; `(status, name)`; `(parentId, status)`.
- Product: `(status, categoryId, price)`; `(status, sellerId, createdAt desc)`; `(status, createdAt desc)`; text index on `title` and `description`.
- Product Review: unique `orderItemId`; `(productId, createdAt desc)`; `(buyerId, createdAt desc)`.
- Seller Feedback: unique `orderId`; `(sellerId, createdAt desc)`; `(buyerId, createdAt desc)`.

### Seed data

```sh
npm run seed
```

The deterministic seed recreates three users (two Seller owners and one Buyer), two active SellerProfiles, active Electronics/Fashion plus an inactive Category, active Laptop/Shoes, an out-of-stock Headphones listing, a hidden Product, and one delivered Laptop Order used for Review/Feedback eligibility. It deletes records matching its fixed fixture IDs first; do not run it against data that must be preserved.

### Tests

`npm test` runs Vitest. The rebased integrated suite passes **164/164 tests**. Integration suites use `MongoMemoryReplSet` so transaction and concurrency behavior is exercised. Focused User 3/User 4 compliance verification covers direct schemas, Cart DTO/raw persistence and stale sync, idempotency claim/replay/reclaim/TTL, stock and Coupon races, exact PayPal outcomes, rollback injection, safe reads, Return state/uniqueness, notifications, route inventory, and User 1/2 compatibility. Exact final results are recorded in [`docs/audits/USER_3_USER_4_COMPLIANCE_REPAIR_AUDIT.md`](docs/audits/USER_3_USER_4_COMPLIANCE_REPAIR_AUDIT.md).

## Architecture

Routes call controllers, controllers call services, services call repositories, and repositories are the normal runtime source files that import Mongoose models for module data access. `src/scripts/seed.js` is the explicit development-fixture exception and imports models directly. Address create, update, default changes, and delete-promotion run inside MongoDB transactions and use owner + resource composite queries. Product, Review, Feedback, Seller aggregate, Category, and eligibility Order records are stored in MongoDB. Review/Product aggregate and Feedback/Seller aggregate changes are transactional. Runtime business state is never stored in globals or process-local collections, so Pods do not require sticky sessions for business correctness. User1 rate-limit counters are the documented process-local infrastructure exception.
