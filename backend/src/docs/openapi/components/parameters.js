const query = (name, schema, description) => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
});
const identifier = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { $ref: '#/components/schemas/ObjectId' },
});

export const parameters = {
  Page: query(
    'page',
    { type: 'integer', minimum: 1, default: 1 },
    'One-based page number.',
  ),
  Limit: query(
    'limit',
    { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    'Maximum records per page.',
  ),
  AddressId: identifier('addressId', 'Address identifier.'),
  NotificationId: identifier('notificationId', 'Notification identifier.'),
  CategoryId: identifier('categoryId', 'Category identifier.'),
  ProductId: identifier('productId', 'Product identifier.'),
  ReviewId: identifier('reviewId', 'Product review identifier.'),
  SellerId: identifier(
    'sellerId',
    'Seller profile identifier, not a user identifier.',
  ),
  OrderId: identifier('orderId', 'Order identifier.'),
  OrderItemId: identifier('orderItemId', 'Embedded order item identifier.'),
  FeedbackId: identifier('feedbackId', 'Seller feedback identifier.'),
  CheckoutGroupId: identifier(
    'checkoutGroupId',
    'Buyer-owned checkout group identifier.',
  ),
  ReturnId: identifier('returnId', 'Buyer-owned return request identifier.'),
};
