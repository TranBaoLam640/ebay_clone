# User 3 / User 4 Compliance Repair Audit

## Current result

The repair implements the current compliance matrix without running seed, committing, pushing, changing User1 rate limiting, adding Redis, or broadly formatting the repository.

## Persistence and boundaries

- CouponUsage has a dedicated repository. Repositories are the normal runtime model-import boundary; `src/scripts/seed.js` is the documented direct-model fixture exception.
- Coupon schema direct tests cover normalization, cross-field dates/types, percentage bounds, and zero/fractional limits.
- Raw Cart persists only item identity, Product reference, and quantity; nested Product response hydration is not persisted.
- Idempotency stores atomic owner claim, exact request hash/response, attempts, PROCESSING/COMPLETED/FAILED timestamps, failure data, stale reclaim, and TTL.
- Read-only Coupon evaluate/validate/Preview enforce the global limit against the maximum of persisted `usageCount` and actual CouponUsage history, using the caller's session when present and performing no reconciliation write. Global Coupon consumption uses one transaction-scoped conditional update that applies the guard to the same effective count and increments atomically. Buyer counters initialize from the maximum durable legacy/current value, retry duplicate-upsert races safely, and reverse transactionally.
- Payment provider identity/outcome and exactly-once restoration state are durable. PayPal create/capture use persisted tokenized leases; completion/release conditions include the owning token so stale workers cannot mutate newer claims. Provider create occurs only after ownership and outside checkout's retryable transaction.
- ReturnRequest has exact enums, unique Order index, present/nonfuture/in-window delivery eligibility, and Buyer create/list/detail scope.

## Transactions, concurrency, and rollback evidence

- Checkout atomically covers stock/status, group, Orders, Payment, Coupon global/Buyer usage, CouponUsage, selected Cart removal, seller notifications, and exact idempotency completion.
- Same-key concurrent checkout, stale PROCESSING reclaim, stock contention, isolated global Coupon contention, and isolated per-user limit-above-one contention prove one bounded durable result.
- PayPal create validates provider result before persistence. Concurrent create/capture APIs prove one provider invocation per live lease. Capture success/failure and COD confirmation transition only owned matching-method Payments. Invalid/rejected/mismatched provider outcomes leave durable business state unchanged and release only the caller's lease.
- Persisted notification assertions verify the actual typed event constants and counts for checkout seller `ORDER_PLACED`, PayPal create/capture/failure, COD confirmation, and Return Buyer/seller creation. Return create and typed Buyer/seller notifications share one transaction; a foreign Buyer cannot create a Return for another Buyer's delivered Order.
- Vitest mocks inject failures at the nearest exact boundary after stock deduction, group creation, Order creation, Payment creation, group linking, Coupon consumption, Cart removal, and notification creation. The separate idempotency repository-completion mock intercepts the actual post-resource persistence call, queries the same transaction session, and proves group, Order, Payment, and CouponUsage already exist before throwing; every resource rolls back and FAILED is marked outside the transaction.
- Additional mocks prove payment capture notification rollback, failed-payment restoration rollback, and Return notification rollback. No production fault flags exist.

## Safe reads and exact routes

- Checkout response, Preview, CheckoutGroup detail, Orders/items, Payment, Returns, and Address snapshots pass through explicit allowlist mappers with no `buyerId`, `__v`, Address identity/owner/default metadata, restoration, or provider internals.
- Order tests cover each required filter independently, newest/oldest ordering, and rejection of unsupported total sorts.
- Router-stack inventory asserts exactly the required User4 routes and absence of old CheckoutGroup list, Payment GET/path-ID actions, `/return-requests`, and Return PATCH/DELETE routes.
- User1/2 reputation routes and delivered eligibility remain compatible.

## Determinism and infrastructure qualification

- User3/User4 seed helpers use fixed UTC business dates and fixed `createdAt`/`updatedAt`; seed syntax is checked and seed is not run.
- New User3/User4 business coordination state is MongoDB-durable. Historical User1 `express-rate-limit` counters still use the package's process-local default memory store; no Redis or rate-limit redesign is part of this repair.

## Verification

- Focused User3/User4 repair suite: **63/63 tests across 4 files passed**.
- Pre-rebase User3/User4 repair baseline: **132/132 tests across 9 files passed**. Historical User1/2 suites were included unchanged; this audit does not claim additional User1 behavior beyond those existing tests.
- Rebased integrated OTP/Swagger/User3/User4 baseline: **164/164 tests passed**.
- Current Swagger-focused suite: **7/7 tests passed**; `npm run docs:check` passes OpenAPI 3.0.3 validation and the exact **43-path/52-operation** inventory.
- Targeted ESLint passed with no output, and targeted Prettier passed for all changed User3/User4/repair JavaScript and documentation files.
- Repository `npm run lint` completed ESLint successfully, then remained nonzero only because of 85 untouched historical Prettier mismatches outside the targeted repair set.
- Seed was not run.

Older totals in `USER_3_IMPLEMENTATION_AUDIT.md` and `USER_4_IMPLEMENTATION_AUDIT.md` are historical snapshots, not current verification.
