import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
let ids;

const objectId = () => new mongoose.Types.ObjectId();
const csrf = async (agent) => {
  agent.csrfToken = (
    await agent.get(`${prefix}/auth/csrf-token`).expect(200)
  ).body.data.csrfToken;
};
const mutate = (agent, method, path, body) =>
  agent[method](`${prefix}${path}`)
    .set('x-csrf-token', agent.csrfToken)
    .send(body);
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
      orderStatus: 'CONFIRMED',
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
  };
  passwordHash = await modules[10].hashPassword(password);
  signAccess = modules[11].signAccess;
  await Promise.all(Object.values(models).map((model) => model.init()));
  ({ app } = await import('../../src/app.js'));
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
