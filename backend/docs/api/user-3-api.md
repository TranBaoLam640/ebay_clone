# User 3 API

All endpoints use `/api/v1`, require an authenticated access-token cookie, and unsafe requests require the CSRF token from `GET /api/v1/auth/csrf-token` in `x-csrf-token`.

## Cart

- `GET /cart`
- `POST /cart/items` with `{ "productId": "<id>", "quantity": 2 }`
- `PATCH /cart/items/:productId` with `{ "quantity": 3 }`
- `DELETE /cart/items/:productId`
- `DELETE /cart`
- `POST /cart/sync` with `{ "items": [{ "productId": "<id>", "quantity": 2 }] }`

Quantities are absolute positive integers. Repeating `POST /cart/items` for the same Product is idempotent and sets the stored quantity to the requested absolute value. Raw Cart persistence contains only embedded Cart item identity, `productId`, and quantity. Responses hydrate current values into a nested safe `product` DTO (`id`, title, primary image, price, stock, status, SellerProfile summary). Product fields are not flattened onto the Cart item and Product snapshots are never persisted in Cart.

Add/update requires an active, visible Product with stock and active SellerProfile/Category. Empty Cart documents are retained after explicit mutations; an absent Cart returns the same empty shape with `id: null` without creating data.

Sync normalizes duplicate local Products to maximum quantity, merges overlap with `min(max(local, server), stock)`, preserves eligible server-only Products, and atomically removes stale entries. Both local and server-only inactive/deleted/missing entries emit `PRODUCT_UNAVAILABLE`; out-of-stock entries emit `PRODUCT_OUT_OF_STOCK`. Quantity and duplicate warnings use `QUANTITY_ADJUSTED` and `DUPLICATE_LOCAL_ITEM_NORMALIZED`. Warnings contain `productId`, requested, and final values, are deterministic response-only data, and are never persisted.

## Coupon validation

`POST /coupons/validate`

```json
{ "code": "SAVE10", "selectedCartItemIds": ["<cartItemId>"] }
```

Coupon codes normalize uppercase and are unique. Schema invariants enforce integer discount/money/limits, percentage values no greater than 100, percentage-only positive caps, expiration after start, and usage count no greater than a finite global limit. Validation derives selected current Cart prices and checks active interval, minimum subtotal, global count, and Buyer usage without writes. Runtime CouponUsage access is isolated in its dedicated repository; User 4 maintains an atomic MongoDB Coupon/Buyer counter for final checkout races.

## Checkout preview

`POST /checkout/preview`

```json
{
  "selectedCartItemIds": ["<cartItemId>"],
  "addressId": "<ownedAddressId>",
  "couponCode": "SAVE10",
  "paymentMethod": "COD"
}
```

Preview validates an owned address and nonempty exact Cart selection, then uses current Product pricing/eligibility. It returns selected items, SellerProfile groups sorted by ID, address, subtotal, one proportional deterministic Coupon discount, total, warnings, supported/selected payment methods, `VND`, and zero shipping fee.

Preview is stateless and does not mutate Cart, stock, Coupon/CouponUsage/counters, Orders, Payments, idempotency, or notifications. User 4 separately implements `POST /checkout`.
