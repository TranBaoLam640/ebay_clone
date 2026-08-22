import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { USER4_NOTIFICATION_EVENTS } from '../../src/common/constants/user4-notification-events.js';

const prefix = '/api/v1';
const password = 'Strong1!Password';
let app;
let database;
let mongo;
let models;
let passwordHash;
let signAccess;
let replacementService;
let shipmentService;
let maintainInrResolutionGuard;
let ids;

const objectId = () => new mongoose.Types.ObjectId();
const csrf = async (agent) => {
  agent.csrfToken = (
    await agent.get(`${prefix}/auth/csrf-token`).expect(200)
  ).body.data.csrfToken;
};
const mutate = (agent, method, path, body, key) => {
  let operation = agent[method](`${prefix}${path}`).set(
    'x-csrf-token',
    agent.csrfToken,
  );
  if (key) operation = operation.set('Idempotency-Key', key);
  return body === undefined ? operation : operation.send(body);
};
const login = async (email = 'buyer@example.test') => {
  const agent = request.agent(app);
  await csrf(agent);
  const user = await models.User.findOne({ email }).lean();
  agent.set(
    'Cookie',
    `accessToken=${signAccess({ id: String(user._id), role: user.role })}`,
  );
  return agent;
};

const seed = async () => {
  ids = {
    buyer: objectId(),
    otherBuyer: objectId(),
    sellerUser: objectId(),
    sellerUser2: objectId(),
    shipper: objectId(),
    seller: objectId(),
    seller2: objectId(),
    category: objectId(),
    product: objectId(),
    product2: objectId(),
    order: objectId(),
    orderItem: objectId(),
    orderItem2: objectId(),
    otherOrder: objectId(),
    shipment: objectId(),
    checkoutGroup: objectId(),
    payment: objectId(),
  };
  await models.User.create([
    {
      _id: ids.buyer,
      email: 'buyer@example.test',
      passwordHash,
      fullName: 'Buyer',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.otherBuyer,
      email: 'other@example.test',
      passwordHash,
      fullName: 'Other Buyer',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.sellerUser,
      email: 'seller@example.test',
      passwordHash,
      fullName: 'Seller',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.sellerUser2,
      email: 'seller2@example.test',
      passwordHash,
      fullName: 'Seller 2',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.shipper,
      email: 'shipper@example.test',
      passwordHash,
      fullName: 'Shipper',
      role: 'SHIPPER',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
  ]);
  await models.Category.create({
    _id: ids.category,
    name: 'Catalog',
    slug: 'catalog',
    status: 'ACTIVE',
  });
  await models.SellerProfile.create([
    {
      _id: ids.seller,
      userId: ids.sellerUser,
      displayName: 'Alpha Seller',
      status: 'ACTIVE',
    },
    {
      _id: ids.seller2,
      userId: ids.sellerUser2,
      displayName: 'Beta Seller',
      status: 'ACTIVE',
    },
  ]);
  await models.Product.create([
    {
      _id: ids.product,
      uuid: '11111111-1111-4111-a111-111111111111',
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Camera',
      description: 'Camera',
      price: 1000,
      stock: 5,
      status: 'ACTIVE',
    },
    {
      _id: ids.product2,
      uuid: '22222222-2222-4222-a222-222222222222',
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Lens',
      description: 'Lens',
      price: 500,
      stock: 5,
      status: 'ACTIVE',
    },
  ]);
  await models.Carrier.create([
    { code: 'SBAY_EXPRESS', name: 'SBay Express', active: true },
    { code: 'DHL', name: 'DHL', active: true },
    { code: 'OLD', name: 'Old Carrier', active: false },
  ]);
  await models.Order.create([
    {
      _id: ids.order,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      checkoutGroupId: ids.checkoutGroup,
      orderStatus: 'CONFIRMED',
      paymentMethod: 'PAYPAL',
      subtotal: 5000,
      discount: 0,
      shippingFee: 0,
      total: 5000,
      currency: 'VND',
      items: [
        {
          _id: ids.orderItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 5,
          title: 'Camera',
          image: 'https://example.test/camera.jpg',
          unitPrice: 1000,
          itemSubtotal: 5000,
        },
        {
          _id: ids.orderItem2,
          productId: ids.product2,
          sellerId: ids.seller,
          quantity: 1,
          title: 'Lens',
          unitPrice: 500,
          itemSubtotal: 500,
        },
      ],
    },
    {
      _id: ids.otherOrder,
      buyerId: ids.otherBuyer,
      sellerId: ids.seller,
      orderStatus: 'CONFIRMED',
      currency: 'VND',
      items: [
        {
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
          unitPrice: 1000,
          itemSubtotal: 1000,
        },
      ],
    },
  ]);
  await models.CheckoutGroup.create({
    _id: ids.checkoutGroup,
    buyerId: ids.buyer,
    orderIds: [ids.order],
    paymentId: ids.payment,
    paymentMethod: 'PAYPAL',
    status: 'CONFIRMED',
    subtotal: 5000,
    discount: 0,
    shippingFee: 0,
    total: 5000,
    currency: 'VND',
  });
  await models.Payment.create({
    _id: ids.payment,
    buyerId: ids.buyer,
    checkoutGroupId: ids.checkoutGroup,
    method: 'PAYPAL',
    status: 'CAPTURED',
    amount: 5000,
    currency: 'VND',
    providerOrderId: `SIM-${ids.checkoutGroup}`,
    capturedAt: new Date(),
  });
  await models.Shipment.create({
    _id: ids.shipment,
    orderId: ids.order,
    buyerId: ids.buyer,
    sellerId: ids.seller,
    carrier: 'SBay Express',
    trackingNumber: 'SBAY-ORIGINAL',
    status: 'READY_FOR_PICKUP',
    estimatedDeliveryAt: new Date(Date.now() - 86_400_000),
  });
};

const createBody = (overrides = {}) => ({
  orderId: String(ids.order),
  orderItemId: String(ids.orderItem),
  quantityMissing: 1,
  requestedResolution: 'REFUND',
  details: 'Package did not arrive',
  ...overrides,
});

const createOpenInr = async (overrides = {}) => {
  const buyer = await login();
  const response = await mutate(
    buyer,
    'post',
    '/inr-requests',
    createBody(overrides),
  ).expect(201);
  return response.body.data;
};

const refundPath = (requestId) => `/inr-requests/${requestId}/refund`;

const refundNotificationCount = () =>
  models.Notification.countDocuments({
    userId: ids.buyer,
    eventType: USER4_NOTIFICATION_EVENTS.INR_REFUNDED,
  });

const replacementInput = (requestId) => ({
  inrRequestId: requestId,
  orderId: String(ids.order),
  orderItemId: String(ids.orderItem),
});

const proposeReplacement = (userId, requestId) =>
  replacementService.propose(userId, replacementInput(requestId));

const acceptReplacement = (userId, replacementId) =>
  replacementService.accept(userId, replacementId);

const prepareReplacementShipment = (replacementId) =>
  replacementService.prepareShipment(ids.sellerUser, replacementId);

const replacementShipment = (replacementId) =>
  models.Shipment.findOne({
    replacementId,
    purpose: 'REPLACEMENT',
  }).lean();

const stock = async () =>
  (await models.Product.findById(ids.product).select('stock').lean()).stock;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  const modules = await Promise.all([
    import('../../src/modules/users/user.model.js'),
    import('../../src/modules/categories/category.model.js'),
    import('../../src/modules/sellers/seller-profile.model.js'),
    import('../../src/modules/products/product.model.js'),
    import('../../src/modules/orders/order.model.js'),
    import('../../src/modules/shipments/shipment.model.js'),
    import('../../src/modules/carriers/carrier.model.js'),
    import('../../src/modules/inr-requests/inr-request.model.js'),
    import('../../src/modules/conversations/conversation.model.js'),
    import('../../src/modules/notifications/notification.model.js'),
    import('../../src/modules/checkout-groups/checkout-group.model.js'),
    import('../../src/modules/payments/payment.model.js'),
    import('../../src/modules/payments/refunds/refund.model.js'),
    import('../../src/modules/idempotency/idempotency-record.model.js'),
    import('../../src/modules/replacements/replacement.model.js'),
    import('../../src/modules/replacements/replacement.service.js'),
    import('../../src/modules/shipments/shipment.service.js'),
    import('../../src/modules/inr-requests/inr-resolution-guard.js'),
    import('../../src/common/utils/hash.js'),
    import('../../src/common/utils/token.js'),
  ]);
  models = {
    User: modules[0].User,
    Category: modules[1].Category,
    SellerProfile: modules[2].SellerProfile,
    Product: modules[3].Product,
    Order: modules[4].Order,
    Shipment: modules[5].Shipment,
    Carrier: modules[6].Carrier,
    INRRequest: modules[7].INRRequest,
    Conversation: modules[8].Conversation,
    Notification: modules[9].Notification,
    CheckoutGroup: modules[10].CheckoutGroup,
    Payment: modules[11].Payment,
    Refund: modules[12].Refund,
    IdempotencyRecord: modules[13].IdempotencyRecord,
    Replacement: modules[14].Replacement,
  };
  replacementService = modules[15];
  shipmentService = modules[16];
  maintainInrResolutionGuard = modules[17].maintainInrResolutionGuard;
  passwordHash = await modules[18].hashPassword(password);
  signAccess = modules[19].signAccess;
  await Promise.all(Object.values(models).map((model) => model.init()));
  ({ app } = await import('../../src/app.js'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  await seed();
});

afterAll(async () => {
  if (database) await database.disconnectDatabase();
  if (mongo) await mongo.stop();
});

describe('INR requests', () => {
  it('lists active carriers', async () => {
    const agent = await login();
    const response = await agent.get(`${prefix}/carriers`).expect(200);
    expect(response.body.data.map((carrier) => carrier.code).sort()).toEqual([
      'DHL',
      'SBAY_EXPRESS',
    ]);
  });

  it.each(['READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'])(
    'allows creation after ETA when shipment is %s',
    async (status) => {
      await models.Shipment.updateOne({ _id: ids.shipment }, { status });
      const agent = await login();
      const response = await mutate(
        agent,
        'post',
        '/inr-requests',
        createBody({ quantityMissing: 2, requestedResolution: 'WANT_ITEM' }),
      ).expect(201);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          status: 'OPEN',
          quantityMissing: 2,
          requestAmount: 2000,
          requestedResolution: 'WANT_ITEM',
        }),
      );
      expect(response.body.data.shipment).not.toHaveProperty('carrier');
      const notification = await models.Notification.findOne({
        userId: ids.sellerUser,
        eventType: USER4_NOTIFICATION_EVENTS.INR_REQUESTED,
      }).lean();
      expect(notification).toEqual(
        expect.objectContaining({
          type: 'DISPUTE',
          referenceType: 'INRRequest',
          eventKey: `${USER4_NOTIFICATION_EVENTS.INR_REQUESTED}:${response.body.data.id}:SELLER`,
        }),
      );
      const requestDoc = await models.INRRequest.findById(
        response.body.data.id,
      ).lean();
      expect(requestDoc.conversationId).toBeTruthy();
    },
  );

  it('rejects before ETA, expired window, missing shipment, wrong item, wrong buyer, and bad quantity', async () => {
    const agent = await login();
    await models.Shipment.updateOne(
      { _id: ids.shipment },
      { estimatedDeliveryAt: new Date(Date.now() + 86_400_000) },
    );
    await mutate(agent, 'post', '/inr-requests', createBody()).expect(409);
    await models.Shipment.updateOne(
      { _id: ids.shipment },
      { estimatedDeliveryAt: new Date(Date.now() - 31 * 86_400_000) },
    );
    await mutate(agent, 'post', '/inr-requests', createBody()).expect(409);
    await models.Shipment.deleteOne({ _id: ids.shipment });
    await mutate(agent, 'post', '/inr-requests', createBody()).expect(409);
    await models.Shipment.create({
      _id: ids.shipment,
      orderId: ids.order,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      carrier: 'SBay Express',
      trackingNumber: 'SBAY-NEW',
      status: 'IN_TRANSIT',
      estimatedDeliveryAt: new Date(Date.now() - 86_400_000),
    });
    await mutate(
      agent,
      'post',
      '/inr-requests',
      createBody({ orderItemId: String(objectId()) }),
    ).expect(404);
    await mutate(
      agent,
      'post',
      '/inr-requests',
      createBody({ quantityMissing: 6 }),
    ).expect(409);
    const other = await login('other@example.test');
    await mutate(other, 'post', '/inr-requests', createBody()).expect(404);
  });

  it('enforces one open request per order item but permits a later request after close', async () => {
    const agent = await login();
    const first = await mutate(
      agent,
      'post',
      '/inr-requests',
      createBody(),
    ).expect(201);
    await mutate(agent, 'post', '/inr-requests', createBody()).expect(409);
    await mutate(
      agent,
      'patch',
      `/inr-requests/${first.body.data.id}/close`,
      {},
    ).expect(200);
    await mutate(agent, 'post', '/inr-requests', createBody()).expect(201);
    expect(
      await models.INRRequest.countDocuments({
        orderId: ids.order,
        orderItemId: ids.orderItem,
        status: 'OPEN',
      }),
    ).toBe(1);
  });

  it('keeps concurrent duplicate creates to one open request', async () => {
    const agent = await login();
    const [a, b] = await Promise.all([
      mutate(agent, 'post', '/inr-requests', createBody()),
      mutate(agent, 'post', '/inr-requests', createBody()),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await models.INRRequest.countDocuments({ status: 'OPEN' })).toBe(1);
  });

  it('supports seller queue/detail and tracking evidence history without mutating Shipment', async () => {
    const buyer = await login();
    const seller = await login('seller@example.test');
    const otherSeller = await login('seller2@example.test');
    const created = await mutate(
      buyer,
      'post',
      '/inr-requests',
      createBody(),
    ).expect(201);
    const requestId = created.body.data.id;
    await otherSeller.get(`${prefix}/inr-requests/seller`).expect(200);
    const queue = await seller.get(`${prefix}/inr-requests/seller`).expect(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0].buyer.displayName).toBe('Buyer');
    const dhl = await models.Carrier.findOne({ code: 'DHL' }).lean();
    const old = await models.Carrier.findOne({ code: 'OLD' }).lean();
    await mutate(
      seller,
      'patch',
      `/inr-requests/${requestId}/tracking-evidence`,
      {
        carrierId: String(old._id),
        trackingId: 'OLD-1',
      },
    ).expect(409);
    await mutate(
      otherSeller,
      'patch',
      `/inr-requests/${requestId}/tracking-evidence`,
      { carrierId: String(dhl._id), trackingId: 'DHL-1' },
    ).expect(404);
    await mutate(
      seller,
      'patch',
      `/inr-requests/${requestId}/tracking-evidence`,
      {
        carrierId: String(dhl._id),
        trackingId: 'DHL-1',
      },
    ).expect(200);
    const updated = await mutate(
      seller,
      'patch',
      `/inr-requests/${requestId}/tracking-evidence`,
      { carrierId: String(dhl._id), trackingId: 'DHL-2' },
    ).expect(200);
    expect(updated.body.data.trackingEvidenceHistory).toHaveLength(2);
    expect(updated.body.data.latestTrackingEvidence.trackingId).toBe('DHL-2');
    expect(await models.Shipment.findById(ids.shipment).lean()).toEqual(
      expect.objectContaining({
        carrier: 'SBay Express',
        trackingNumber: 'SBAY-ORIGINAL',
      }),
    );
    await mutate(buyer, 'patch', `/inr-requests/${requestId}/close`, {}).expect(
      200,
    );
    await mutate(
      seller,
      'patch',
      `/inr-requests/${requestId}/tracking-evidence`,
      { carrierId: String(dhl._id), trackingId: 'DHL-3' },
    ).expect(409);
  });

  it('previews seller refund with server-derived amount and rejects non-owners or closed requests', async () => {
    const buyer = await login();
    const seller = await login('seller@example.test');
    const otherSeller = await login('seller2@example.test');
    const shipper = await login('shipper@example.test');
    const created = await mutate(
      buyer,
      'post',
      '/inr-requests',
      createBody({ quantityMissing: 2 }),
    ).expect(201);
    const requestId = created.body.data.id;
    const preview = await seller
      .get(`${prefix}/inr-requests/${requestId}/refund-preview`)
      .expect(200);
    expect(preview.body.data).toEqual(
      expect.objectContaining({
        requestId,
        orderId: String(ids.order),
        refundAmount: 2000,
        currency: 'VND',
        paymentMethod: 'PAYPAL',
        refundable: true,
        summary: {
          purchasePrice: 2000,
          shipping: 0,
          feeCredits: 0,
          amountYouOwe: 2000,
        },
      }),
    );
    await otherSeller
      .get(`${prefix}/inr-requests/${requestId}/refund-preview`)
      .expect(404);
    await buyer
      .get(`${prefix}/inr-requests/${requestId}/refund-preview`)
      .expect(404);
    await shipper
      .get(`${prefix}/inr-requests/${requestId}/refund-preview`)
      .expect(404);
    await mutate(buyer, 'patch', `/inr-requests/${requestId}/close`, {}).expect(
      200,
    );
    await seller
      .get(`${prefix}/inr-requests/${requestId}/refund-preview`)
      .expect(409);
  });

  it('completes a PayPal seller refund exactly once and closes the INR after success', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    const buyer = await login();
    const seller = await login('seller@example.test');
    const created = await mutate(
      buyer,
      'post',
      '/inr-requests',
      createBody(),
    ).expect(201);
    const requestId = created.body.data.id;
    await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      { amount: 1, paymentId: String(objectId()) },
      'tamper',
    ).expect(400);
    await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      {},
    ).expect(400);
    const refunded = await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      {},
      'refund-once',
    ).expect(200);
    expect(refunded.body.data).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        closeReason: 'SELLER_REFUNDED',
        refundId: expect.any(String),
        refund: expect.objectContaining({
          amount: 1000,
          currency: 'VND',
          status: 'COMPLETED',
          method: 'PAYPAL',
        }),
      }),
    );
    const refund = await models.Refund.findOne({
      sourceType: 'INR',
      sourceId: requestId,
    }).lean();
    expect(refund).toEqual(
      expect.objectContaining({
        paymentId: ids.payment,
        checkoutGroupId: ids.checkoutGroup,
        buyerId: ids.buyer,
        sellerId: ids.seller,
        amount: 1000,
        status: 'COMPLETED',
        providerRefundId: `SIM-REFUND-${refund._id}`,
      }),
    );
    const requestDoc = await models.INRRequest.findById(requestId).lean();
    expect(requestDoc).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        closeReason: 'SELLER_REFUNDED',
        refundId: refund._id,
        resolutionMode: 'REFUND',
      }),
    );
    expect(
      await models.Notification.countDocuments({
        userId: ids.buyer,
        eventType: USER4_NOTIFICATION_EVENTS.INR_REFUNDED,
      }),
    ).toBe(1);
    const replay = await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      {},
      'refund-once',
    ).expect(200);
    expect(replay.body.data.refund.id).toBe(String(refund._id));
    expect(await models.Refund.countDocuments({ sourceId: requestId })).toBe(1);
    expect(refundSpy).toHaveBeenCalledOnce();
    expect(
      await models.Notification.countDocuments({
        eventType: USER4_NOTIFICATION_EVENTS.INR_REFUNDED,
      }),
    ).toBe(1);
    await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      {},
      'different-key',
    ).expect(409);
    expect(await models.Refund.countDocuments({ sourceId: requestId })).toBe(1);
  });

  it('keeps INR open and records failure when the PayPal refund provider fails', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder').mockResolvedValueOnce({
      providerOrderId: `SIM-${ids.checkoutGroup}`,
      status: 'FAILED',
      reason: 'DECLINED',
    });
    const buyer = await login();
    const seller = await login('seller@example.test');
    const created = await mutate(
      buyer,
      'post',
      '/inr-requests',
      createBody(),
    ).expect(201);
    const requestId = created.body.data.id;
    await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      {},
      'refund-fails',
    ).expect(502);
    const requestDoc = await models.INRRequest.findById(requestId).lean();
    expect(requestDoc.status).toBe('OPEN');
    expect(requestDoc.resolutionMode).toBe('REFUND');
    expect(requestDoc.refundId).toBeUndefined();
    expect(await models.Refund.findOne({ sourceId: requestId }).lean()).toEqual(
      expect.objectContaining({ status: 'FAILED', failureReason: 'DECLINED' }),
    );
    expect(
      await models.Notification.countDocuments({
        eventType: USER4_NOTIFICATION_EVENTS.INR_REFUNDED,
      }),
    ).toBe(0);
    const failedRefund = await models.Refund.findOne({
      sourceId: requestId,
    }).lean();
    const retry = await mutate(
      seller,
      'post',
      `/inr-requests/${requestId}/refund`,
      {},
      'refund-retry',
    ).expect(200);
    expect(retry.body.data).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        closeReason: 'SELLER_REFUNDED',
        refundId: String(failedRefund._id),
        refund: expect.objectContaining({
          id: String(failedRefund._id),
          status: 'COMPLETED',
        }),
      }),
    );
    const completedRefund = await models.Refund.findOne({
      sourceId: requestId,
    }).lean();
    expect(completedRefund._id).toEqual(failedRefund._id);
    expect(completedRefund).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        providerRefundId: `SIM-REFUND-${failedRefund._id}`,
      }),
    );
    expect(refundSpy).toHaveBeenCalledTimes(2);
    expect(await models.Refund.countDocuments({ sourceId: requestId })).toBe(1);
    expect(await refundNotificationCount()).toBe(1);
  });

  it('backfills missing INR resolution modes and detects legacy conflicts', async () => {
    const activeReplacementRequest = await createOpenInr({
      requestedResolution: 'WANT_ITEM',
    });
    await proposeReplacement(ids.buyer, activeReplacementRequest.id);
    await models.INRRequest.updateOne(
      { _id: activeReplacementRequest.id },
      { $unset: { resolutionMode: 1, resolutionModeUpdatedAt: 1 } },
    );

    await models.INRRequest.updateOne(
      { _id: activeReplacementRequest.id },
      { status: 'CLOSED', closedAt: new Date(), closeReason: 'ITEM_ARRIVED' },
    );
    const refundRequest = await createOpenInr();
    await models.INRRequest.updateOne(
      { _id: refundRequest.id },
      { $unset: { resolutionMode: 1, resolutionModeUpdatedAt: 1 } },
    );
    await models.Refund.create({
      paymentId: ids.payment,
      checkoutGroupId: ids.checkoutGroup,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      sourceType: 'INR',
      sourceId: refundRequest.id,
      amount: 1000,
      currency: 'VND',
      method: 'PAYPAL',
      status: 'PROCESSING',
    });

    await models.INRRequest.updateOne(
      { _id: refundRequest.id },
      { status: 'CLOSED', closedAt: new Date(), closeReason: 'ITEM_ARRIVED' },
    );
    const noneRequest = await createOpenInr();
    await models.INRRequest.updateOne(
      { _id: noneRequest.id },
      { $unset: { resolutionMode: 1, resolutionModeUpdatedAt: 1 } },
    );

    const first = await maintainInrResolutionGuard();
    const second = await maintainInrResolutionGuard();

    expect(first.backfilled).toBe(3);
    expect(first.conflicts).toEqual([]);
    expect(second.backfilled).toBe(0);
    expect(
      await models.INRRequest.findById(activeReplacementRequest.id).lean(),
    ).toEqual(expect.objectContaining({ resolutionMode: 'REPLACEMENT' }));
    expect(await models.INRRequest.findById(refundRequest.id).lean()).toEqual(
      expect.objectContaining({ resolutionMode: 'REFUND' }),
    );
    expect(await models.INRRequest.findById(noneRequest.id).lean()).toEqual(
      expect.objectContaining({ resolutionMode: 'NONE' }),
    );

    await models.INRRequest.updateOne(
      { _id: activeReplacementRequest.id },
      { $unset: { resolutionMode: 1, resolutionModeUpdatedAt: 1 } },
    );
    await models.Refund.create({
      paymentId: ids.payment,
      checkoutGroupId: ids.checkoutGroup,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      sourceType: 'INR',
      sourceId: activeReplacementRequest.id,
      amount: 1000,
      currency: 'VND',
      method: 'PAYPAL',
      status: 'PROCESSING',
    });
    await expect(maintainInrResolutionGuard()).rejects.toThrow(
      /conflicting active replacement and refund/,
    );
  });

  it('lets the buyer request refund instead from proposed replacement states without creating a Refund', async () => {
    const buyer = await login();
    const sellerProposedRequest = await createOpenInr({
      requestedResolution: 'WANT_ITEM',
    });
    const sellerProposal = await proposeReplacement(
      ids.sellerUser,
      sellerProposedRequest.id,
    );

    await mutate(
      buyer,
      'patch',
      `/inr-requests/${sellerProposedRequest.id}/refund-instead`,
      {},
    ).expect(200);
    expect(await models.Replacement.findById(sellerProposal.id).lean()).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        inventoryClaimStatus: 'UNCLAIMED',
      }),
    );
    expect(
      await models.INRRequest.findById(sellerProposedRequest.id).lean(),
    ).toEqual(
      expect.objectContaining({
        requestedResolution: 'REFUND',
        resolutionMode: 'REFUND',
      }),
    );
    expect(
      await models.Refund.countDocuments({
        sourceId: sellerProposedRequest.id,
      }),
    ).toBe(0);

    await models.INRRequest.updateOne(
      { _id: sellerProposedRequest.id },
      { status: 'CLOSED', closedAt: new Date(), closeReason: 'ITEM_ARRIVED' },
    );
    const buyerProposedRequest = await createOpenInr({
      requestedResolution: 'WANT_ITEM',
    });
    const buyerProposal = await proposeReplacement(
      ids.buyer,
      buyerProposedRequest.id,
    );
    await mutate(
      buyer,
      'patch',
      `/inr-requests/${buyerProposedRequest.id}/refund-instead`,
      {},
    ).expect(200);
    expect(await models.Replacement.findById(buyerProposal.id).lean()).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        inventoryClaimStatus: 'UNCLAIMED',
      }),
    );
    expect(
      await models.INRRequest.findById(buyerProposedRequest.id).lean(),
    ).toEqual(
      expect.objectContaining({
        requestedResolution: 'REFUND',
        resolutionMode: 'REFUND',
      }),
    );
  });

  it('lets the buyer request refund instead before replacement pickup and blocks after transit', async () => {
    const buyer = await login();
    const noShipmentRequest = await createOpenInr({
      requestedResolution: 'WANT_ITEM',
    });
    const acceptedNoShipment = await proposeReplacement(
      ids.buyer,
      noShipmentRequest.id,
    ).then((proposal) => acceptReplacement(ids.sellerUser, proposal.id));
    expect(await stock()).toBe(4);
    await mutate(
      buyer,
      'patch',
      `/inr-requests/${noShipmentRequest.id}/refund-instead`,
      {},
    ).expect(200);
    expect(await stock()).toBe(5);
    expect(
      await models.Replacement.findById(acceptedNoShipment.id).lean(),
    ).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        inventoryClaimStatus: 'RELEASED',
      }),
    );

    await models.INRRequest.updateOne(
      { _id: noShipmentRequest.id },
      { status: 'CLOSED', closedAt: new Date(), closeReason: 'ITEM_ARRIVED' },
    );
    const readyRequest = await createOpenInr({
      requestedResolution: 'WANT_ITEM',
    });
    const acceptedReady = await proposeReplacement(
      ids.buyer,
      readyRequest.id,
    ).then((proposal) => acceptReplacement(ids.sellerUser, proposal.id));
    await prepareReplacementShipment(acceptedReady.id);
    await mutate(
      buyer,
      'patch',
      `/inr-requests/${readyRequest.id}/refund-instead`,
      {},
    ).expect(200);
    expect((await replacementShipment(acceptedReady.id)).status).toBe(
      'CANCELLED',
    );
    expect(await stock()).toBe(5);

    await models.INRRequest.updateOne(
      { _id: readyRequest.id },
      { status: 'CLOSED', closedAt: new Date(), closeReason: 'ITEM_ARRIVED' },
    );
    const transitRequest = await createOpenInr({
      requestedResolution: 'WANT_ITEM',
    });
    const acceptedTransit = await proposeReplacement(
      ids.buyer,
      transitRequest.id,
    ).then((proposal) => acceptReplacement(ids.sellerUser, proposal.id));
    await prepareReplacementShipment(acceptedTransit.id);
    const shipment = await replacementShipment(acceptedTransit.id);
    await shipmentService.pickup(ids.shipper, shipment._id);
    await mutate(
      buyer,
      'patch',
      `/inr-requests/${transitRequest.id}/refund-instead`,
      {},
    ).expect(409);
    expect(
      await models.Replacement.findById(acceptedTransit.id).lean(),
    ).toEqual(
      expect.objectContaining({
        status: 'FULFILLING',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect(await models.INRRequest.findById(transitRequest.id).lean()).toEqual(
      expect.objectContaining({
        requestedResolution: 'WANT_ITEM',
        resolutionMode: 'REPLACEMENT',
      }),
    );
    expect(await stock()).toBe(4);
  });

  it('seller refund terminalizes pre-transit replacements before provider execution', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    const seller = await login('seller@example.test');
    const request = await createOpenInr({ requestedResolution: 'WANT_ITEM' });
    const accepted = await proposeReplacement(ids.buyer, request.id).then(
      (proposal) => acceptReplacement(ids.sellerUser, proposal.id),
    );
    await prepareReplacementShipment(accepted.id);

    await mutate(
      seller,
      'post',
      refundPath(request.id),
      {},
      'refund-over-replacement',
    ).expect(200);

    expect(refundSpy).toHaveBeenCalledOnce();
    expect(await models.Replacement.findById(accepted.id).lean()).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        inventoryClaimStatus: 'RELEASED',
      }),
    );
    expect((await replacementShipment(accepted.id)).status).toBe('CANCELLED');
    expect(await stock()).toBe(5);
    expect(await models.INRRequest.findById(request.id).lean()).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        closeReason: 'SELLER_REFUNDED',
        resolutionMode: 'REFUND',
      }),
    );
  });

  it('blocks normal seller refund after replacement is in transit or delivered', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    const seller = await login('seller@example.test');
    const request = await createOpenInr({ requestedResolution: 'WANT_ITEM' });
    const accepted = await proposeReplacement(ids.buyer, request.id).then(
      (proposal) => acceptReplacement(ids.sellerUser, proposal.id),
    );
    await prepareReplacementShipment(accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.shipper, shipment._id);

    await mutate(
      seller,
      'post',
      refundPath(request.id),
      {},
      'refund-after-pickup',
    ).expect(409);
    expect(refundSpy).not.toHaveBeenCalled();
    expect(await models.Refund.countDocuments({ sourceId: request.id })).toBe(
      0,
    );
    expect(await models.INRRequest.findById(request.id).lean()).toEqual(
      expect.objectContaining({ resolutionMode: 'REPLACEMENT' }),
    );

    await shipmentService.deliver(ids.shipper, shipment._id);
    await mutate(
      seller,
      'post',
      refundPath(request.id),
      {},
      'refund-after-delivery',
    ).expect(409);
    expect(refundSpy).not.toHaveBeenCalled();
    expect(await stock()).toBe(4);
  });

  it('serializes replacement proposal vs seller refund without mixed resolution', async () => {
    const seller = await login('seller@example.test');
    const request = await createOpenInr({ requestedResolution: 'WANT_ITEM' });

    const [proposalResult, refundResponse] = await Promise.all([
      proposeReplacement(ids.buyer, request.id).then(
        (value) => ({ status: 'fulfilled', value }),
        (error) => ({ status: 'rejected', error }),
      ),
      mutate(seller, 'post', refundPath(request.id), {}, 'proposal-vs-refund'),
    ]);

    const storedRequest = await models.INRRequest.findById(request.id).lean();
    const activeReplacement = await models.Replacement.findOne({
      inrRequestId: request.id,
      status: { $in: ['PROPOSED', 'ACCEPTED', 'FULFILLING'] },
    }).lean();

    if (storedRequest.resolutionMode === 'REFUND') {
      expect(refundResponse.status).toBe(200);
      expect(activeReplacement).toBeNull();
    } else {
      expect(storedRequest.resolutionMode).toBe('REPLACEMENT');
      expect(proposalResult.status).toBe('fulfilled');
      expect(refundResponse.status).toBe(409);
      expect(activeReplacement).toBeTruthy();
    }
  });

  it('serializes buyer refund-instead vs replacement pickup into one valid branch', async () => {
    const buyer = await login();
    const request = await createOpenInr({ requestedResolution: 'WANT_ITEM' });
    const accepted = await proposeReplacement(ids.buyer, request.id).then(
      (proposal) => acceptReplacement(ids.sellerUser, proposal.id),
    );
    await prepareReplacementShipment(accepted.id);
    const shipment = await replacementShipment(accepted.id);

    const [switchResponse] = await Promise.all([
      mutate(buyer, 'patch', `/inr-requests/${request.id}/refund-instead`, {}),
      shipmentService.pickup(ids.shipper, shipment._id).catch((error) => error),
    ]);

    const storedRequest = await models.INRRequest.findById(request.id).lean();
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();
    const storedShipment = await models.Shipment.findById(shipment._id).lean();

    if (storedRequest.resolutionMode === 'REFUND') {
      expect(switchResponse.status).toBe(200);
      expect(storedReplacement.status).toBe('CANCELLED');
      expect(storedReplacement.inventoryClaimStatus).toBe('RELEASED');
      expect(storedShipment.status).toBe('CANCELLED');
      expect(await stock()).toBe(5);
    } else {
      expect(switchResponse.status).toBe(409);
      expect(storedRequest.resolutionMode).toBe('REPLACEMENT');
      expect(storedReplacement.status).toBe('FULFILLING');
      expect(storedReplacement.inventoryClaimStatus).toBe('CONSUMED');
      expect(storedShipment.status).toBe('IN_TRANSIT');
      expect(await stock()).toBe(4);
    }
  });

  it('serializes seller refund vs replacement pickup into refund or fulfillment branch', async () => {
    const seller = await login('seller@example.test');
    const request = await createOpenInr({ requestedResolution: 'WANT_ITEM' });
    const accepted = await proposeReplacement(ids.buyer, request.id).then(
      (proposal) => acceptReplacement(ids.sellerUser, proposal.id),
    );
    await prepareReplacementShipment(accepted.id);
    const shipment = await replacementShipment(accepted.id);

    const [refundResponse] = await Promise.all([
      mutate(seller, 'post', refundPath(request.id), {}, 'refund-vs-pickup'),
      shipmentService.pickup(ids.shipper, shipment._id).catch((error) => error),
    ]);

    const storedRequest = await models.INRRequest.findById(request.id).lean();
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();
    const storedShipment = await models.Shipment.findById(shipment._id).lean();

    if (storedRequest.resolutionMode === 'REFUND') {
      expect(refundResponse.status).toBe(200);
      expect(storedReplacement.status).toBe('CANCELLED');
      expect(storedReplacement.inventoryClaimStatus).toBe('RELEASED');
      expect(storedShipment.status).toBe('CANCELLED');
      expect(await stock()).toBe(5);
    } else {
      expect(refundResponse.status).toBe(409);
      expect(storedRequest.resolutionMode).toBe('REPLACEMENT');
      expect(storedReplacement.status).toBe('FULFILLING');
      expect(storedReplacement.inventoryClaimStatus).toBe('CONSUMED');
      expect(storedShipment.status).toBe('IN_TRANSIT');
      expect(await stock()).toBe(4);
    }
  });

  it('records COD refunds explicitly and closes the INR with the same canonical refund flow', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    await models.Order.updateOne({ _id: ids.order }, { paymentMethod: 'COD' });
    await models.CheckoutGroup.updateOne(
      { _id: ids.checkoutGroup },
      { paymentMethod: 'COD' },
    );
    await models.Payment.updateOne(
      { _id: ids.payment },
      {
        method: 'COD',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        $unset: { providerOrderId: 1, capturedAt: 1 },
      },
    );
    const buyer = await login();
    const seller = await login('seller@example.test');
    const created = await mutate(
      buyer,
      'post',
      '/inr-requests',
      createBody(),
    ).expect(201);
    const refunded = await mutate(
      seller,
      'post',
      `/inr-requests/${created.body.data.id}/refund`,
      {},
      'cod-refund',
    ).expect(200);
    expect(refunded.body.data.refund).toEqual(
      expect.objectContaining({ method: 'COD', status: 'COMPLETED' }),
    );
    const refund = await models.Refund.findOne({
      sourceId: created.body.data.id,
    }).lean();
    expect(refund.providerRefundId).toBe(`COD-${refund._id}`);
    expect(refundSpy).not.toHaveBeenCalled();
    expect(await refundNotificationCount()).toBe(1);
  });

  it('prevents rapid concurrent refund submissions from moving money twice', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    const request = await createOpenInr();
    const seller = await login('seller@example.test');
    const responses = await Promise.all([
      mutate(seller, 'post', refundPath(request.id), {}, 'concurrent-a'),
      mutate(seller, 'post', refundPath(request.id), {}, 'concurrent-b'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(refundSpy).toHaveBeenCalledOnce();
    expect(
      await models.Refund.countDocuments({
        sourceId: request.id,
        status: 'COMPLETED',
      }),
    ).toBe(1);
    expect(
      await models.INRRequest.countDocuments({
        _id: request.id,
        status: 'CLOSED',
        closeReason: 'SELLER_REFUNDED',
      }),
    ).toBe(1);
    expect(await refundNotificationCount()).toBe(1);
  });

  it('rejects refunds that would exceed the canonical payment amount before provider processing', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    await models.Refund.create({
      paymentId: ids.payment,
      checkoutGroupId: ids.checkoutGroup,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      sourceType: 'INR',
      sourceId: objectId(),
      amount: 4500,
      currency: 'VND',
      method: 'PAYPAL',
      status: 'COMPLETED',
      providerRefundId: 'SIM-REFUND-EXISTING',
      completedAt: new Date(),
    });
    const request = await createOpenInr();
    const seller = await login('seller@example.test');
    await mutate(seller, 'post', refundPath(request.id), {}, 'over-cap').expect(
      409,
    );
    expect(refundSpy).not.toHaveBeenCalled();
    expect(await models.INRRequest.findById(request.id).lean()).toEqual(
      expect.objectContaining({ status: 'OPEN' }),
    );
    expect(
      await models.Refund.findOne({ sourceId: request.id }).lean(),
    ).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        failureReason: 'Refund amount exceeds remaining payment amount',
      }),
    );
    expect(await refundNotificationCount()).toBe(0);
  });

  it('recovers provider-success after a DB failure without calling the provider again', async () => {
    const provider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const inrRepository =
      await import('../../src/modules/inr-requests/inr-request.repository.js');
    const refundSpy = vi.spyOn(provider, 'refundOrder');
    vi.spyOn(inrRepository, 'closeOpenRequestForRefund').mockRejectedValueOnce(
      new Error('injected INR close failure'),
    );
    const request = await createOpenInr();
    const seller = await login('seller@example.test');
    await mutate(
      seller,
      'post',
      refundPath(request.id),
      {},
      'provider-success-db-fails',
    ).expect(500);
    const processingRefund = await models.Refund.findOne({
      sourceId: request.id,
    }).lean();
    expect(processingRefund).toEqual(
      expect.objectContaining({
        status: 'PROCESSING',
        providerRefundId: `SIM-REFUND-${processingRefund._id}`,
      }),
    );
    expect(await models.INRRequest.findById(request.id).lean()).toEqual(
      expect.objectContaining({ status: 'OPEN' }),
    );
    const retry = await mutate(
      seller,
      'post',
      refundPath(request.id),
      {},
      'provider-success-retry',
    ).expect(200);
    expect(retry.body.data.refund.id).toBe(String(processingRefund._id));
    expect(refundSpy).toHaveBeenCalledOnce();
    expect(await models.Refund.findById(processingRefund._id).lean()).toEqual(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
    expect(await refundNotificationCount()).toBe(1);
  });

  it('revalidates refund execution after preview state changes', async () => {
    const request = await createOpenInr();
    const seller = await login('seller@example.test');
    await seller
      .get(`${prefix}/inr-requests/${request.id}/refund-preview`)
      .expect(200);
    await models.INRRequest.updateOne(
      { _id: request.id },
      {
        status: 'CLOSED',
        closeReason: 'ITEM_ARRIVED',
        closedAt: new Date(),
      },
    );
    await mutate(
      seller,
      'post',
      refundPath(request.id),
      {},
      'preview-race',
    ).expect(409);
    expect(await models.Refund.countDocuments({ sourceId: request.id })).toBe(
      0,
    );
    expect(await refundNotificationCount()).toBe(0);
  });

  it('keeps refund execution seller-scoped and server-derived', async () => {
    const request = await createOpenInr();
    const otherSeller = await login('seller2@example.test');
    await mutate(
      otherSeller,
      'post',
      refundPath(request.id),
      {},
      'wrong-seller-refund',
    ).expect(404);
    expect(await models.Refund.countDocuments({ sourceId: request.id })).toBe(
      0,
    );
    expect(await refundNotificationCount()).toBe(0);
  });

  it('enforces canonical Refund model invariants', async () => {
    const baseRefund = {
      paymentId: ids.payment,
      checkoutGroupId: ids.checkoutGroup,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      sourceType: 'INR',
      sourceId: objectId(),
      amount: 1000,
      currency: 'VND',
      method: 'PAYPAL',
      status: 'PROCESSING',
    };
    const validationErrors = async (data) => {
      try {
        await new models.Refund(data).validate();
        return null;
      } catch (error) {
        return error.errors;
      }
    };

    await expect(
      new models.Refund(baseRefund).validate(),
    ).resolves.toBeUndefined();
    await expect(
      validationErrors({ ...baseRefund, amount: -1 }),
    ).resolves.toHaveProperty('amount');
    await expect(
      validationErrors({ ...baseRefund, sourceType: 'RETURN' }),
    ).resolves.toHaveProperty('sourceType');
    await expect(
      validationErrors({ ...baseRefund, sourceId: undefined }),
    ).resolves.toHaveProperty('sourceId');
    await expect(
      validationErrors({ ...baseRefund, method: 'CARD' }),
    ).resolves.toHaveProperty('method');
    await expect(
      validationErrors({ ...baseRefund, status: 'PENDING' }),
    ).resolves.toHaveProperty('status');
    await expect(
      validationErrors({ ...baseRefund, status: 'COMPLETED' }),
    ).resolves.toHaveProperty('completedAt');
    await expect(
      validationErrors({ ...baseRefund, completedAt: new Date() }),
    ).resolves.toHaveProperty('completedAt');
    await expect(
      validationErrors({
        ...baseRefund,
        status: 'FAILED',
        failedAt: new Date(),
      }),
    ).resolves.toHaveProperty('failureReason');
    await expect(
      new models.Refund({
        ...baseRefund,
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'DECLINED',
      }).validate(),
    ).resolves.toBeUndefined();
    await models.Refund.create(baseRefund);
    await expect(models.Refund.create(baseRefund)).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('redacts buyer order shipment tracking while preserving seller and shipper shipment visibility', async () => {
    const buyer = await login();
    const seller = await login('seller@example.test');
    const shipper = await login('shipper@example.test');
    const order = await buyer.get(`${prefix}/orders/${ids.order}`).expect(200);
    expect(order.body.data.shipment).toEqual(
      expect.objectContaining({
        status: 'READY_FOR_PICKUP',
        estimatedDeliveryAt: expect.any(String),
      }),
    );
    expect(order.body.data.shipment).not.toHaveProperty('carrier');
    expect(order.body.data.shipment).not.toHaveProperty('trackingNumber');
    const sellerShipments = await seller
      .get(`${prefix}/shipments/seller`)
      .expect(200);
    expect(sellerShipments.body.data[0]).toEqual(
      expect.objectContaining({
        carrier: 'SBay Express',
        trackingNumber: 'SBAY-ORIGINAL',
      }),
    );
    const shipperShipments = await shipper
      .get(`${prefix}/shipments?scope=available`)
      .expect(200);
    expect(shipperShipments.body.data[0]).toHaveProperty('trackingNumber');
  });
});
