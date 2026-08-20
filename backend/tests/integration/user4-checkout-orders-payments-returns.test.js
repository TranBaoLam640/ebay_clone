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
import { emailService } from '../../src/common/services/email.service.js';

const prefix = '/api/v1';
const password = 'Strong1!Password';
let app;
let database;
let mongo;
let models;
let passwordHash;
let signAccess;
let ids;

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
    `accessToken=${signAccess({
      id: String(user._id),
      role: user.role,
    })}`,
  );
  return agent;
};
const objectId = () => new mongoose.Types.ObjectId();

const seed = async () => {
  ids = {
    buyer: objectId(),
    otherBuyer: objectId(),
    sellerUser: objectId(),
    sellerUser2: objectId(),
    shipper: objectId(),
    shipper2: objectId(),
    seller: objectId(),
    seller2: objectId(),
    category: objectId(),
    catalogProduct: objectId(),
    catalogProduct2: objectId(),
    catalogProduct3: objectId(),
    product: objectId(),
    product2: objectId(),
    product3: objectId(),
    // Stable public uuids exposed at the API boundary (cart, product routes).
    // Internal foreign keys still use the ObjectId ids above.
    productUuid: '11111111-1111-4111-a111-111111111111',
    product2Uuid: '22222222-2222-4222-a222-222222222222',
    product3Uuid: '33333333-3333-4333-a333-333333333333',
    address: objectId(),
    otherAddress: objectId(),
    deliveredOrder: objectId(),
    deliveredItem: objectId(),
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
      fullName: 'Other',
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
    {
      _id: ids.shipper2,
      email: 'shipper2@example.test',
      passwordHash,
      fullName: 'Shipper 2',
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
      displayName: 'Alpha',
      status: 'ACTIVE',
    },
    {
      _id: ids.seller2,
      userId: ids.sellerUser2,
      displayName: 'Beta',
      status: 'ACTIVE',
    },
  ]);
  await models.CatalogProduct.create([
    {
      _id: ids.catalogProduct,
      ePID: 'SBAY-EPID-U4-0001',
      name: 'One',
      categoryId: ids.category,
    },
    {
      _id: ids.catalogProduct2,
      ePID: 'SBAY-EPID-U4-0002',
      name: 'Two',
      categoryId: ids.category,
    },
    {
      _id: ids.catalogProduct3,
      ePID: 'SBAY-EPID-U4-0003',
      name: 'Three',
      categoryId: ids.category,
    },
  ]);
  await models.Product.create([
    {
      _id: ids.product,
      uuid: ids.productUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      catalogProductId: ids.catalogProduct,
      title: 'One',
      description: 'One',
      price: 100,
      stock: 5,
      status: 'ACTIVE',
    },
    {
      _id: ids.product2,
      uuid: ids.product2Uuid,
      sellerId: ids.seller2,
      categoryId: ids.category,
      catalogProductId: ids.catalogProduct2,
      title: 'Two',
      description: 'Two',
      price: 200,
      stock: 5,
      status: 'ACTIVE',
    },
    {
      _id: ids.product3,
      uuid: ids.product3Uuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      catalogProductId: ids.catalogProduct3,
      title: 'Three',
      description: 'Three',
      price: 300,
      stock: 1,
      status: 'ACTIVE',
    },
  ]);
  await models.Address.create([
    {
      _id: ids.address,
      userId: ids.buyer,
      recipientName: 'Buyer',
      phone: '0123456789',
      addressLine: '1 Main',
      ward: 'W',
      district: 'D',
      province: 'P',
      country: 'VN',
    },
    {
      _id: ids.otherAddress,
      userId: ids.otherBuyer,
      recipientName: 'Other',
      phone: '0123456789',
      addressLine: '2 Main',
      ward: 'W',
      district: 'D',
      province: 'P',
      country: 'VN',
    },
  ]);
  await models.Order.create({
    _id: ids.deliveredOrder,
    buyerId: ids.buyer,
    sellerId: ids.seller,
    orderStatus: 'DELIVERED',
    deliveredAt: new Date(),
    items: [
      {
        _id: ids.deliveredItem,
        productId: ids.product,
        sellerId: ids.seller,
        quantity: 2,
      },
    ],
  });
};
const add = (agent, productId, quantity = 1) =>
  mutate(agent, 'post', '/cart/items', {
    productId: String(productId),
    quantity,
  });
const paymentAction = (agent, action, checkoutGroupId) =>
  mutate(agent, 'post', `/payments/${action}`, {
    checkoutGroupId: String(checkoutGroupId),
  });
const shipmentAction = (agent, action, shipmentId) =>
  mutate(agent, 'patch', `/shipments/${shipmentId}/${action}`);
const checkoutBody = (items, overrides = {}) => ({
  selectedCartItemIds: items.map((item) => item.id),
  addressId: String(ids.address),
  paymentMethod: 'COD',
  ...overrides,
});
const createConfirmedShipment = async (key = `ship-${objectId()}`) => {
  const agent = await login();
  const item = (await add(agent, ids.productUuid).expect(200)).body.data
    .items[0];
  const checkout = await mutate(
    agent,
    'post',
    '/checkout',
    checkoutBody([item]),
    key,
  ).expect(201);
  await paymentAction(agent, 'cod/confirm', checkout.body.data._id).expect(200);
  const order = await models.Order.findOne({
    checkoutGroupId: checkout.body.data._id,
  }).lean();
  const shipment = await models.Shipment.findOne({ orderId: order._id }).lean();
  return { agent, checkout, order, shipment };
};

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
    import('../../src/modules/catalog-products/catalog-product.model.js'),
    import('../../src/modules/addresses/address.model.js'),
    import('../../src/modules/carts/cart.model.js'),
    import('../../src/modules/coupons/coupon.model.js'),
    import('../../src/modules/coupons/coupon-usage.model.js'),
    import('../../src/modules/coupons/coupon-user-usage-counter.model.js'),
    import('../../src/modules/orders/order.model.js'),
    import('../../src/modules/notifications/notification.model.js'),
    import('../../src/modules/checkout-groups/checkout-group.model.js'),
    import('../../src/modules/idempotency/idempotency-record.model.js'),
    import('../../src/modules/payments/payment.model.js'),
    import('../../src/modules/returns/return-request.model.js'),
    import('../../src/modules/shipments/shipment.model.js'),
    import('../../src/common/utils/hash.js'),
    import('../../src/common/utils/token.js'),
  ]);
  models = {
    User: modules[0].User,
    Category: modules[1].Category,
    SellerProfile: modules[2].SellerProfile,
    Product: modules[3].Product,
    CatalogProduct: modules[4].CatalogProduct,
    Address: modules[5].Address,
    Cart: modules[6].Cart,
    Coupon: modules[7].Coupon,
    CouponUsage: modules[8].CouponUsage,
    CouponUserUsageCounter: modules[9].CouponUserUsageCounter,
    Order: modules[10].Order,
    Notification: modules[11].Notification,
    CheckoutGroup: modules[12].CheckoutGroup,
    IdempotencyRecord: modules[13].IdempotencyRecord,
    Payment: modules[14].Payment,
    ReturnRequest: modules[15].ReturnRequest,
    Shipment: modules[16].Shipment,
  };
  passwordHash = await modules[17].hashPassword(password);
  signAccess = modules[18].signAccess;
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
  vi.spyOn(emailService, 'sendPurchaseFeedbackEmail').mockResolvedValue(false);
});
afterAll(async () => {
  await database.disconnectDatabase();
  await mongo.stop();
});

describe('User 4 checkout, payment, orders, and returns', () => {
  it('requires auth, CSRF, idempotency key, strict input, and owned address', async () => {
    await request(app).post(`${prefix}/checkout`).expect(403);
    const agent = await login();
    await agent.post(`${prefix}/checkout`).send({}).expect(403);
    await mutate(agent, 'post', '/checkout', {}).expect(400);
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item]),
      'owned-address',
    ).expect(201);
    const item2 = (await add(agent, ids.product2Uuid).expect(200)).body.data
      .items[0];
    await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item2], { addressId: String(ids.otherAddress) }),
      'foreign-address',
    ).expect(404);
  });

  it('creates one multi-seller group atomically, snapshots pricing, deducts stock, removes selected items, and notifies', async () => {
    const agent = await login();
    const firstCart = (await add(agent, ids.productUuid, 2).expect(200)).body
      .data;
    const secondCart = (await add(agent, ids.product2Uuid).expect(200)).body
      .data;
    await add(agent, ids.product3Uuid).expect(200);
    const selected = [
      firstCart.items.find((item) => item.productId === ids.productUuid),
      secondCart.items.find((item) => item.productId === ids.product2Uuid),
    ];
    const response = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody(selected),
      'multi',
    );
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.data.orders).toHaveLength(2);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        subtotal: 400,
        total: 400,
        status: 'PAYMENT_PENDING',
      }),
    );
    expect(
      await models.Order.countDocuments({
        checkoutGroupId: response.body.data._id,
      }),
    ).toBe(2);
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(3);
    expect((await models.Product.findById(ids.product2).lean()).stock).toBe(4);
    expect(
      (await models.Cart.findOne({ userId: ids.buyer }).lean()).items.map(
        (item) => String(item.productId),
      ),
    ).toEqual([String(ids.product3)]);
    const orderNotifications = await models.Notification.find({
      eventType: USER4_NOTIFICATION_EVENTS.ORDER_PLACED,
    }).lean();
    expect(orderNotifications).toHaveLength(2);
    expect(
      orderNotifications
        .map((notification) => String(notification.userId))
        .sort(),
    ).toEqual([String(ids.sellerUser), String(ids.sellerUser2)].sort());
    for (const notification of orderNotifications)
      expect(notification).toEqual(
        expect.objectContaining({
          type: 'ORDER',
          referenceType: 'CheckoutGroup',
          referenceId: expect.any(mongoose.Types.ObjectId),
          eventType: USER4_NOTIFICATION_EVENTS.ORDER_PLACED,
          eventKey: expect.stringContaining(
            `${USER4_NOTIFICATION_EVENTS.ORDER_PLACED}:${response.body.data._id}:`,
          ),
        }),
      );
    expect(response.body.data.payment.status).toBe('PENDING');
    expect(
      await models.Shipment.countDocuments({
        orderId: { $in: response.body.data.orderIds },
      }),
    ).toBe(0);
    const emailSpy = vi
      .spyOn(emailService, 'sendPurchaseFeedbackEmail')
      .mockResolvedValue(true);
    await paymentAction(agent, 'cod/confirm', response.body.data._id).expect(
      200,
    );
    await paymentAction(agent, 'cod/confirm', response.body.data._id).expect(
      200,
    );
    expect(emailSpy).toHaveBeenCalledOnce();
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.test',
        buyerName: 'Buyer',
        checkoutGroupId: response.body.data._id,
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'One', quantity: 2 }),
          expect.objectContaining({ title: 'Two', quantity: 1 }),
        ]),
      }),
    );
    const paidOrders = await models.Order.find({
      checkoutGroupId: response.body.data._id,
    })
      .sort({ sellerId: 1 })
      .lean();
    expect(paidOrders).toHaveLength(2);
    expect(paidOrders.map((order) => order.orderStatus)).toEqual([
      'CONFIRMED',
      'CONFIRMED',
    ]);
    expect(paidOrders.every((order) => !order.deliveredAt)).toBe(true);
    const shipments = await models.Shipment.find({
      orderId: { $in: paidOrders.map((order) => order._id) },
    }).lean();
    expect(shipments).toHaveLength(2);
    expect(
      new Set(shipments.map((shipment) => String(shipment.orderId))).size,
    ).toBe(2);
    for (const shipment of shipments) {
      expect(shipment).toEqual(
        expect.objectContaining({
          carrier: 'SBay Express',
          status: 'READY_FOR_PICKUP',
          shipperId: null,
        }),
      );
      expect(shipment.trackingNumber).toMatch(/^SBAY-[A-F0-9]{8}$/);
      expect(shipment.estimatedDeliveryAt).toBeInstanceOf(Date);
    }
    expect(
      await models.Notification.find({
        eventType: USER4_NOTIFICATION_EVENTS.COD_CONFIRMED,
      }).lean(),
    ).toEqual([
      expect.objectContaining({
        userId: ids.buyer,
        type: 'PAYMENT',
        referenceType: 'CheckoutGroup',
        eventType: USER4_NOTIFICATION_EVENTS.COD_CONFIRMED,
        eventKey: `${USER4_NOTIFICATION_EVENTS.COD_CONFIRMED}:${response.body.data._id}`,
      }),
    ]);
  });

  it('replays exactly once and rejects key reuse with another payload', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 2).expect(200)).body.data
      .items[0];
    const body = checkoutBody([item]);
    const first = await mutate(agent, 'post', '/checkout', body, 'same').expect(
      201,
    );
    const replay = await mutate(
      agent,
      'post',
      '/checkout',
      body,
      'same',
    ).expect(201);
    expect(replay.body.data._id).toBe(first.body.data._id);
    expect(await models.CheckoutGroup.countDocuments()).toBe(1);
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(3);
    await mutate(
      agent,
      'post',
      '/checkout',
      { ...body, paymentMethod: 'PAYPAL' },
      'same',
    ).expect(409);
  });

  it('allows one true concurrent same-key checkout resource set', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const body = checkoutBody([item]);
    const responses = await Promise.all([
      mutate(agent, 'post', '/checkout', body, 'concurrent-same-key'),
      mutate(agent, 'post', '/checkout', body, 'concurrent-same-key'),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await models.CheckoutGroup.countDocuments()).toBe(1);
    expect(
      await models.Order.countDocuments({ checkoutGroupId: { $exists: true } }),
    ).toBe(1);
    expect(await models.Payment.countDocuments()).toBe(1);
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(4);
  });

  it('reclaims stale PROCESSING idempotency and creates one resource set', async () => {
    const idempotency =
      await import('../../src/modules/idempotency/idempotency.service.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const body = checkoutBody([item]);
    const stale = new Date(Date.now() - 10 * 60_000);
    await models.IdempotencyRecord.create({
      scope: 'CHECKOUT',
      ownerId: ids.buyer,
      key: 'stale-claim',
      requestHash: idempotency.requestHash(body),
      status: 'PROCESSING',
      claimToken: 'dead-worker',
      attempts: 1,
      startedAt: stale,
      lastAttemptAt: stale,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await mutate(agent, 'post', '/checkout', body, 'stale-claim').expect(201);
    expect(await models.CheckoutGroup.countDocuments()).toBe(1);
    expect(
      await models.Order.countDocuments({ checkoutGroupId: { $exists: true } }),
    ).toBe(1);
    expect(await models.Payment.countDocuments()).toBe(1);
    expect(
      await models.IdempotencyRecord.findOne({ key: 'stale-claim' }).lean(),
    ).toEqual(expect.objectContaining({ status: 'COMPLETED', attempts: 2 }));
  });

  it('allows only one concurrent stock checkout and rolls back every losing write', async () => {
    const buyer = await login();
    const other = await login('other@example.test');
    const buyerItem = (await add(buyer, ids.product3Uuid).expect(200)).body.data
      .items[0];
    await models.Cart.create({
      userId: ids.otherBuyer,
      items: [{ productId: ids.product3, quantity: 1 }],
    });
    const otherCart = await other.get(`${prefix}/cart`).expect(200);
    const responses = await Promise.all([
      mutate(
        buyer,
        'post',
        '/checkout',
        checkoutBody([buyerItem]),
        'buyer-stock',
      ),
      mutate(
        other,
        'post',
        '/checkout',
        {
          selectedCartItemIds: [otherCart.body.data.items[0].id],
          addressId: String(ids.otherAddress),
          paymentMethod: 'COD',
        },
        'other-stock',
      ),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await models.CheckoutGroup.countDocuments()).toBe(1);
    expect(await models.Payment.countDocuments()).toBe(1);
    expect((await models.Product.findById(ids.product3).lean()).stock).toBe(0);
  });

  it('conditionally consumes one coupon and PayPal failure reverses coupon and stock exactly once', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 2).expect(200)).body.data
      .items[0];
    const coupon = await models.Coupon.create({
      code: 'ONLY',
      description: 'Only',
      discountType: 'FIXED_AMOUNT',
      discountValue: 50,
      startsAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 60000),
      usageLimit: 1,
    });
    const response = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { couponCode: 'ONLY', paymentMethod: 'PAYPAL' }),
      'paypal-fail',
    ).expect(201);
    const id = response.body.data._id;
    expect(response.body.data.payment.status).toBe('PENDING');
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const providerPayment = await paymentAction(
      agent,
      'paypal/create',
      id,
    ).expect(200);
    expect(providerPayment.body.data.providerOrderId).toBe(`SIM-${id}`);
    expect(
      await models.Notification.find({
        eventType: USER4_NOTIFICATION_EVENTS.PAYPAL_CREATED,
      }).lean(),
    ).toEqual([
      expect.objectContaining({
        userId: ids.buyer,
        type: 'PAYMENT',
        referenceType: 'CheckoutGroup',
        eventType: USER4_NOTIFICATION_EVENTS.PAYPAL_CREATED,
        eventKey: `${USER4_NOTIFICATION_EVENTS.PAYPAL_CREATED}:${id}`,
      }),
    ]);
    expect((await models.Coupon.findById(coupon._id).lean()).usageCount).toBe(
      1,
    );
    vi.spyOn(paypalProvider, 'captureOrder').mockResolvedValue({
      providerOrderId: `SIM-${id}`,
      status: 'FAILED',
      reason: 'DECLINED',
    });
    await paymentAction(agent, 'paypal/capture', id).expect(200);
    await paymentAction(agent, 'paypal/capture', id).expect(200);
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(5);
    expect((await models.Coupon.findById(coupon._id).lean()).usageCount).toBe(
      0,
    );
    expect(await models.CouponUsage.countDocuments()).toBe(0);
    expect(await models.CouponUserUsageCounter.countDocuments()).toBe(0);
    expect((await models.CheckoutGroup.findById(id).lean()).status).toBe(
      'PAYMENT_FAILED',
    );
    expect(
      (await models.Order.findOne({ checkoutGroupId: id }).lean()).orderStatus,
    ).toBe('PAYMENT_FAILED');
    expect(
      await models.Notification.find({
        eventType: USER4_NOTIFICATION_EVENTS.PAYPAL_FAILED,
      }).lean(),
    ).toEqual([
      expect.objectContaining({
        userId: ids.buyer,
        type: 'PAYMENT',
        referenceType: 'CheckoutGroup',
        eventType: USER4_NOTIFICATION_EVENTS.PAYPAL_FAILED,
        eventKey: `${USER4_NOTIFICATION_EVENTS.PAYPAL_FAILED}:${id}`,
      }),
    ]);
  });

  it('captures PayPal idempotently and persists consistent confirmed state', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'paypal-capture',
    ).expect(201);
    const id = created.body.data._id;
    await paymentAction(agent, 'paypal/create', id).expect(200);
    const emailSpy = vi
      .spyOn(emailService, 'sendPurchaseFeedbackEmail')
      .mockResolvedValue(true);
    await paymentAction(agent, 'paypal/capture', id).expect(200);
    await paymentAction(agent, 'paypal/capture', id).expect(200);
    expect(emailSpy).toHaveBeenCalledOnce();
    expect(emailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.test',
        buyerName: 'Buyer',
        checkoutGroupId: id,
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'One', quantity: 1 }),
        ]),
      }),
    );
    expect(
      (await models.Payment.findOne({ checkoutGroupId: id }).lean()).status,
    ).toBe('CAPTURED');
    expect((await models.CheckoutGroup.findById(id).lean()).status).toBe(
      'CONFIRMED',
    );
    const order = await models.Order.findOne({ checkoutGroupId: id }).lean();
    expect(order.orderStatus).toBe('CONFIRMED');
    expect(order.deliveredAt).toBeFalsy();
    const shipment = await models.Shipment.findOne({
      orderId: order._id,
    }).lean();
    expect(shipment).toEqual(
      expect.objectContaining({
        buyerId: ids.buyer,
        sellerId: ids.seller,
        shipperId: null,
        carrier: 'SBay Express',
        status: 'READY_FOR_PICKUP',
      }),
    );
    expect(shipment.trackingNumber).toMatch(/^SBAY-[A-F0-9]{8}$/);
    expect(shipment.estimatedDeliveryAt).toBeInstanceOf(Date);
    expect(
      await models.Notification.find({
        eventType: USER4_NOTIFICATION_EVENTS.PAYPAL_CAPTURED,
      }).lean(),
    ).toEqual([
      expect.objectContaining({
        userId: ids.buyer,
        type: 'PAYMENT',
        referenceType: 'CheckoutGroup',
        eventType: USER4_NOTIFICATION_EVENTS.PAYPAL_CAPTURED,
        eventKey: `${USER4_NOTIFICATION_EVENTS.PAYPAL_CAPTURED}:${id}`,
      }),
    ]);
    await paymentAction(agent, 'cod/confirm', id).expect(409);
  });

  it('does not invoke PayPal provider inside checkout transaction', async () => {
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const createSpy = vi.spyOn(paypalProvider, 'createOrder');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'provider-not-in-checkout',
    ).expect(201);
    expect(createSpy).not.toHaveBeenCalled();
    expect(created.body.data.payment).toEqual(
      expect.objectContaining({ method: 'PAYPAL', status: 'PENDING' }),
    );
    expect(created.body.data.payment).not.toHaveProperty('providerOrderId');
  });

  it('lets SHIPPER list available and own shipments only', async () => {
    const { shipment } = await createConfirmedShipment('shipper-list');
    const user = await login();
    await user.get(`${prefix}/shipments?scope=available`).expect(403);

    const shipper = await login('shipper@example.test');
    const available = await shipper
      .get(`${prefix}/shipments?scope=available&page=1&limit=10`)
      .expect(200);
    expect(available.body.data.map((item) => item._id)).toContain(
      String(shipment._id),
    );

    await shipmentAction(shipper, 'pickup', shipment._id).expect(200);
    const mine = await shipper
      .get(`${prefix}/shipments?scope=mine`)
      .expect(200);
    expect(mine.body.data).toEqual([
      expect.objectContaining({
        _id: String(shipment._id),
        status: 'IN_TRANSIT',
        shipperId: String(ids.shipper),
      }),
    ]);
    const availableAfterPickup = await shipper
      .get(`${prefix}/shipments?scope=available`)
      .expect(200);
    expect(availableAfterPickup.body.data).toEqual([]);
  });

  it('atomically claims pickup and rejects invalid pickup states', async () => {
    const { shipment } = await createConfirmedShipment('pickup-race');
    const shipperA = await login('shipper@example.test');
    const shipperB = await login('shipper2@example.test');

    const responses = await Promise.all([
      shipmentAction(shipperA, 'pickup', shipment._id),
      shipmentAction(shipperB, 'pickup', shipment._id),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const pickedUp = await models.Shipment.findById(shipment._id).lean();
    expect(pickedUp.status).toBe('IN_TRANSIT');
    expect([String(ids.shipper), String(ids.shipper2)]).toContain(
      String(pickedUp.shipperId),
    );
    expect(pickedUp.pickedUpAt).toBeInstanceOf(Date);

    const owner =
      String(pickedUp.shipperId) === String(ids.shipper) ? shipperA : shipperB;
    await shipmentAction(owner, 'pickup', shipment._id).expect(409);
    await shipmentAction(owner, 'deliver', shipment._id).expect(200);
    await shipmentAction(owner, 'pickup', shipment._id).expect(409);
  });

  it('delivers only by owning shipper and syncs Order deliveredAt transactionally', async () => {
    const { shipment, order } = await createConfirmedShipment('deliver-sync');
    const shipperA = await login('shipper@example.test');
    const shipperB = await login('shipper2@example.test');

    await shipmentAction(shipperB, 'deliver', shipment._id).expect(409);
    await shipmentAction(shipperA, 'pickup', shipment._id).expect(200);
    await shipmentAction(shipperB, 'deliver', shipment._id).expect(409);

    const delivered = await shipmentAction(
      shipperA,
      'deliver',
      shipment._id,
    ).expect(200);
    expect(delivered.body.data.status).toBe('DELIVERED');
    expect(delivered.body.data.deliveredAt).toBeTruthy();
    await shipmentAction(shipperA, 'deliver', shipment._id).expect(409);

    const deliveredShipment = await models.Shipment.findById(
      shipment._id,
    ).lean();
    const deliveredOrder = await models.Order.findById(order._id).lean();
    expect(deliveredShipment.status).toBe('DELIVERED');
    expect(deliveredOrder.orderStatus).toBe('DELIVERED');
    expect(deliveredShipment.deliveredAt).toBeInstanceOf(Date);
    expect(deliveredOrder.deliveredAt).toBeInstanceOf(Date);
    expect(deliveredOrder.deliveredAt.toISOString()).toBe(
      deliveredShipment.deliveredAt.toISOString(),
    );
  });

  it('rolls back shipment delivery when the Order is not confirmed', async () => {
    const { shipment, order } =
      await createConfirmedShipment('deliver-rollback');
    const shipper = await login('shipper@example.test');
    await shipmentAction(shipper, 'pickup', shipment._id).expect(200);
    await models.Order.updateOne(
      { _id: order._id },
      { orderStatus: 'PAYMENT_FAILED' },
    );

    await shipmentAction(shipper, 'deliver', shipment._id).expect(409);
    const unchanged = await models.Shipment.findById(shipment._id).lean();
    expect(unchanged.status).toBe('IN_TRANSIT');
    expect(unchanged.deliveredAt).toBeNull();
  });

  it('rolls back PayPal create persistence and releases claim when notification fails', async () => {
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const notificationRepository =
      await import('../../src/modules/notifications/repository.js');
    const createSpy = vi.spyOn(paypalProvider, 'createOrder');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'provider-create-rollback',
    ).expect(201);
    const groupId = created.body.data._id;
    vi.spyOn(notificationRepository, 'createUnique').mockRejectedValueOnce(
      new Error('injected PayPal create notification failure'),
    );
    await paymentAction(agent, 'paypal/create', groupId).expect(500);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(
      await models.Payment.findOne({ checkoutGroupId: groupId }).lean(),
    ).toEqual(expect.objectContaining({ status: 'PENDING' }));
    expect(
      (await models.Payment.findOne({ checkoutGroupId: groupId }).lean())
        .providerOrderId,
    ).toBeUndefined();
    expect(
      await models.Notification.countDocuments({ eventType: 'PAYPAL_CREATED' }),
    ).toBe(0);
  });

  it('allows only one concurrent PayPal create and capture provider invocation', async () => {
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'provider-concurrency',
    ).expect(201);
    const groupId = created.body.data._id;
    const createImplementation = paypalProvider.createOrder;
    const createSpy = vi
      .spyOn(paypalProvider, 'createOrder')
      .mockImplementation(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return createImplementation(...args);
      });
    const creates = await Promise.all([
      paymentAction(agent, 'paypal/create', groupId),
      paymentAction(agent, 'paypal/create', groupId),
    ]);
    expect(creates.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(createSpy).toHaveBeenCalledTimes(1);
    const captureImplementation = paypalProvider.captureOrder;
    const captureSpy = vi
      .spyOn(paypalProvider, 'captureOrder')
      .mockImplementation(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return captureImplementation(...args);
      });
    const captures = await Promise.all([
      paymentAction(agent, 'paypal/capture', groupId),
      paymentAction(agent, 'paypal/capture', groupId),
    ]);
    expect(captures.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(
      await models.Payment.findOne({ checkoutGroupId: groupId }).lean(),
    ).toEqual(expect.objectContaining({ status: 'CAPTURED' }));
  });

  it('rejects stale provider workers completing or releasing newer claims', async () => {
    const paymentRepository =
      await import('../../src/modules/payments/payment.repository.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'provider-generation',
    ).expect(201);
    const groupId = created.body.data._id;
    const staleNow = new Date(Date.now() - 10 * 60_000);
    const stale = await paymentRepository.claimPayPalCreate(
      ids.buyer,
      groupId,
      'stale-token',
      staleNow,
      new Date(staleNow.getTime() - 5 * 60_000),
    );
    expect(stale).toBeTruthy();
    const currentNow = new Date();
    const current = await paymentRepository.claimPayPalCreate(
      ids.buyer,
      groupId,
      'current-token',
      currentNow,
      new Date(currentNow.getTime() - 5 * 60_000),
    );
    expect(current.providerCreateClaimToken).toBe('current-token');
    expect(
      await paymentRepository.completePayPalCreate(
        ids.buyer,
        groupId,
        'STALE-PROVIDER-ID',
        'stale-token',
      ),
    ).toBeNull();
    await paymentRepository.releasePayPalCreate(stale._id, 'stale-token');
    expect(
      await models.Payment.findOne({ checkoutGroupId: groupId }).lean(),
    ).toEqual(
      expect.objectContaining({
        status: 'PROVIDER_CREATING',
        providerCreateClaimToken: 'current-token',
      }),
    );
    await models.Payment.updateOne(
      { checkoutGroupId: groupId },
      {
        $set: {
          status: 'CREATED',
          providerOrderId: `SIM-${groupId}`,
          restorationStatus: 'PENDING',
        },
        $unset: { providerCreateClaimToken: 1, providerCreateClaimedAt: 1 },
      },
    );
    const staleCapture = await paymentRepository.claimPayPalCapture(
      ids.buyer,
      groupId,
      `SIM-${groupId}`,
      'stale-capture-token',
      staleNow,
      new Date(staleNow.getTime() - 5 * 60_000),
    );
    const currentCapture = await paymentRepository.claimPayPalCapture(
      ids.buyer,
      groupId,
      `SIM-${groupId}`,
      'current-capture-token',
      currentNow,
      new Date(currentNow.getTime() - 5 * 60_000),
    );
    expect(currentCapture.providerCaptureClaimToken).toBe(
      'current-capture-token',
    );
    expect(
      await paymentRepository.capture(
        ids.buyer,
        groupId,
        `SIM-${groupId}`,
        'stale-capture-token',
      ),
    ).toBeNull();
    expect(
      await paymentRepository.claimFailureRestoration(
        ids.buyer,
        groupId,
        `SIM-${groupId}`,
        'stale-capture-token',
        'DECLINED',
      ),
    ).toBeNull();
    await paymentRepository.releasePayPalCapture(
      staleCapture._id,
      'stale-capture-token',
    );
    expect(
      await models.Payment.findOne({ checkoutGroupId: groupId }).lean(),
    ).toEqual(
      expect.objectContaining({
        status: 'PROVIDER_CAPTURING',
        providerCaptureClaimToken: 'current-capture-token',
      }),
    );
  });

  it('rejects provider errors, invalid identity, foreign ownership, and method mismatch without transition', async () => {
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    const agent = await login();
    const other = await login('other@example.test');
    const paypalItem = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const paypal = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([paypalItem], { paymentMethod: 'PAYPAL' }),
      'provider-errors',
    ).expect(201);
    const paypalId = paypal.body.data._id;
    const createSpy = vi
      .spyOn(paypalProvider, 'createOrder')
      .mockRejectedValueOnce(new Error('provider unavailable'));
    await paymentAction(agent, 'paypal/create', paypalId).expect(500);
    expect(
      await models.Payment.findOne({ checkoutGroupId: paypalId }).lean(),
    ).toEqual(expect.objectContaining({ status: 'PENDING' }));
    createSpy.mockResolvedValueOnce({
      providerOrderId: `WRONG-${paypalId}`,
      status: 'CREATED',
      amount: 999,
      currency: 'VND',
    });
    await paymentAction(agent, 'paypal/create', paypalId).expect(502);
    expect(
      await models.Payment.findOne({ checkoutGroupId: paypalId }).lean(),
    ).toEqual(expect.objectContaining({ status: 'PENDING' }));
    await paymentAction(other, 'paypal/create', paypalId).expect(404);
    expect(createSpy).toHaveBeenCalledTimes(2);
    createSpy.mockRestore();
    await paymentAction(agent, 'paypal/create', paypalId).expect(200);
    vi.spyOn(paypalProvider, 'captureOrder').mockResolvedValueOnce({
      providerOrderId: `WRONG-${paypalId}`,
      status: 'CAPTURED',
    });
    await paymentAction(agent, 'paypal/capture', paypalId).expect(502);
    expect(
      await models.Payment.findOne({ checkoutGroupId: paypalId }).lean(),
    ).toEqual(expect.objectContaining({ status: 'CREATED' }));
    expect(await models.CheckoutGroup.findById(paypalId).lean()).toEqual(
      expect.objectContaining({ status: 'PAYMENT_PENDING' }),
    );
    const codItem = (await add(agent, ids.product2Uuid).expect(200)).body.data
      .items[0];
    const cod = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([codItem]),
      'method-mismatch',
    ).expect(201);
    await paymentAction(agent, 'paypal/create', cod.body.data._id).expect(409);
    await paymentAction(agent, 'cod/confirm', paypalId).expect(409);
  });

  it('provides owned checkout group detail and paginated order reads', async () => {
    const agent = await login();
    const other = await login('other@example.test');
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item]),
      'reads',
    ).expect(201);
    const groupId = created.body.data._id;
    const orderId = created.body.data.orders[0]._id;
    await agent.get(`${prefix}/checkout-groups/${groupId}`).expect(200);
    await other.get(`${prefix}/checkout-groups/${groupId}`).expect(404);
    expect(
      (await agent.get(`${prefix}/orders?page=1&limit=1`).expect(200)).body.meta
        .totalItems,
    ).toBe(2);
    await agent.get(`${prefix}/orders/${orderId}`).expect(200);
    await other.get(`${prefix}/orders/${orderId}`).expect(404);
  });

  it('supports exact eligible owned return create/list/detail and rejects duplicates, foreign, and ineligible orders', async () => {
    const agent = await login();
    const other = await login('other@example.test');
    const body = {
      orderId: String(ids.deliveredOrder),
      orderItemId: String(ids.deliveredItem),
      quantity: 1,
      reason: 'DAMAGED',
      details: 'Damaged on arrival',
    };
    await mutate(other, 'post', '/returns', body)
      .expect(409)
      .expect((response) =>
        expect(response.body.error.code).toBe('RETURN_NOT_ELIGIBLE'),
      );
    expect(await models.ReturnRequest.countDocuments()).toBe(0);
    const created = await mutate(agent, 'post', '/returns', body).expect(201);
    const id = created.body.data._id;
    const returnNotifications = await models.Notification.find({
      eventType: USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED,
    }).lean();
    expect(returnNotifications).toHaveLength(2);
    expect(
      returnNotifications
        .map((notification) => String(notification.userId))
        .sort(),
    ).toEqual([String(ids.buyer), String(ids.sellerUser)].sort());
    expect(
      returnNotifications.map((notification) => notification.type),
    ).toEqual(['RETURN', 'RETURN']);
    expect(
      returnNotifications.map((notification) => notification.eventKey).sort(),
    ).toEqual(
      [
        `${USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED}:${id}:BUYER`,
        `${USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED}:${id}:SELLER`,
      ].sort(),
    );
    for (const notification of returnNotifications)
      expect(notification).toEqual(
        expect.objectContaining({
          referenceType: 'ReturnRequest',
          eventType: USER4_NOTIFICATION_EVENTS.RETURN_REQUESTED,
        }),
      );
    await mutate(agent, 'post', '/returns', body).expect(409);
    expect(
      (await agent.get(`${prefix}/returns?page=1&limit=1`).expect(200)).body
        .meta.totalItems,
    ).toBe(1);
    await agent.get(`${prefix}/returns/${id}`).expect(200);
    await other.get(`${prefix}/returns/${id}`).expect(404);
    await mutate(agent, 'patch', `/returns/${id}`, {
      quantity: 2,
    }).expect(404);
    await mutate(agent, 'delete', `/returns/${id}`).expect(404);
    const pending = await models.Order.findOne({
      orderStatus: 'DELIVERED',
    }).lean();
    await models.Order.updateOne(
      { _id: pending._id },
      { orderStatus: 'CONFIRMED' },
    );
    await mutate(agent, 'post', '/returns', {
      ...body,
      reason: 'OTHER',
      details: 'No longer delivered',
    }).expect(409);
  });

  it('keeps returns ineligible until shipment delivery syncs Order DELIVERED', async () => {
    const { shipment, order } = await createConfirmedShipment(
      'return-after-shipping',
    );
    const agent = await login();
    const shipper = await login('shipper@example.test');
    const body = {
      orderId: String(order._id),
      orderItemId: String(order.items[0]._id),
      quantity: 1,
      reason: 'DAMAGED',
      details: 'Only eligible after delivery',
    };

    await mutate(agent, 'post', '/returns', body).expect(409);
    await shipmentAction(shipper, 'pickup', shipment._id).expect(200);
    await mutate(agent, 'post', '/returns', body).expect(409);
    await shipmentAction(shipper, 'deliver', shipment._id).expect(200);
    const created = await mutate(agent, 'post', '/returns', body).expect(201);
    expect(created.body.data.orderId).toBe(String(order._id));
  });

  it('persists exact replay responses and rejects a live PROCESSING claim', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const body = checkoutBody([item]);
    const first = await mutate(
      agent,
      'post',
      '/checkout',
      body,
      'exact-replay',
    ).expect(201);
    const replay = await mutate(
      agent,
      'post',
      '/checkout',
      body,
      'exact-replay',
    ).expect(201);
    expect(replay.body).toEqual(first.body);
    const idempotency =
      await import('../../src/modules/idempotency/idempotency.service.js');
    const now = new Date();
    await models.IdempotencyRecord.create({
      scope: 'CHECKOUT',
      ownerId: ids.buyer,
      key: 'processing',
      requestHash: idempotency.requestHash(body),
      status: 'PROCESSING',
      claimToken: 'active-owner',
      attempts: 1,
      startedAt: now,
      lastAttemptAt: now,
      expiresAt: new Date(now.getTime() + 86_400_000),
    });
    await mutate(agent, 'post', '/checkout', body, 'processing')
      .expect(409)
      .expect((response) =>
        expect(response.body.error.code).toBe('IDEMPOTENCY_PROCESSING'),
      );
  });

  it('marks failed idempotency, rolls back broad writes, and reclaims the same key', async () => {
    const notificationRepository =
      await import('../../src/modules/notifications/repository.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const body = checkoutBody([item]);
    vi.spyOn(notificationRepository, 'createUnique').mockRejectedValueOnce(
      new Error('injected notification failure'),
    );
    await mutate(agent, 'post', '/checkout', body, 'failed-reclaim').expect(
      500,
    );
    expect(await models.CheckoutGroup.countDocuments()).toBe(0);
    expect(
      await models.Order.countDocuments({ checkoutGroupId: { $exists: true } }),
    ).toBe(0);
    expect(await models.Payment.countDocuments()).toBe(0);
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(5);
    expect(
      await models.IdempotencyRecord.findOne({ key: 'failed-reclaim' }).lean(),
    ).toEqual(expect.objectContaining({ status: 'FAILED', attempts: 1 }));
    vi.restoreAllMocks();
    await mutate(agent, 'post', '/checkout', body, 'failed-reclaim').expect(
      201,
    );
    expect(
      await models.IdempotencyRecord.findOne({ key: 'failed-reclaim' }).lean(),
    ).toEqual(expect.objectContaining({ status: 'COMPLETED', attempts: 2 }));
  });

  it('atomically enforces the global coupon limit under concurrency', async () => {
    const agent = await login();
    const cart = (await add(agent, ids.productUuid).expect(200)).body.data;
    const secondCart = (await add(agent, ids.product2Uuid).expect(200)).body
      .data;
    const first = cart.items.find((item) => item.productId === ids.productUuid);
    const second = secondCart.items.find(
      (item) => item.productId === ids.product2Uuid,
    );
    await models.Coupon.create({
      code: 'RACE',
      description: 'Race',
      discountType: 'FIXED_AMOUNT',
      discountValue: 1,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      usageLimit: 1,
      perUserLimit: 5,
    });
    const responses = await Promise.all([
      mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([first], { couponCode: 'RACE' }),
        'coupon-race-one',
      ),
      mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([second], { couponCode: 'RACE' }),
        'coupon-race-two',
      ),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await models.CouponUsage.countDocuments()).toBe(1);
    expect(await models.CouponUserUsageCounter.countDocuments()).toBe(1);
    expect(
      (await models.Coupon.findOne({ code: 'RACE' }).lean()).usageCount,
    ).toBe(1);
  });

  it('reconciles mixed legacy usage and stale global usageCount under concurrency', async () => {
    const agent = await login();
    const cart = (await add(agent, ids.productUuid).expect(200)).body.data;
    const secondCart = (await add(agent, ids.product2Uuid).expect(200)).body
      .data;
    const first = cart.items.find((item) => item.productId === ids.productUuid);
    const second = secondCart.items.find(
      (item) => item.productId === ids.product2Uuid,
    );
    const legacy = await models.Coupon.create({
      code: 'LEGACYGLOBAL',
      description: 'Legacy global count',
      discountType: 'FIXED_AMOUNT',
      discountValue: 1,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      usageLimit: 3,
      perUserLimit: 5,
      usageCount: 1,
    });
    await models.CouponUsage.create([
      {
        couponId: legacy._id,
        buyerId: ids.otherBuyer,
        checkoutGroupId: objectId(),
        orderIds: [objectId()],
      },
      {
        couponId: legacy._id,
        buyerId: ids.otherBuyer,
        checkoutGroupId: objectId(),
        orderIds: [objectId()],
      },
    ]);
    const responses = await Promise.all([
      mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([first], { couponCode: 'LEGACYGLOBAL' }),
        'legacy-global-one',
      ),
      mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([second], { couponCode: 'LEGACYGLOBAL' }),
        'legacy-global-two',
      ),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await models.CouponUsage.countDocuments({ couponId: legacy._id }),
    ).toBe(3);
    expect((await models.Coupon.findById(legacy._id).lean()).usageCount).toBe(
      3,
    );
  });

  it('atomically enforces per-buyer coupon limit above one with spare global capacity', async () => {
    const agent = await login();
    const cart = (await add(agent, ids.productUuid).expect(200)).body.data;
    const secondCart = (await add(agent, ids.product2Uuid).expect(200)).body
      .data;
    const first = cart.items.find((item) => item.productId === ids.productUuid);
    const second = secondCart.items.find(
      (item) => item.productId === ids.product2Uuid,
    );
    const limited = await models.Coupon.create({
      code: 'BUYER2',
      description: 'Buyer limit two',
      discountType: 'FIXED_AMOUNT',
      discountValue: 1,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      usageLimit: 10,
      perUserLimit: 2,
      usageCount: 1,
    });
    await models.CouponUsage.create({
      couponId: limited._id,
      buyerId: ids.buyer,
      checkoutGroupId: objectId(),
      orderIds: [objectId()],
    });
    const responses = await Promise.all([
      mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([first], { couponCode: 'BUYER2' }),
        'buyer-limit-one',
      ),
      mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([second], { couponCode: 'BUYER2' }),
        'buyer-limit-two',
      ),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await models.CouponUsage.countDocuments({ couponId: limited._id }),
    ).toBe(2);
    expect(
      await models.CouponUserUsageCounter.findOne({
        couponId: limited._id,
        buyerId: ids.buyer,
      }).lean(),
    ).toEqual(expect.objectContaining({ usageCount: 2 }));
    expect((await models.Coupon.findById(limited._id).lean()).usageCount).toBe(
      2,
    );
  });

  it('atomically transitions stock out of stock and restores it exactly once', async () => {
    const agent = await login();
    const item = (await add(agent, ids.product3Uuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'stock-transition',
    ).expect(201);
    expect(await models.Product.findById(ids.product3).lean()).toEqual(
      expect.objectContaining({ stock: 0, status: 'OUT_OF_STOCK' }),
    );
    const id = created.body.data._id;
    await paymentAction(agent, 'paypal/create', id).expect(200);
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    vi.spyOn(paypalProvider, 'captureOrder').mockResolvedValue({
      providerOrderId: `SIM-${id}`,
      status: 'FAILED',
      reason: 'DECLINED',
    });
    const failures = await Promise.all([
      paymentAction(agent, 'paypal/capture', id),
      paymentAction(agent, 'paypal/capture', id),
    ]);
    expect(failures.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    await paymentAction(agent, 'paypal/capture', id).expect(200);
    expect(await models.Product.findById(ids.product3).lean()).toEqual(
      expect.objectContaining({ stock: 1, status: 'ACTIVE' }),
    );
    expect(
      await models.Notification.countDocuments({ eventType: 'PAYPAL_FAILED' }),
    ).toBe(1);
    expect(
      await models.Payment.findOne({ checkoutGroupId: id }).lean(),
    ).toEqual(expect.objectContaining({ restorationStatus: 'COMPLETED' }));
  });

  it('returns safe Payment DTOs and filtered, sorted, projected Orders', async () => {
    const agent = await login();
    await models.Address.collection.updateOne(
      { _id: ids.address },
      { $set: { internalSecret: 'hidden' } },
    );
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'safe-reads',
    ).expect(201);
    const groupId = created.body.data._id;
    await models.Order.collection.updateOne(
      { checkoutGroupId: new mongoose.Types.ObjectId(groupId) },
      {
        $set: {
          internalSecret: 'hidden',
          'items.0.internalSecret': 'hidden',
          'shippingAddress.internalSecret': 'hidden',
        },
      },
    );
    const payment = (
      await agent.get(`${prefix}/checkout-groups/${groupId}`).expect(200)
    ).body.data.payment;
    expect(payment).not.toHaveProperty('buyerId');
    expect(payment).not.toHaveProperty('restorationStatus');
    expect(payment).not.toHaveProperty('providerCreateOutcome');
    const group = (
      await agent.get(`${prefix}/checkout-groups/${groupId}`).expect(200)
    ).body.data;
    expect(group).not.toHaveProperty('buyerId');
    expect(group).not.toHaveProperty('__v');
    expect(group.orders[0]).not.toHaveProperty('buyerId');
    expect(group.orders[0]).not.toHaveProperty('__v');
    expect(group.orders[0]).not.toHaveProperty('internalSecret');
    expect(group.orders[0].items[0]).not.toHaveProperty('internalSecret');
    expect(group.orders[0].shippingAddress).toEqual({
      fullName: 'Buyer',
      phone: '0123456789',
      addressLine: '1 Main',
      ward: 'W',
      district: 'D',
      province: 'P',
      country: 'VN',
    });
    for (const forbidden of [
      '_id',
      'userId',
      '__v',
      'isDefault',
      'internalSecret',
    ])
      expect(group.orders[0].shippingAddress).not.toHaveProperty(forbidden);
    expect(created.body.data.orders[0].shippingAddress).toEqual(
      group.orders[0].shippingAddress,
    );
    const status = await agent
      .get(`${prefix}/orders?status=PENDING_PAYMENT`)
      .expect(200);
    expect(status.body.data).toHaveLength(1);
    const seller = await agent
      .get(`${prefix}/orders?sellerId=${ids.seller}`)
      .expect(200);
    expect(seller.body.data).toHaveLength(2);
    const from = await agent
      .get(`${prefix}/orders?from=2000-01-01T00:00:00.000Z`)
      .expect(200);
    expect(from.body.data.length).toBeGreaterThanOrEqual(2);
    const to = await agent
      .get(`${prefix}/orders?to=2000-01-01T00:00:00.000Z`)
      .expect(200);
    expect(to.body.data).toHaveLength(0);
    const newest = await agent.get(`${prefix}/orders?sort=newest`).expect(200);
    const oldest = await agent.get(`${prefix}/orders?sort=oldest`).expect(200);
    expect(newest.body.data.map((order) => order._id)).toEqual(
      [...oldest.body.data.map((order) => order._id)].reverse(),
    );
    expect(newest.body.data[0]).not.toHaveProperty('buyerId');
    expect(newest.body.data[0]).not.toHaveProperty('__v');
    await agent.get(`${prefix}/orders?sort=total_asc`).expect(400);
    await agent.get(`${prefix}/orders?sort=total_desc`).expect(400);
    await agent
      .get(`${prefix}/orders?from=2030-01-02&to=2030-01-01`)
      .expect(400);
  });

  it('rolls back capture and return mutations when transactional notifications fail', async () => {
    const notificationRepository =
      await import('../../src/modules/notifications/repository.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'rollback-payment',
    ).expect(201);
    const groupId = created.body.data._id;
    await paymentAction(agent, 'paypal/create', groupId).expect(200);
    vi.spyOn(notificationRepository, 'createUnique').mockRejectedValueOnce(
      new Error('injected payment notification failure'),
    );
    await paymentAction(agent, 'paypal/capture', groupId).expect(500);
    expect(
      await models.Payment.findOne({ checkoutGroupId: groupId }).lean(),
    ).toEqual(expect.objectContaining({ status: 'CREATED' }));
    expect(await models.CheckoutGroup.findById(groupId).lean()).toEqual(
      expect.objectContaining({ status: 'PAYMENT_PENDING' }),
    );
    vi.restoreAllMocks();
    vi.spyOn(notificationRepository, 'createUnique').mockRejectedValueOnce(
      new Error('injected return notification failure'),
    );
    await mutate(agent, 'post', '/returns', {
      orderId: String(ids.deliveredOrder),
      orderItemId: String(ids.deliveredItem),
      quantity: 1,
      reason: 'DAMAGED',
    }).expect(500);
    expect(await models.ReturnRequest.countDocuments()).toBe(0);
  });

  it('rolls back failed-payment restoration when a repository write fails', async () => {
    const productRepository =
      await import('../../src/modules/products/product.repository.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const created = await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { paymentMethod: 'PAYPAL' }),
      'rollback-failure',
    ).expect(201);
    const groupId = created.body.data._id;
    await paymentAction(agent, 'paypal/create', groupId).expect(200);
    const paypalProvider =
      await import('../../src/modules/payments/providers/paypal-simulation.provider.js');
    vi.spyOn(paypalProvider, 'captureOrder').mockResolvedValue({
      providerOrderId: `SIM-${groupId}`,
      status: 'FAILED',
      reason: 'DECLINED',
    });
    vi.spyOn(productRepository, 'restoreStock').mockRejectedValueOnce(
      new Error('injected stock restoration failure'),
    );
    await paymentAction(agent, 'paypal/capture', groupId).expect(500);
    expect(
      await models.Payment.findOne({ checkoutGroupId: groupId }).lean(),
    ).toEqual(
      expect.objectContaining({
        status: 'CREATED',
        restorationStatus: 'PENDING',
      }),
    );
    expect(await models.CheckoutGroup.findById(groupId).lean()).toEqual(
      expect.objectContaining({ status: 'PAYMENT_PENDING' }),
    );
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(4);
  });

  it('rejects missing, future, and expired deliveredAt for returns', async () => {
    const agent = await login();
    const body = {
      orderId: String(ids.deliveredOrder),
      orderItemId: String(ids.deliveredItem),
      quantity: 1,
      reason: 'DAMAGED',
    };
    await models.Order.updateOne(
      { _id: ids.deliveredOrder },
      { $unset: { deliveredAt: 1 } },
    );
    await mutate(agent, 'post', '/returns', body).expect(409);
    await models.Order.updateOne(
      { _id: ids.deliveredOrder },
      { deliveredAt: new Date(Date.now() + 60_000) },
    );
    await mutate(agent, 'post', '/returns', body).expect(409);
    await models.Order.updateOne(
      { _id: ids.deliveredOrder },
      { deliveredAt: new Date(Date.now() - 31 * 86_400_000) },
    );
    await mutate(agent, 'post', '/returns', body).expect(409);
  });

  it('exposes the exact User 4 method/path inventory and removes old routes', async () => {
    const [
      { checkoutRoute },
      { checkoutGroupRoute },
      { orderRoute },
      { paymentRoute },
      { returnRoute },
    ] = await Promise.all([
      import('../../src/modules/checkout/checkout.route.js'),
      import('../../src/modules/checkout-groups/checkout-group.route.js'),
      import('../../src/modules/orders/order.route.js'),
      import('../../src/modules/payments/payment.route.js'),
      import('../../src/modules/returns/return-request.route.js'),
    ]);
    const inventory = (router, mount) =>
      router.stack
        .filter((layer) => layer.route)
        .flatMap((layer) =>
          Object.keys(layer.route.methods).map(
            (method) => `${method.toUpperCase()} ${mount}${layer.route.path}`,
          ),
        );
    expect([
      ...inventory(checkoutRoute, '/checkout'),
      ...inventory(checkoutGroupRoute, '/checkout-groups'),
      ...inventory(orderRoute, '/orders'),
      ...inventory(paymentRoute, '/payments'),
      ...inventory(returnRoute, '/returns'),
    ]).toEqual([
      'POST /checkout/',
      'POST /checkout/preview',
      'GET /checkout-groups/:checkoutGroupId',
      'GET /orders/',
      'GET /orders/:orderId',
      'POST /orders/:orderId/checkout',
      'POST /payments/paypal/create',
      'POST /payments/paypal/capture',
      'POST /payments/cod/confirm',
      'POST /returns/',
      'GET /returns/',
      'GET /returns/:returnId',
    ]);
    const mounted = [
      ...inventory(checkoutRoute, '/checkout'),
      ...inventory(checkoutGroupRoute, '/checkout-groups'),
      ...inventory(paymentRoute, '/payments'),
      ...inventory(returnRoute, '/returns'),
    ];
    expect(mounted).not.toEqual(
      expect.arrayContaining([
        'GET /checkout/groups',
        'GET /checkout/groups/:checkoutGroupId',
        'GET /payments/:checkoutGroupId',
        'POST /payments/:checkoutGroupId/paypal/capture',
        'POST /payments/:checkoutGroupId/paypal/fail',
        'POST /return-requests/',
        'GET /return-requests/',
        'PATCH /returns/:returnId',
        'DELETE /returns/:returnId',
      ]),
    );
  });

  it.each([
    [
      'stock deduction',
      '../../src/modules/products/product.repository.js',
      'deductStock',
    ],
    [
      'checkout group creation',
      '../../src/modules/checkout-groups/checkout-group.service.js',
      'create',
    ],
    [
      'order creation',
      '../../src/modules/orders/order.repository.js',
      'createMany',
    ],
    [
      'payment creation',
      '../../src/modules/payments/payment.repository.js',
      'create',
    ],
    [
      'group linking',
      '../../src/modules/checkout-groups/checkout-group.service.js',
      'setOrders',
    ],
    [
      'coupon consumption',
      '../../src/modules/coupons/coupon.service.js',
      'consume',
    ],
    [
      'cart removal',
      '../../src/modules/carts/cart.repository.js',
      'removeSelected',
    ],
    [
      'notification creation',
      '../../src/modules/notifications/repository.js',
      'createUnique',
    ],
  ])(
    'rolls back checkout after injected %s failure',
    async (stage, modulePath, method) => {
      const target = await import(modulePath);
      const agent = await login();
      const item = (await add(agent, ids.productUuid).expect(200)).body.data
        .items[0];
      const coupon = await models.Coupon.create({
        code: 'ROLLBACK',
        description: 'Rollback',
        discountType: 'FIXED_AMOUNT',
        discountValue: 1,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60_000),
        usageLimit: 10,
        perUserLimit: 10,
      });
      vi.spyOn(target, method).mockRejectedValueOnce(
        new Error(`injected ${stage} failure`),
      );
      await mutate(
        agent,
        'post',
        '/checkout',
        checkoutBody([item], { couponCode: 'ROLLBACK' }),
        `rollback-${method}`,
      ).expect(500);
      expect(await models.CheckoutGroup.countDocuments()).toBe(0);
      expect(
        await models.Order.countDocuments({
          checkoutGroupId: { $exists: true },
        }),
      ).toBe(0);
      expect(await models.Payment.countDocuments()).toBe(0);
      expect(await models.CouponUsage.countDocuments()).toBe(0);
      expect(await models.CouponUserUsageCounter.countDocuments()).toBe(0);
      expect((await models.Coupon.findById(coupon._id).lean()).usageCount).toBe(
        0,
      );
      expect((await models.Product.findById(ids.product).lean()).stock).toBe(5);
      expect(
        (await models.Cart.findOne({ userId: ids.buyer }).lean()).items,
      ).toHaveLength(1);
      expect(await models.Notification.countDocuments()).toBe(0);
      expect(
        await models.IdempotencyRecord.findOne({
          key: `rollback-${method}`,
        }).lean(),
      ).toEqual(expect.objectContaining({ status: 'FAILED' }));
    },
  );

  it('fails idempotency completion after resources exist and rolls all of them back', async () => {
    const idempotencyRepository =
      await import('../../src/modules/idempotency/idempotency.repository.js');
    const checkoutGroupRepository =
      await import('../../src/modules/checkout-groups/checkout-group.repository.js');
    const orderRepository =
      await import('../../src/modules/orders/order.repository.js');
    const paymentRepository =
      await import('../../src/modules/payments/payment.repository.js');
    const couponUsageRepository =
      await import('../../src/modules/coupons/coupon-usage.repository.js');
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const coupon = await models.Coupon.create({
      code: 'COMPLETEFAIL',
      description: 'Completion failure',
      discountType: 'FIXED_AMOUNT',
      discountValue: 1,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      usageLimit: 10,
      perUserLimit: 10,
    });
    let observed = false;
    vi.spyOn(idempotencyRepository, 'complete').mockImplementationOnce(
      async (_scope, buyerId, _key, _claimToken, data, session) => {
        const group = await checkoutGroupRepository.findOwned(
          buyerId,
          data.resourceId,
          session,
        );
        const orders = await orderRepository.byGroup(
          buyerId,
          data.resourceId,
          session,
        );
        const payment = await paymentRepository.ownedByGroupInternal(
          buyerId,
          data.resourceId,
          session,
        );
        const usage = await couponUsageRepository.findByCheckoutGroup(
          coupon._id,
          data.resourceId,
          session,
        );
        observed = Boolean(group && orders.length === 1 && payment && usage);
        throw new Error('injected completion failure after resources');
      },
    );
    await mutate(
      agent,
      'post',
      '/checkout',
      checkoutBody([item], { couponCode: 'COMPLETEFAIL' }),
      'completion-after-resources',
    ).expect(500);
    expect(observed).toBe(true);
    expect(await models.CheckoutGroup.countDocuments()).toBe(0);
    expect(
      await models.Order.countDocuments({ checkoutGroupId: { $exists: true } }),
    ).toBe(0);
    expect(await models.Payment.countDocuments()).toBe(0);
    expect(await models.CouponUsage.countDocuments()).toBe(0);
    expect(await models.CouponUserUsageCounter.countDocuments()).toBe(0);
    expect((await models.Coupon.findById(coupon._id).lean()).usageCount).toBe(
      0,
    );
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(5);
    expect(await models.Notification.countDocuments()).toBe(0);
    expect(
      await models.IdempotencyRecord.findOne({
        key: 'completion-after-resources',
      }).lean(),
    ).toEqual(expect.objectContaining({ status: 'FAILED' }));
  });

  it('preserves legacy delivered review and feedback eligibility with multiple same-seller orders', async () => {
    await models.Order.create({
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'DELIVERED',
      items: [{ productId: ids.product2, sellerId: ids.seller, quantity: 1 }],
    });
    expect(
      await models.Order.countDocuments({
        buyerId: ids.buyer,
        sellerId: ids.seller,
        orderStatus: 'DELIVERED',
      }),
    ).toBe(2);
    const agent = await login();
    await mutate(agent, 'post', `/products/${ids.productUuid}/reviews`, {
      orderId: String(ids.deliveredOrder),
      orderItemId: String(ids.deliveredItem),
      rating: 5,
      title: 'Great product',
      description: 'The product was great.',
    }).expect(201);
    await mutate(
      agent,
      'post',
      `/orders/${ids.deliveredOrder}/seller-feedback`,
      { rating: 5, comment: 'Great seller' },
    ).expect(201);
  });
});

describe('Auction win order checkout', () => {
  // A standalone auction / Buy-It-Now win order: PENDING_PAYMENT, no checkout
  // group, no shipping address (mirrors auctions createOrderForWin).
  const createWinOrder = async (buyerId = ids.buyer) => {
    const [order] = await models.Order.create([
      {
        buyerId,
        sellerId: ids.seller,
        orderStatus: 'PENDING_PAYMENT',
        subtotal: 100,
        discount: 0,
        shippingFee: 0,
        total: 100,
        currency: 'VND',
        items: [
          {
            productId: ids.product,
            sellerId: ids.seller,
            quantity: 1,
            title: 'Won item',
            unitPrice: 100,
            itemSubtotal: 100,
          },
        ],
      },
    ]);
    return order;
  };

  it('wraps a win order in a checkout group, stamps the address, and pays via COD', async () => {
    const agent = await login();
    const order = await createWinOrder();

    const checkout = await mutate(
      agent,
      'post',
      `/orders/${order._id}/checkout`,
      { addressId: String(ids.address), paymentMethod: 'COD' },
    ).expect(200);
    const groupId = checkout.body.data._id ?? checkout.body.data.id;
    expect(groupId).toBeTruthy();
    expect(checkout.body.data.total).toBe(100);

    // Order now carries the group + a shipping-address snapshot.
    const wrapped = await models.Order.findById(order._id).lean();
    expect(String(wrapped.checkoutGroupId)).toBe(String(groupId));
    expect(wrapped.shippingAddress.fullName).toBe('Buyer');

    // COD confirm now confirms the win order and creates its shipment.
    await mutate(agent, 'post', '/payments/cod/confirm', {
      checkoutGroupId: groupId,
    }).expect(200);
    const paid = await models.Order.findById(order._id).lean();
    expect(paid.orderStatus).toBe('CONFIRMED');
    expect(paid.deliveredAt).toBeFalsy();
    const shipment = await models.Shipment.findOne({
      orderId: order._id,
    }).lean();
    expect(shipment).toEqual(
      expect.objectContaining({
        status: 'READY_FOR_PICKUP',
        carrier: 'SBay Express',
        shipperId: null,
      }),
    );
  });

  it('is idempotent — a repeated checkout replays the same group', async () => {
    const agent = await login();
    const order = await createWinOrder();
    const body = { addressId: String(ids.address), paymentMethod: 'COD' };
    const first = await mutate(
      agent,
      'post',
      `/orders/${order._id}/checkout`,
      body,
    ).expect(200);
    const second = await mutate(
      agent,
      'post',
      `/orders/${order._id}/checkout`,
      body,
    ).expect(200);
    expect(String(second.body.data._id ?? second.body.data.id)).toBe(
      String(first.body.data._id ?? first.body.data.id),
    );
  });

  it("rejects a foreign order, a missing order, and an address the buyer doesn't own", async () => {
    const agent = await login();
    const order = await createWinOrder();

    // Another buyer cannot check out this order (buyer-scoped) → 404.
    const other = await login('other@example.test');
    await mutate(other, 'post', `/orders/${order._id}/checkout`, {
      addressId: String(ids.otherAddress),
      paymentMethod: 'COD',
    }).expect(404);

    // Address not owned by the buyer → 404.
    await mutate(agent, 'post', `/orders/${order._id}/checkout`, {
      addressId: String(objectId()),
      paymentMethod: 'COD',
    }).expect(404);

    // Nonexistent order → 404.
    await mutate(agent, 'post', `/orders/${objectId()}/checkout`, {
      addressId: String(ids.address),
      paymentMethod: 'COD',
    }).expect(404);
  });
});
