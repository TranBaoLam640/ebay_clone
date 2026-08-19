import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const prefix = '/api/v1';
const password = 'Strong1!Password';
let app;
let database;
let mongo;
let models;
let passwordHash;
let ids;

const csrf = async (agent) => {
  agent.csrfToken = (
    await agent.get(`${prefix}/auth/csrf-token`).expect(200)
  ).body.data.csrfToken;
  return agent.csrfToken;
};

const mutate = (agent, method, path, body) => {
  const operation = agent[method](`${prefix}${path}`).set(
    'x-csrf-token',
    agent.csrfToken,
  );
  return body === undefined ? operation : operation.send(body);
};

const login = async (email = 'buyer@example.test') => {
  const agent = request.agent(app);
  await csrf(agent);
  await mutate(agent, 'post', '/auth/login', { email, password }).expect(200);
  return agent;
};

const seed = async () => {
  const objectId = () => new mongoose.Types.ObjectId();
  ids = {
    buyer: objectId(),
    otherBuyer: objectId(),
    sellerUser: objectId(),
    sellerUser2: objectId(),
    seller: objectId(),
    seller2: objectId(),
    category: objectId(),
    product: objectId(),
    product2: objectId(),
    lowStock: objectId(),
    outOfStock: objectId(),
    hidden: objectId(),
    address: objectId(),
    otherAddress: objectId(),
    // Public product uuids — stable fixed strings used at the API boundary.
    productUuid: '11111111-1111-4111-a111-111111111111',
    product2Uuid: '22222222-2222-4222-a222-222222222222',
    lowStockUuid: '33333333-3333-4333-a333-333333333333',
    outOfStockUuid: '44444444-4444-4444-a444-444444444444',
    hiddenUuid: '55555555-5555-4555-a555-555555555555',
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
  await models.Product.create([
    {
      _id: ids.product,
      uuid: ids.productUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'One',
      description: 'One',
      price: 101,
      stock: 10,
      images: ['https://example.test/one.png'],
      status: 'ACTIVE',
    },
    {
      _id: ids.product2,
      uuid: ids.product2Uuid,
      sellerId: ids.seller2,
      categoryId: ids.category,
      title: 'Two',
      description: 'Two',
      price: 200,
      stock: 10,
      status: 'ACTIVE',
    },
    {
      _id: ids.lowStock,
      uuid: ids.lowStockUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Low',
      description: 'Low',
      price: 50,
      stock: 2,
      status: 'ACTIVE',
    },
    {
      _id: ids.outOfStock,
      uuid: ids.outOfStockUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Gone',
      description: 'Gone',
      price: 25,
      stock: 0,
      status: 'OUT_OF_STOCK',
    },
    {
      _id: ids.hidden,
      uuid: ids.hiddenUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Hidden',
      description: 'Hidden',
      price: 10,
      stock: 1,
      status: 'HIDDEN',
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
};

const add = (agent, productId, quantity = 1) =>
  mutate(agent, 'post', '/cart/items', {
    productId: String(productId),
    quantity,
  });

const executeCheckout = (agent, body, key = crypto.randomUUID()) =>
  agent
    .post(`${prefix}/checkout`)
    .set('x-csrf-token', agent.csrfToken)
    .set('Idempotency-Key', key)
    .send(body);

const acceptedOffer = async (overrides = {}) => {
  const conversation =
    overrides.conversationId === undefined
      ? await models.Conversation.create({
          buyerId: overrides.buyerId ?? ids.buyer,
          sellerId: overrides.sellerId ?? ids.seller,
          productId: overrides.productId ?? ids.product,
          type: 'PRE_PURCHASE',
          lastMessageAt: new Date(),
        })
      : null;
  const offer = await models.Offer.create({
    conversationId: overrides.conversationId ?? conversation._id,
    productId: ids.product,
    buyerId: ids.buyer,
    sellerId: ids.seller,
    createdBy: ids.sellerUser,
    originalPrice: 101,
    amount: 88,
    quantity: 1,
    status: 'ACCEPTED',
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  });
  return { conversation, offer };
};

const coupon = (overrides = {}) => ({
  code: 'SAVE15',
  description: 'Save',
  discountType: 'PERCENTAGE',
  discountValue: 15,
  minOrderValue: 0,
  maxDiscount: null,
  startsAt: new Date(Date.now() - 60_000),
  expiresAt: new Date(Date.now() + 60_000),
  status: 'ACTIVE',
  ...overrides,
});

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 120000 }],
  });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  const [
    { User },
    { Category },
    { SellerProfile },
    { Product },
    { Address },
    { Cart },
    { Coupon },
    { CouponUsage },
    { Order },
    { Offer },
    { Conversation },
    { Notification },
    { hashPassword },
  ] = await Promise.all([
    import('../../src/modules/users/user.model.js'),
    import('../../src/modules/categories/category.model.js'),
    import('../../src/modules/sellers/seller-profile.model.js'),
    import('../../src/modules/products/product.model.js'),
    import('../../src/modules/addresses/address.model.js'),
    import('../../src/modules/carts/cart.model.js'),
    import('../../src/modules/coupons/coupon.model.js'),
    import('../../src/modules/coupons/coupon-usage.model.js'),
    import('../../src/modules/orders/order.model.js'),
    import('../../src/modules/offers/offer.model.js'),
    import('../../src/modules/conversations/conversation.model.js'),
    import('../../src/modules/notifications/notification.model.js'),
    import('../../src/common/utils/hash.js'),
  ]);
  models = {
    User,
    Category,
    SellerProfile,
    Product,
    Address,
    Cart,
    Coupon,
    CouponUsage,
    Order,
    Offer,
    Conversation,
    Notification,
  };
  passwordHash = await hashPassword(password);
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

describe('User 3 cart, coupon, and checkout preview', () => {
  it('requires authentication and CSRF', async () => {
    await request(app).get(`${prefix}/cart`).expect(401);
    const agent = await login();
    await agent
      .post(`${prefix}/cart/items`)
      .send({ productId: ids.productUuid, quantity: 1 })
      .expect(403);
  });

  it('returns an empty cart without creating process or database state', async () => {
    const agent = await login();
    expect((await agent.get(`${prefix}/cart`).expect(200)).body.data).toEqual({
      id: null,
      items: [],
      subtotal: 0,
      totalQuantity: 0,
    });
    expect(await models.Cart.countDocuments()).toBe(0);
  });

  it('adds, hydrates, absolutely updates, removes, and clears items', async () => {
    const agent = await login();
    const created = await add(agent, ids.productUuid, 2).expect(200);
    expect(created.body.data).toEqual(
      expect.objectContaining({ subtotal: 202, totalQuantity: 2 }),
    );
    expect(created.body.data.items[0]).toEqual(
      expect.objectContaining({
        product: expect.objectContaining({
          title: 'One',
          primaryImage: 'https://example.test/one.png',
          price: 101,
          stock: 10,
          seller: { id: String(ids.seller), displayName: 'Alpha' },
        }),
        itemSubtotal: 202,
      }),
    );
    await mutate(agent, 'patch', `/cart/items/${ids.productUuid}`, {
      quantity: 3,
    })
      .expect(200)
      .expect((response) => expect(response.body.data.totalQuantity).toBe(3));
    await mutate(agent, 'delete', `/cart/items/${ids.productUuid}`)
      .expect(200)
      .expect((response) => expect(response.body.data.items).toEqual([]));
    await add(agent, ids.productUuid).expect(200);
    await mutate(agent, 'delete', '/cart')
      .expect(200)
      .expect((response) => expect(response.body.data.items).toEqual([]));
    expect(await models.Cart.countDocuments({ userId: ids.buyer })).toBe(1);
  });

  it('returns a nested safe Product DTO while Cart persists raw references only', async () => {
    const agent = await login();
    const response = await add(agent, ids.productUuid, 2).expect(200);
    expect(response.body.data.items[0].product).toEqual({
      id: ids.productUuid,
      title: 'One',
      primaryImage: 'https://example.test/one.png',
      price: 101,
      stock: 10,
      status: 'ACTIVE',
      seller: { id: String(ids.seller), displayName: 'Alpha' },
    });
    const raw = await models.Cart.collection.findOne({ userId: ids.buyer });
    expect(raw.items[0]).toEqual(
      expect.objectContaining({ productId: ids.product, quantity: 2 }),
    );
    for (const field of [
      'title',
      'primaryImage',
      'price',
      'stock',
      'status',
      'seller',
      'purchasable',
    ])
      expect(response.body.data.items[0]).not.toHaveProperty(field);
    for (const field of [
      'product',
      'title',
      'primaryImage',
      'price',
      'stock',
      'status',
      'seller',
      'purchasable',
      'itemSubtotal',
    ])
      expect(raw.items[0]).not.toHaveProperty(field);
  });

  it('accumulates duplicate adds and rejects missing, invalid, unavailable, out-of-stock, and overstock mutations', async () => {
    const agent = await login();
    await add(agent, ids.productUuid).expect(200);
    // Adding the same product again stacks onto the existing quantity (1 + 4).
    await add(agent, ids.productUuid, 4)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0].quantity).toBe(5);
        expect(response.body.data.totalQuantity).toBe(5);
      });
    await mutate(agent, 'patch', `/cart/items/${ids.product2Uuid}`, {
      quantity: 1,
    }).expect(404);
    await mutate(agent, 'delete', `/cart/items/${ids.product2Uuid}`).expect(
      404,
    );
    await add(agent, ids.hiddenUuid).expect(409);
    await add(agent, ids.outOfStockUuid).expect(409);
    await add(agent, ids.lowStockUuid, 3).expect(409);
    await add(agent, ids.lowStockUuid, 0).expect(400);
  });

  it('syncs server and local items with deterministic normalization, adjustment, and omission warnings', async () => {
    const agent = await login();
    await add(agent, ids.productUuid, 2).expect(200);
    const response = await mutate(agent, 'post', '/cart/sync', {
      items: [
        { productId: ids.productUuid, quantity: 1 },
        { productId: ids.lowStockUuid, quantity: 1 },
        { productId: ids.lowStockUuid, quantity: 5 },
        { productId: ids.outOfStockUuid, quantity: 1 },
        { productId: ids.hiddenUuid, quantity: 1 },
      ],
    }).expect(200);
    expect(
      response.body.data.items.map(({ productId, quantity }) => ({
        productId,
        quantity,
      })),
    ).toEqual(
      [
        { productId: ids.productUuid, quantity: 2 },
        { productId: ids.lowStockUuid, quantity: 2 },
      ].sort((a, b) => a.productId.localeCompare(b.productId)),
    );
    expect(response.body.data.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'DUPLICATE_LOCAL_ITEM_NORMALIZED',
        'QUANTITY_ADJUSTED',
        'PRODUCT_OUT_OF_STOCK',
        'PRODUCT_UNAVAILABLE',
      ]),
    );
  });

  it('warns for stale server-only inactive, deleted, and out-of-stock products', async () => {
    const agent = await login();
    const rawMissingProductId = new mongoose.Types.ObjectId();
    await models.Cart.create({
      userId: ids.buyer,
      items: [
        { productId: ids.hidden, quantity: 1 },
        { productId: ids.outOfStock, quantity: 1 },
        { productId: rawMissingProductId, quantity: 1 },
      ],
    });
    const response = await mutate(agent, 'post', '/cart/sync', {
      items: [],
    }).expect(200);
    expect(response.body.data.items).toEqual([]);
    expect(response.body.data.warnings).toEqual(
      [
        {
          code: 'PRODUCT_UNAVAILABLE',
          productId: String(ids.hidden),
          requested: 1,
          final: 0,
        },
        {
          code: 'PRODUCT_UNAVAILABLE',
          productId: String(rawMissingProductId),
          requested: 1,
          final: 0,
        },
        {
          code: 'PRODUCT_OUT_OF_STOCK',
          productId: String(ids.outOfStock),
          requested: 1,
          final: 0,
        },
      ].sort((left, right) => left.productId.localeCompare(right.productId)),
    );
    expect(
      response.body.data.warnings
        .filter((warning) => warning.code === 'PRODUCT_UNAVAILABLE')
        .map((warning) => warning.productId)
        .sort(),
    ).toEqual([String(ids.hidden), String(rawMissingProductId)].sort());
  });

  it('sync is idempotent and warnings are not persisted', async () => {
    const agent = await login();
    const body = { items: [{ productId: ids.lowStockUuid, quantity: 9 }] };
    const first = await mutate(agent, 'post', '/cart/sync', body).expect(200);
    const second = await mutate(agent, 'post', '/cart/sync', body).expect(200);
    expect(second.body.data.items).toEqual(first.body.data.items);
    expect(
      (await agent.get(`${prefix}/cart`).expect(200)).body.data,
    ).not.toHaveProperty('warnings');
    expect(
      await models.Cart.findOne({ userId: ids.buyer }).lean(),
    ).not.toHaveProperty('warnings');
  });

  it('serializes concurrent syncs without losing either local item', async () => {
    const agent = await login();
    const [one, two] = await Promise.all([
      mutate(agent, 'post', '/cart/sync', {
        items: [{ productId: ids.productUuid, quantity: 1 }],
      }),
      mutate(agent, 'post', '/cart/sync', {
        items: [{ productId: ids.product2Uuid, quantity: 1 }],
      }),
    ]);
    expect([one.status, two.status]).toEqual([200, 200]);
    const cart = await agent.get(`${prefix}/cart`).expect(200);
    expect(cart.body.data.items.map((item) => item.productId).sort()).toEqual(
      [ids.productUuid, ids.product2Uuid].sort(),
    );
  });

  it('keeps one cart item when duplicate adds race', async () => {
    const agent = await login();
    const responses = await Promise.all([
      add(agent, ids.productUuid),
      add(agent, ids.productUuid),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      (await models.Cart.findOne({ userId: ids.buyer }).lean()).items,
    ).toHaveLength(1);
  });

  it('validates coupon math case-insensitively from selected current cart prices', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 2).expect(200)).body.data
      .items[0];
    await models.Coupon.create(coupon());
    const response = await mutate(agent, 'post', '/coupons/validate', {
      code: 'save15',
      selectedCartItemIds: [item.id],
    }).expect(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({ code: 'SAVE15', subtotal: 202, discount: 30 }),
    );
  });

  it('enforces coupon existence, status, dates, minimum, global limit, and buyer limit', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const validate = (code) =>
      mutate(agent, 'post', '/coupons/validate', {
        code,
        selectedCartItemIds: [item.id],
      });
    await validate('MISSING').expect(409);
    await models.Coupon.create(
      coupon({ code: 'INACTIVE', status: 'INACTIVE' }),
    );
    await validate('INACTIVE').expect(409);
    await models.Coupon.create(
      coupon({
        code: 'FUTURE',
        startsAt: new Date(Date.now() + 60_000),
        expiresAt: new Date(Date.now() + 120_000),
      }),
    );
    await validate('FUTURE').expect(409);
    await models.Coupon.create(
      coupon({
        code: 'EXPIRED',
        startsAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );
    await validate('EXPIRED').expect(409);
    await models.Coupon.create(coupon({ code: 'MINIMUM', minOrderValue: 102 }));
    await validate('MINIMUM').expect(409);
    await models.Coupon.create(
      coupon({ code: 'GLOBAL', usageLimit: 1, usageCount: 1 }),
    );
    await validate('GLOBAL').expect(409);
    const limited = await models.Coupon.create(
      coupon({ code: 'BUYER', perUserLimit: 1 }),
    );
    await models.CouponUsage.create({
      couponId: limited._id,
      buyerId: ids.buyer,
      checkoutGroupId: new mongoose.Types.ObjectId(),
      orderIds: [new mongoose.Types.ObjectId()],
    });
    await validate('BUYER').expect(409);
  });

  it('rejects stale-low global count when legacy usage history exhausts validate and preview', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const exhausted = await models.Coupon.create(
      coupon({
        code: 'LEGACYEXHAUSTED',
        usageLimit: 2,
        usageCount: 0,
      }),
    );
    await models.CouponUsage.create([
      {
        couponId: exhausted._id,
        buyerId: ids.otherBuyer,
        checkoutGroupId: new mongoose.Types.ObjectId(),
        orderIds: [new mongoose.Types.ObjectId()],
      },
      {
        couponId: exhausted._id,
        buyerId: ids.otherBuyer,
        checkoutGroupId: new mongoose.Types.ObjectId(),
        orderIds: [new mongoose.Types.ObjectId()],
      },
    ]);
    await mutate(agent, 'post', '/coupons/validate', {
      code: 'LEGACYEXHAUSTED',
      selectedCartItemIds: [item.id],
    })
      .expect(409)
      .expect((response) =>
        expect(response.body.error.code).toBe('COUPON_USAGE_LIMIT_REACHED'),
      );
    await mutate(agent, 'post', '/checkout/preview', {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      couponCode: 'LEGACYEXHAUSTED',
      paymentMethod: 'COD',
    })
      .expect(409)
      .expect((response) =>
        expect(response.body.error.code).toBe('COUPON_USAGE_LIMIT_REACHED'),
      );
    expect(
      (await models.Coupon.findById(exhausted._id).lean()).usageCount,
    ).toBe(0);
    expect(
      await models.CouponUsage.countDocuments({ couponId: exhausted._id }),
    ).toBe(2);
  });

  it('rejects foreign, duplicate, missing, and unavailable coupon selections without writes', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    await models.Coupon.create(coupon());
    const count = await models.CouponUsage.countDocuments();
    await mutate(agent, 'post', '/coupons/validate', {
      code: 'SAVE15',
      selectedCartItemIds: [String(new mongoose.Types.ObjectId())],
    }).expect(409);
    await mutate(agent, 'post', '/coupons/validate', {
      code: 'SAVE15',
      selectedCartItemIds: [item.id, item.id],
    }).expect(409);
    await models.Product.updateOne({ _id: ids.product }, { status: 'HIDDEN' });
    await mutate(agent, 'post', '/coupons/validate', {
      code: 'SAVE15',
      selectedCartItemIds: [item.id],
    }).expect(409);
    expect(await models.CouponUsage.countDocuments()).toBe(count);
  });

  it('previews current prices, groups sellers, and allocates one deterministic discount', async () => {
    const agent = await login();
    const first = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    const second = (
      await add(agent, ids.product2Uuid).expect(200)
    ).body.data.items.find((item) => item.productId === ids.product2Uuid);
    await models.Product.updateOne({ _id: ids.product }, { price: 100 });
    await models.Address.collection.updateOne(
      { _id: ids.address },
      { $set: { internalSecret: 'hidden' } },
    );
    await models.Coupon.create(
      coupon({
        code: 'FIXED',
        discountType: 'FIXED_AMOUNT',
        discountValue: 100,
      }),
    );
    const response = await mutate(agent, 'post', '/checkout/preview', {
      selectedCartItemIds: [first.id, second.id],
      addressId: String(ids.address),
      couponCode: 'FIXED',
      paymentMethod: 'PAYPAL',
    }).expect(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        subtotal: 300,
        discount: 100,
        total: 200,
        currency: 'VND',
        shippingFee: 0,
        paymentMethods: ['COD', 'PAYPAL'],
        selectedPaymentMethod: 'PAYPAL',
        stockWarnings: [],
      }),
    );
    expect(response.body.data.address).toEqual({
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
      expect(response.body.data.address).not.toHaveProperty(forbidden);
    expect(response.body.data.sellerGroups).toHaveLength(2);
    expect(
      response.body.data.sellerGroups.reduce(
        (sum, group) => sum + group.discount,
        0,
      ),
    ).toBe(100);
    expect(
      response.body.data.sellerGroups.map((group) => group.sellerId),
    ).toEqual(
      [
        ...response.body.data.sellerGroups.map((group) => group.sellerId),
      ].sort(),
    );
  });

  it('rejects invalid checkout ownership, selection, availability, and stock', async () => {
    const agent = await login();
    const item = (await add(agent, ids.lowStockUuid, 2).expect(200)).body.data
      .items[0];
    const preview = (overrides = {}) =>
      mutate(agent, 'post', '/checkout/preview', {
        selectedCartItemIds: [item.id],
        addressId: String(ids.address),
        paymentMethod: 'COD',
        ...overrides,
      });
    await preview({ addressId: String(ids.otherAddress) }).expect(404);
    await preview({
      selectedCartItemIds: [String(new mongoose.Types.ObjectId())],
    }).expect(409);
    await models.Product.updateOne({ _id: ids.lowStock }, { stock: 1 });
    await preview().expect(409);
    await models.Product.updateOne({ _id: ids.lowStock }, { status: 'HIDDEN' });
    await preview().expect(409);
  });

  it('checkout preview is stateless across all business collections', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid).expect(200)).body.data
      .items[0];
    await models.Coupon.create(coupon());
    const before = {};
    for (const [name, model] of Object.entries(models))
      before[name] = await model.collection.find({}).sort({ _id: 1 }).toArray();
    await mutate(agent, 'post', '/checkout/preview', {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      couponCode: 'SAVE15',
      paymentMethod: 'COD',
    }).expect(200);
    for (const [name, model] of Object.entries(models))
      expect(
        await model.collection.find({}).sort({ _id: 1 }).toArray(),
      ).toEqual(before[name]);
  });

  it('exposes checkout execution with strict request validation', async () => {
    const agent = await login();
    await mutate(agent, 'post', '/checkout', {}).expect(400);
  });

  it('accepted offer checkout uses offer price, snapshots it on order, and upgrades conversation', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 1).expect(200)).body.data
      .items[0];
    const { conversation, offer } = await acceptedOffer();

    const response = await executeCheckout(agent, {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: String(offer._id),
    }).expect(201);

    expect(response.body.data).toEqual(
      expect.objectContaining({ subtotal: 88, total: 88 }),
    );
    const order = await models.Order.findById(
      response.body.data.orders[0]._id,
    ).lean();
    expect(order).toEqual(
      expect.objectContaining({
        subtotal: 88,
        total: 88,
        offerId: offer._id,
      }),
    );
    expect(order.items[0]).toEqual(
      expect.objectContaining({
        unitPrice: 88,
        itemSubtotal: 88,
        offerId: offer._id,
        originalPrice: 101,
        finalPrice: 88,
      }),
    );
    expect(await models.Offer.findById(offer._id).lean()).toEqual(
      expect.objectContaining({
        status: 'PURCHASED',
        orderId: order._id,
      }),
    );
    expect(await models.Conversation.findById(conversation._id).lean()).toEqual(
      expect.objectContaining({
        type: 'POST_PURCHASE',
        orderId: order._id,
      }),
    );
  });

  it('rejects tampered price and invalid offer checkout states', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 1).expect(200)).body.data
      .items[0];
    const { offer } = await acceptedOffer();

    await executeCheckout(agent, {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: String(offer._id),
      finalPrice: 1,
    }).expect(400);

    for (const status of ['PENDING', 'DECLINED', 'COUNTERED', 'EXPIRED']) {
      const { offer: invalid } = await acceptedOffer({
        _id: new mongoose.Types.ObjectId(),
        conversationId: new mongoose.Types.ObjectId(),
        status,
      });
      await executeCheckout(agent, {
        selectedCartItemIds: [item.id],
        addressId: String(ids.address),
        paymentMethod: 'COD',
        offerId: String(invalid._id),
      }).expect(409);
    }
  });

  it('rejects wrong buyer, wrong product, and reused accepted offers', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 1).expect(200)).body.data
      .items[0];
    const wrongBuyer = await acceptedOffer({
      buyerId: ids.otherBuyer,
      _id: new mongoose.Types.ObjectId(),
      conversationId: new mongoose.Types.ObjectId(),
    });
    await executeCheckout(agent, {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: String(wrongBuyer.offer._id),
    }).expect(403);

    const wrongProduct = await acceptedOffer({
      productId: ids.product2,
      sellerId: ids.seller2,
      _id: new mongoose.Types.ObjectId(),
      conversationId: new mongoose.Types.ObjectId(),
    });
    await executeCheckout(agent, {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: String(wrongProduct.offer._id),
    }).expect(409);

    const { offer } = await acceptedOffer();
    await executeCheckout(agent, {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: String(offer._id),
    }).expect(201);
    await add(agent, ids.productUuid, 1).expect(200);
    const freshCart = await agent.get(`${prefix}/cart`).expect(200);
    await executeCheckout(agent, {
      selectedCartItemIds: [freshCart.body.data.items[0].id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: String(offer._id),
    }).expect(409);
  });

  it('normal checkout execution still uses current product price', async () => {
    const agent = await login();
    const item = (await add(agent, ids.productUuid, 2).expect(200)).body.data
      .items[0];
    const response = await executeCheckout(agent, {
      selectedCartItemIds: [item.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
    }).expect(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({ subtotal: 202, total: 202 }),
    );
    const order = await models.Order.findById(
      response.body.data.orders[0]._id,
    ).lean();
    expect(order.items[0]).toEqual(
      expect.objectContaining({ unitPrice: 101, itemSubtotal: 202 }),
    );
    expect(order.offerId).toBeUndefined();
  });
});
