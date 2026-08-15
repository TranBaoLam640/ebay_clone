# Swagger Implementation Audit

## Current scope

Swagger UI serves a modular OpenAPI 3.0.3 document for the backend's complete current HTTP surface: **43 paths and 52 operations**, including `GET /health`, `GET /ready`, the OTP authentication contract, all User 1/User 2 routes, and all current User 3/User 4 routes.

The User 3/User 4 additions document:

- Cart get, add, absolute-quantity update, remove, clear, and sync, including nested safe Product DTOs and exact response-only warning codes.
- Coupon validation against selected Cart item IDs.
- Stateless Checkout Preview and transactional final Checkout with required `Idempotency-Key`.
- Owned CheckoutGroup detail with Orders and Payment.
- Owned Order list/detail with `status`, `sellerId`, `from`, `to`, pagination, and `newest|oldest` sorting.
- PayPal create/capture and COD confirmation actions.
- Return create/list/detail with exact reason and status enums.

No CheckoutGroup list, Payment GET, direct payment-fail, `/return-requests`, Return PATCH/DELETE, Admin, Product-write, or general Order lifecycle mutation route is documented.

## OpenAPI implementation

- `src/docs/swagger.js`: mounts the trailing-slash UI, JSON document, base redirect, credentialed requests, and local Swagger UI assets.
- `src/docs/openapi/index.js`: assembles prefixed modular path groups and system paths.
- `src/docs/openapi/info.js`: API metadata, OTP/auth workflow, and tags.
- `src/docs/openapi/route-inventory.js`: exact 52-operation inventory and scope exclusions.
- `src/docs/openapi/components/`: reusable schemas, parameters, responses, and security schemes.
- `src/docs/openapi/paths/`: modular User 1-4 and foundation path definitions.
- `src/scripts/check-openapi.js`: parser, exact inventory, operation-ID, and scope validation.
- `tests/integration/swagger.test.js`: seven focused checks covering UI availability, identity/server, exact inventory, representative security, User3/User4 contracts, OTP preservation, and secret exclusion.
- `docs/api/swagger-ui.md`: operator and browser workflow.

## Routes and configuration

- UI: `/api-docs/`
- JSON: `/api-docs/openapi.json`
- Redirect: `/api-docs` to `/api-docs/`
- Environment: `SWAGGER_ENABLED`, `SWAGGER_PATH`
- Version: OpenAPI 3.0.3
- Server: relative `/`, preserving the serving host and deployment origin

Swagger defaults to enabled outside production and disabled in production. Enabling production documentation requires an explicit exposure/access review.

## Security schemes

- `accessCookie`: `apiKey` cookie `accessToken` for protected reads.
- `refreshCookie`: `apiKey` cookie `refreshToken` for refresh.
- `csrfToken`: `apiKey` header `X-CSRF-Token` for unsafe requests.

Public operations declare no authentication. Protected reads require `accessCookie`; protected unsafe operations require `accessCookie` and `csrfToken`; refresh requires `refreshCookie` and `csrfToken`. Unsafe public auth flows require CSRF as implemented. The required final Checkout idempotency key is documented separately as the `Idempotency-Key` header parameter.

HttpOnly authentication cookies remain unreadable by Swagger UI but are sent automatically through credentialed browser requests. Email verification remains the rebased six-digit OTP contract: `VerifyEmailRequest` requires `email` and `otp`, with `otp` matching `^\d{6}$`; no verification token field was reintroduced.

## Verification status

- Rebased integrated baseline supplied for this update: **164/164 tests passed**.
- `npm run docs:check`: **passed**, OpenAPI 3.0.3, **43 paths and 52 operations**, exact inventory, valid references, and unique operation IDs.
- Swagger-focused suite: **7/7 tests passed** with `npm test -- tests/integration/swagger.test.js`.
- No credential, connection URI, secret, password hash, token hash, or real token value is embedded in the document.

## Statelessness and security result

The documentation adds no session store, mutable business-state global, local-disk persistence, database dependency, or sticky-session requirement. The OpenAPI document is deterministic in-memory metadata assembled at process load. Swagger UI includes credentials but cannot expose HttpOnly cookie values. No Mongoose model or connection is imported by OpenAPI modules, no external validator is configured, and production documentation remains disabled by default.
