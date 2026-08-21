import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  EXPECTED_ROUTE_INVENTORY,
  OUT_OF_SCOPE_PATH_FRAGMENTS,
  getOperations,
  getRouteInventory,
} from '../../src/docs/openapi/route-inventory.js';

const app = createApp();
const jsonPath = '/api-docs/openapi.json';

const getDocument = async () =>
  (await request(app).get(jsonPath).expect('Content-Type', /json/).expect(200))
    .body;

const operation = (document, method, path) => document.paths[path][method];

const expectSecurity = (document, method, path, security) => {
  expect(operation(document, method, path).security).toEqual(security);
};

describe('Swagger documentation', () => {
  it('serves the UI without requiring database readiness', async () => {
    const readiness = await request(app).get('/ready').expect(503);
    expect(readiness.body.data.status).toBe('not_ready');
    const response = await request(app).get('/api-docs/').expect(200);
    expect(response.type).toBe('text/html');
    expect(response.text).toContain('id="swagger-ui"');
    expect(response.text).toContain('swagger-ui-bundle.js');
    expect(response.text).toContain('swagger-ui-init.js');
  });

  it('serves the expected OpenAPI identity and relative server', async () => {
    const document = await getDocument();
    expect(document.openapi).toBe('3.0.3');
    expect(document.info.title).toBe('SBay Buyer API');
    expect(document.servers).toEqual([{ url: '/' }]);
  });

  it('contains exactly the expected unique operation inventory', async () => {
    const document = await getDocument();
    const inventory = getRouteInventory(document);
    expect(inventory).toHaveLength(91);
    expect(Object.keys(document.paths)).toHaveLength(78);
    expect(new Set(inventory)).toEqual(new Set(EXPECTED_ROUTE_INVENTORY));
    const operationIds = getOperations(document).map(
      ({ operation: item }) => item.operationId,
    );
    expect(operationIds.every(Boolean)).toBe(true);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(
      Object.keys(document.paths).some((path) =>
        OUT_OF_SCOPE_PATH_FRAGMENTS.some((fragment) =>
          path.toLowerCase().includes(fragment),
        ),
      ),
    ).toBe(false);
  });

  it('documents representative security requirements', async () => {
    const document = await getDocument();
    expectSecurity(document, 'get', '/health', []);
    expectSecurity(document, 'get', '/ready', []);
    expectSecurity(document, 'get', '/api/v1/categories', []);
    expectSecurity(document, 'get', '/api/v1/products', []);
    expectSecurity(document, 'get', '/api/v1/users/me', [{ accessCookie: [] }]);
    expectSecurity(document, 'post', '/api/v1/products/{productId}/reviews', [
      { accessCookie: [], csrfToken: [] },
    ]);
    expectSecurity(
      document,
      'post',
      '/api/v1/orders/{orderId}/items/{orderItemId}/product-review',
      [{ accessCookie: [], csrfToken: [] }],
    );
    expectSecurity(document, 'post', '/api/v1/auth/register', [
      { csrfToken: [] },
    ]);
    expectSecurity(document, 'post', '/api/v1/auth/refresh', [
      { refreshCookie: [], csrfToken: [] },
    ]);
    expectSecurity(document, 'get', '/api/v1/auth/csrf-token', []);
    const access = [{ accessCookie: [] }];
    const unsafe = [{ accessCookie: [], csrfToken: [] }];
    for (const [method, path] of [
      ['get', '/api/v1/cart'],
      ['get', '/api/v1/checkout-groups/{checkoutGroupId}'],
      ['get', '/api/v1/orders'],
      ['get', '/api/v1/orders/{orderId}'],
      ['get', '/api/v1/returns'],
      ['get', '/api/v1/returns/{returnId}'],
      ['get', '/api/v1/conversations'],
      ['get', '/api/v1/conversations/{id}/messages'],
      ['get', '/api/v1/me/offers'],
    ])
      expectSecurity(document, method, path, access);
    for (const [method, path] of [
      ['delete', '/api/v1/cart'],
      ['post', '/api/v1/cart/items'],
      ['patch', '/api/v1/cart/items/{productId}'],
      ['delete', '/api/v1/cart/items/{productId}'],
      ['post', '/api/v1/cart/sync'],
      ['post', '/api/v1/coupons/validate'],
      ['post', '/api/v1/checkout/preview'],
      ['post', '/api/v1/checkout'],
      ['post', '/api/v1/payments/paypal/create'],
      ['post', '/api/v1/payments/paypal/capture'],
      ['post', '/api/v1/payments/cod/confirm'],
      ['post', '/api/v1/returns'],
      ['post', '/api/v1/conversations'],
      ['post', '/api/v1/conversations/{id}/messages'],
      ['post', '/api/v1/conversations/{id}/attachments'],
      ['patch', '/api/v1/conversations/{id}/read'],
      ['patch', '/api/v1/conversations/{id}/archive'],
      ['post', '/api/v1/conversations/{id}/offers'],
      ['post', '/api/v1/products/{productId}/offers'],
      ['delete', '/api/v1/me/offers/{offerId}'],
      ['post', '/api/v1/offers/{offerId}/accept'],
      ['post', '/api/v1/offers/{offerId}/decline'],
      ['post', '/api/v1/offers/{offerId}/counter'],
      ['post', '/api/v1/seller-feedbacks/{feedbackId}/follow-up'],
    ])
      expectSecurity(document, method, path, unsafe);
  });

  it('documents User 3 and User 4 contracts', async () => {
    const document = await getDocument();
    const checkout = operation(document, 'post', '/api/v1/checkout');
    expect(checkout.parameters).toContainEqual(
      expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
      }),
    );
    expect(
      operation(document, 'post', '/api/v1/checkout/preview').requestBody
        .content['application/json'].schema.$ref,
    ).toBe('#/components/schemas/CheckoutRequest');
    expect(
      document.components.schemas.CheckoutRequest.properties.offerId,
    ).toEqual(expect.objectContaining({ pattern: '^[a-fA-F0-9]{24}$' }));
    expect(
      document.components.schemas.CheckoutPreview.properties.offer,
    ).toEqual(
      expect.objectContaining({
        allOf: [{ $ref: '#/components/schemas/CheckoutOfferSummary' }],
        nullable: true,
      }),
    );
    expect(document.components.schemas.Order.properties.offerId).toEqual(
      expect.objectContaining({ pattern: '^[a-fA-F0-9]{24}$' }),
    );
    expect(document.components.schemas.OrderItem.properties).toEqual(
      expect.objectContaining({
        offerId: expect.objectContaining({ pattern: '^[a-fA-F0-9]{24}$' }),
        originalPrice: expect.objectContaining({ type: 'integer' }),
        finalPrice: expect.objectContaining({ type: 'integer' }),
        productReviewAvailable: expect.objectContaining({ type: 'boolean' }),
        canWriteProductReview: expect.objectContaining({ type: 'boolean' }),
        productReview: expect.objectContaining({ nullable: true }),
        catalogProduct: expect.objectContaining({ nullable: true }),
      }),
    );
    expect(
      document.components.schemas.ProductReviewSummary.properties.available,
    ).toEqual(expect.objectContaining({ type: 'boolean' }));
    expect(
      document.components.schemas.CreateOrderItemProductReviewRequest.required,
    ).toEqual(['rating', 'title', 'description']);
    expect(
      document.components.schemas.CreateOrderItemProductReviewRequest.properties
        .title,
    ).toEqual(expect.objectContaining({ minLength: 1, maxLength: 120 }));
    expect(
      document.components.schemas.CreateOrderItemProductReviewRequest.properties
        .description,
    ).toEqual(expect.objectContaining({ minLength: 1, maxLength: 2000 }));
    expect(document.components.schemas.ProductReview.properties).toEqual(
      expect.objectContaining({
        title: expect.objectContaining({ maxLength: 120 }),
        description: expect.objectContaining({ maxLength: 2000 }),
        verifiedPurchase: expect.objectContaining({ readOnly: true }),
        purchasedProduct: expect.objectContaining({ nullable: true }),
        soldBy: expect.objectContaining({ nullable: true }),
      }),
    );
    expect(
      document.components.schemas.ProductListItem.properties
        .productReviewAvailable,
    ).toEqual(expect.objectContaining({ type: 'boolean' }));
    const reviewParameters = operation(
      document,
      'get',
      '/api/v1/products/{productId}/reviews',
    ).parameters;
    expect(reviewParameters[0]).toEqual({
      $ref: '#/components/parameters/ProductId',
    });
    expect(reviewParameters.slice(1, 3)).toEqual([
      { $ref: '#/components/parameters/Page' },
      { $ref: '#/components/parameters/Limit' },
    ]);
    expect(
      reviewParameters.slice(3).map((parameter) => parameter.name),
    ).toEqual(['q', 'rating', 'sort']);
    expect(reviewParameters[5].schema.enum).toEqual([
      'newest',
      'oldest',
      'highest',
      'lowest',
      'rating_desc',
      'rating_asc',
    ]);
    expect(document.components.schemas.CartItem.properties.product.$ref).toBe(
      '#/components/schemas/CartProduct',
    );
    expect(
      document.components.schemas.CartSyncWarning.properties.code.enum,
    ).toEqual([
      'DUPLICATE_LOCAL_ITEM_NORMALIZED',
      'PRODUCT_UNAVAILABLE',
      'PRODUCT_OUT_OF_STOCK',
      'QUANTITY_ADJUSTED',
    ]);
    expect(
      document.components.schemas.CreateReturnRequest.properties.reason.enum,
    ).toEqual([
      'DAMAGED',
      'DEFECTIVE',
      'WRONG_ITEM',
      'NOT_AS_DESCRIBED',
      'MISSING_PARTS',
      'CHANGED_MIND',
      'OTHER',
    ]);
    expect(
      document.components.schemas.ReturnRequest.properties.status.enum,
    ).toEqual(['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED']);
    expect(document.components.schemas.Offer.properties.status.enum).toContain(
      'PURCHASED',
    );
    expect(document.components.schemas.Offer.properties).toEqual(
      expect.objectContaining({
        quantity: expect.objectContaining({ type: 'integer' }),
        orderId: expect.objectContaining({ nullable: true }),
        usedAt: expect.objectContaining({ nullable: true }),
      }),
    );
    expect(document.components.schemas.OfferUpdatedEvent.$ref).toBe(
      '#/components/schemas/Offer',
    );
    expect(
      document.components.schemas.ConversationUpdatedEvent.properties.orderId,
    ).toEqual(expect.objectContaining({ nullable: true }));
    expect(
      operation(document, 'post', '/api/v1/conversations/{id}/attachments')
        .requestBody.content['multipart/form-data'].schema.properties.files
        .items.format,
    ).toBe('binary');
    const orderParameters = operation(
      document,
      'get',
      '/api/v1/orders',
    ).parameters;
    expect(
      orderParameters.slice(0, 5).map((parameter) => parameter.name),
    ).toEqual(['status', 'sellerId', 'from', 'to', 'sort']);
    expect(orderParameters.slice(5)).toEqual([
      { $ref: '#/components/parameters/Page' },
      { $ref: '#/components/parameters/Limit' },
    ]);
  });

  it('documents the email verification OTP contract', async () => {
    const document = await getDocument();
    const schema = document.components.schemas.VerifyEmailRequest;
    expect(schema.required).toEqual(['email', 'otp']);
    expect(schema.properties.otp).toEqual(
      expect.objectContaining({ type: 'string', pattern: '^\\d{6}$' }),
    );
    expect(schema.properties.token).toBeUndefined();
  });

  it('does not serialize credentials or secret implementation fields', async () => {
    const document = await getDocument();
    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(/passwordHash|tokenHash/);
    expect(serialized).not.toContain('a'.repeat(32));
    expect(serialized).not.toContain('b'.repeat(32));
    expect(serialized).not.toContain('c'.repeat(32));
    expect(serialized).not.toMatch(/mongodb(?:\+srv)?:\/\/[^/\s"']+@/i);
    expect(serialized).not.toMatch(/(?:password|secret|token)=[^&\s"']+/i);
  });
});
