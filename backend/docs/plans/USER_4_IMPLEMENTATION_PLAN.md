# User 4 Implementation Plan

## Scope

Implement final Buyer checkout execution, payment persistence and simulation, Buyer order reads, and Buyer return requests while preserving all User 3 behavior and the delivered Order contracts used by reviews and seller feedback.

## Architecture

Preserve `route -> controller -> service -> repository -> model`. Runtime Mongoose model imports remain confined to repositories. Final checkout runs in a MongoDB transaction and stores all durable coordination state in MongoDB so behavior remains stateless across application instances.

## Checkout and idempotency

- Add authenticated `POST /checkout`, requiring a nonempty `Idempotency-Key` header and the existing preview body contract.
- Store a Buyer-scoped idempotency record with a request fingerprint, lifecycle state, and replayable response. The same key and payload replays; a changed payload conflicts; concurrent attempts produce one checkout result.
- Revalidate address ownership, selected cart items, current Product/Seller/Category eligibility, prices, stock, coupon eligibility, limits, and allocation inside the transaction.
- Atomically deduct each Product quantity using stock-conditional updates. Any failed condition aborts the complete transaction.
- Create one CheckoutGroup and one Order per SellerProfile, preserving deterministic Seller discount allocation and immutable item/address/pricing snapshots.
- Increment coupon `usageCount` conditionally and create exactly one CouponUsage linked to the CheckoutGroup and Orders.
- Remove only selected cart items and create Buyer/seller notifications through the existing notification service in the same transaction.

## Orders, payments, and restoration

- Compatibly extend Order statuses and fields while preserving `buyerId`, SellerProfile `sellerId`, embedded item identifiers, and `DELIVERED` review/feedback eligibility.
- Persist one Payment per CheckoutGroup. COD checkout is confirmed immediately according to its offline-payment state.
- Implement persisted, idempotent PayPal simulation create/capture success and failure flows.
- A terminal PayPal failure transaction reverses coupon usage/count, restores stock exactly once, and updates CheckoutGroup, Orders, and Payment consistently without restoring unrelated cart state.
- Add authenticated Buyer CheckoutGroup detail/list and paginated Order list/detail routes with strict ownership.

## Returns

- Add Buyer ReturnRequest create, list, detail, update, and cancel/delete scope with authentication, CSRF on unsafe requests, ownership enforcement, strict validation, useful indexes, and eligibility based on delivered Buyer-owned Order items and configured return window.
- Prevent duplicate active requests for the same Order item and retain durable status/history fields needed for lifecycle safety.

## Configuration, seed, and documentation

- Add safe environment defaults for User 4 payment simulation and return eligibility settings and document them in `.env.example`.
- Extend deterministic seed fixtures for CheckoutGroups, Orders, Payments, and ReturnRequests without running the seed.
- Add API documentation and update README/PROJECT_CONTEXT to describe routes, models, transaction boundaries, idempotency, payment simulation, restoration, and return rules.

## Verification

- Intentionally replace the User 3 final-checkout route-absence assertion with compatibility coverage.
- Add comprehensive integration tests for rollback, concurrent stock/coupon/idempotency races, replay and payload conflicts, selected-item removal, multi-seller allocation, payment create/capture/failure and exactly-once restoration, ownership, pagination, returns, notifications, regressions, and process statelessness.
- Run focused User 4 tests during development, then relevant/full tests and `npm run lint`. Do not run the seed and do not commit or push.
