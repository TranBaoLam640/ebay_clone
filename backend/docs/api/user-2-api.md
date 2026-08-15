# User 2 Buyer API

All endpoints use the existing success/error envelopes. Unsafe endpoints require an authenticated JWT cookie and `X-CSRF-Token` from `GET /api/v1/auth/csrf-token`. Public `sellerId` values are SellerProfile `_id` values.

## Categories

- `GET /api/v1/categories` returns ACTIVE categories sorted by name.
- `GET /api/v1/categories?parentId=<id>` returns one bounded child level.
- `GET /api/v1/categories/:categoryId` returns one ACTIVE category.

Inactive and missing categories return `404`; malformed IDs return `400`.

## Products

- `GET /api/v1/products`
- `GET /api/v1/products/:productId`

List query fields are `page` (default 1), `limit` (default 20, maximum 100), `search`, `categoryId`, `sellerId`, `minPrice`, `maxPrice`, and `sort`. Sort values are `newest`, `price_asc`, `price_desc`, and `rating_desc`.

Examples:

```http
GET /api/v1/products?search=laptop&categoryId=660000000000000000000021&page=1&limit=20
GET /api/v1/products?minPrice=1000000&maxPrice=30000000&sort=price_asc
GET /api/v1/products?sellerId=660000000000000000000011&sort=rating_desc
```

Search, visibility filters, relation checks, sorting, projection, and pagination execute in MongoDB. Buyer-visible statuses are ACTIVE and OUT_OF_STOCK. OUT_OF_STOCK always returns stock `0`. DRAFT, HIDDEN, and DELETED products, inactive Categories, and inactive/suspended Sellers are hidden as not found.

Dynamic attributes do not assume Category-specific fields:

```json
{
  "name": "RAM",
  "normalizedName": "ram",
  "value": 16,
  "dataType": "number",
  "unit": "GB"
}
```

Supported `dataType` values are `string`, `number`, `boolean`, and `date`. Product detail includes at most five recent public Review summaries.

## Sellers and Feedback

- `GET /api/v1/sellers/:sellerId`
- `GET /api/v1/sellers/:sellerId/feedbacks?page=1&limit=20&rating=5&sort=newest`
- `POST /api/v1/orders/:orderId/seller-feedback`
- `PATCH /api/v1/seller-feedbacks/:feedbackId`
- `DELETE /api/v1/seller-feedbacks/:feedbackId`

Create body:

```json
{
  "rating": 5,
  "comment": "Reliable seller",
  "itemAsDescribedRating": 5,
  "communicationRating": 5,
  "shippingRating": 4
}
```

The authenticated Buyer must own the DELIVERED Order. Seller identity is derived from that Order. One Feedback is allowed per Order. Seller feedback count and average are recalculated from MongoDB and persisted in the same transaction as each write.

## Product Reviews

- `GET /api/v1/products/:productId/reviews?page=1&limit=20&rating=5&sort=newest`
- `POST /api/v1/products/:productId/reviews`
- `PATCH /api/v1/product-reviews/:reviewId`
- `DELETE /api/v1/product-reviews/:reviewId`

Create body:

```json
{
  "orderId": "660000000000000000000041",
  "orderItemId": "660000000000000000000051",
  "rating": 5,
  "comment": "Excellent product"
}
```

`comment` is optional and limited to 2,000 characters. The authenticated Buyer must own the DELIVERED Order, and the exact embedded Order Item must match the Product. One Review is allowed per Order Item. Product review count and average are recalculated from MongoDB and persisted in the same transaction as each write.

## Minimal Order eligibility contract

The Order model contains `buyerId`, SellerProfile `sellerId`, `orderStatus`, timestamps, and embedded items with `_id`, `productId`, SellerProfile `sellerId`, and `quantity`. User 4 checkout extends it with checkout, payment, pricing, and Address snapshot fields while preserving these identifiers and DELIVERED eligibility semantics. User 2 exposes no Order creation or lifecycle route; its Review and Feedback flows only query the eligibility contract.

## Persistence and seed data

Run `npm run seed` against a development MongoDB replica set. Credentials and records are clearly fake; the script deterministically replaces only its own fixture IDs and disconnects afterward.

Categories, Seller Profiles, Products, Product Reviews, Seller Feedback, eligibility Orders, and persisted rating aggregates live in MongoDB. No mutable runtime global, Map, Set, local file, fake repository, session store, or process-local cache stores business records.
