# User 3 Implementation Plan

## Scope

Implement backend-only Buyer Cart, Coupon validation, and stateless Checkout Preview. Do not implement checkout execution, Order creation/lifecycle, Payment persistence, notifications, coupon usage writes, stock changes, or cart clearing during preview.

## Architecture

Preserve `route -> controller -> service -> repository -> model`. Only repositories import runtime Mongoose models. Cross-module reads use narrow repository operations for current Product eligibility/hydration and owned Address lookup. All auth and unsafe-request CSRF behavior uses existing middleware, validation uses Zod, and responses/errors use existing helpers.

## Data model and indexes

- `Cart`: unique `userId`; embedded items `{ _id, productId, quantity }`; timestamps. Empty carts are retained after item/cart deletion and represented consistently as an empty hydrated cart.
- `Coupon`: uppercase unique `code`, description, `PERCENTAGE|FIXED_AMOUNT`, integer discount/minimum/cap values, validity dates, optional global/per-user limits, usage count, status, timestamps; unique code and compound status/date indexes.
- `CouponUsage`: coupon, Buyer, checkout group, Order IDs, used time, timestamps; coupon/Buyer lookup index and unique coupon/checkout-group index. User 3 only counts usages.

## Cart behavior

- Add (`POST`) and update (`PATCH`) accept absolute positive integer quantities and reject unavailable, out-of-stock, and overstock products.
- Reads hydrate current title, primary image, price, stock, status, SellerProfile ID/display name, item subtotal, subtotal, and total quantity.
- Purchasability requires Product `ACTIVE`, stock above zero, buyer visibility, active SellerProfile, and active Category.
- Sync validates a strict array of `{ productId, quantity }`, normalizes duplicate local products to their maximum quantity, preserves server-only items, and merges overlapping quantities as `min(max(local, server), stock)`.
- Sync omits unavailable/out-of-stock local items and emits deterministic non-persisted warnings: `PRODUCT_UNAVAILABLE`, `PRODUCT_OUT_OF_STOCK`, `QUANTITY_ADJUSTED`, and `DUPLICATE_LOCAL_ITEM_NORMALIZED`, including requested/final quantities.
- Sync is idempotent and executes its read/merge/write atomically in a MongoDB transaction. The unique user cart and transactional replacement prevent partial state and lost server-only items.

## Coupon validation and shared pricing

- Validation derives the selected subtotal from the authenticated Buyer’s current cart and current Product records; clients cannot submit prices.
- Validate coupon status, validity interval, minimum subtotal, global usage limit, and per-Buyer usage limit without writes.
- Integer discount is percentage floor with optional cap, or fixed amount capped at subtotal.
- A pure shared pricing service computes coupon discount and deterministic proportional Seller discount allocation. Seller groups sort by SellerProfile ID; floor allocations go to each group and the final group receives the bounded remainder.

## Checkout preview

- Require nonempty selected cart item IDs, owned address, optional coupon code, and `COD|PAYPAL` payment method.
- Revalidate current visibility, status, stock, and prices; group selected items by SellerProfile; currency is `VND`, shipping fee is zero.
- Return selected items, sorted Seller groups, address, subtotal, one overall coupon discount, total, stock warnings, supported payment methods, currency, and shipping fee.
- Preview performs no Cart, Coupon, CouponUsage, Order, Payment, Product, stock, or notification writes. No `POST /checkout` route is added.

## Routes

- `GET /cart`
- `POST /cart/items`
- `PATCH /cart/items/:productId`
- `DELETE /cart/items/:productId`
- `DELETE /cart`
- `POST /cart/sync`
- `POST /coupons/validate`
- `POST /checkout/preview`

All routes are authenticated; global middleware requires CSRF for every unsafe route.

## Verification

Add broad integration coverage for authentication/CSRF, empty and hydrated carts, absolute quantity operations, availability/stock failures, deletion semantics, sync merge/warnings/duplicates/idempotence/concurrency, coupon rules/math/limits/no writes, checkout ownership/selection/stock/grouping/allocation/current pricing/statelessness, and route absence. Run focused User 3 tests, the full suite, and `npm run lint` without running the seed.

## Documentation

Create `docs/api/user-3-api.md` and `docs/audits/USER_3_IMPLEMENTATION_AUDIT.md`; update README and PROJECT_CONTEXT with models, contracts, endpoints, empty-cart policy, stateless preview boundaries, seed fixtures, and verified results. No OpenAPI artifact will be introduced.
