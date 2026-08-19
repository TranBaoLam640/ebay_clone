import {
  afterAll,
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

const prefix = '/api/v1';
const password = 'Strong1!Password';
const { storageSend } = vi.hoisted(() => ({ storageSend: vi.fn() }));
let app;
let database;
let mongo;
let passwordHash;
let models;
let ids;
let sellerFeedbackService;

vi.mock('../../src/modules/uploads/storage-client.js', () => ({
  isStorageConfigured: true,
  storageClient: { send: storageSend },
  publicBaseUrl: 'https://cdn.example.test/sbay',
}));

const csrf = async (agent) =>
  (await agent.get(`${prefix}/auth/csrf-token`).expect(200)).body.data
    .csrfToken;

const mutate = async (agent, method, path, body) => {
  const token = await csrf(agent);
  const operation = agent[method](`${prefix}${path}`).set(
    'x-csrf-token',
    token,
  );
  return body === undefined ? operation : operation.send(body);
};

const uploadFeedback = async (agent, orderId, orderItemId, fields, files) => {
  const token = await csrf(agent);
  const operation = agent
    .post(`${prefix}/orders/${orderId}/items/${orderItemId}/seller-feedback`)
    .set('x-csrf-token', token);
  for (const [name, value] of Object.entries(fields))
    operation.field(name, String(value));
  for (const file of files)
    operation.attach('images', Buffer.alloc(file.size ?? 32, 'x'), {
      filename: file.name,
      contentType: file.mime,
    });
  return operation;
};

const login = async (email) => {
  const agent = request.agent(app);
  const response = await mutate(agent, 'post', '/auth/login', {
    email,
    password,
  });
  expect(response.status).toBe(200);
  return agent;
};

const reviewInput = (orderId = ids.order, orderItemId = ids.orderItem) => ({
  orderId: String(orderId),
  orderItemId: String(orderItemId),
  rating: 5,
  comment: 'Excellent product',
});

const feedbackInput = (overrides = {}) => ({
  commentType: 'POSITIVE',
  commentText: 'Reliable seller',
  itemAsDescribedRating: 5,
  communicationRating: 5,
  shippingTimeRating: 5,
  shippingAndHandlingChargesRating: 4,
  ...overrides,
});

const createDeliveredOrderItem = async ({
  buyerId = ids.buyer,
  sellerId = ids.seller,
  productId = ids.product,
  createdAt = new Date(),
  deliveredAt,
} = {}) => {
  const orderId = new mongoose.Types.ObjectId();
  const orderItemId = new mongoose.Types.ObjectId();
  await models.Order.create({
    _id: orderId,
    buyerId,
    sellerId,
    orderStatus: 'DELIVERED',
    ...(deliveredAt && { deliveredAt }),
    items: [
      {
        _id: orderItemId,
        productId,
        sellerId,
        quantity: 1,
      },
    ],
  });
  await models.Order.updateOne(
    { _id: orderId },
    {
      $set: {
        createdAt,
        updatedAt: createdAt,
        ...(deliveredAt && { deliveredAt }),
      },
    },
  );
  return { orderId, orderItemId };
};

const seed = async () => {
  const objectId = () => new mongoose.Types.ObjectId();
  ids = {
    buyer: objectId(),
    otherBuyer: objectId(),
    sellerUser: objectId(),
    inactiveSellerUser: objectId(),
    seller: objectId(),
    inactiveSeller: objectId(),
    category: objectId(),
    categoryUuid: '10000000-0000-4000-8000-000000000001',
    childCategory: objectId(),
    childCategoryUuid: '10000000-0000-4000-8000-000000000002',
    inactiveCategory: objectId(),
    inactiveCategoryUuid: '10000000-0000-4000-8000-000000000003',
    product: objectId(),
    productUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    outOfStockProduct: objectId(),
    outOfStockProductUuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    draftProduct: objectId(),
    draftProductUuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    hiddenProduct: objectId(),
    hiddenProductUuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    deletedProduct: objectId(),
    deletedProductUuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    inactiveSellerProduct: objectId(),
    inactiveSellerProductUuid: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    inactiveCategoryProduct: objectId(),
    inactiveCategoryProductUuid: '11111111-1111-4111-8111-111111111111',
    order: objectId(),
    orderItem: objectId(),
    selfOrder: objectId(),
    selfOrderItem: objectId(),
  };

  await models.User.create([
    {
      _id: ids.buyer,
      email: 'buyer@example.test',
      passwordHash,
      fullName: 'Buyer One',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.otherBuyer,
      email: 'other@example.test',
      passwordHash,
      fullName: 'Buyer Two',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.sellerUser,
      email: 'seller@example.test',
      passwordHash,
      fullName: 'Seller Owner',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.inactiveSellerUser,
      email: 'inactive-seller@example.test',
      passwordHash,
      fullName: 'Inactive Seller Owner',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
  ]);
  await models.Category.create([
    {
      _id: ids.category,
      uuid: ids.categoryUuid,
      name: 'Electronics',
      slug: 'electronics',
      status: 'ACTIVE',
    },
    {
      _id: ids.childCategory,
      uuid: ids.childCategoryUuid,
      name: 'Laptops',
      slug: 'laptops',
      parentId: ids.category,
      status: 'ACTIVE',
    },
    {
      _id: ids.inactiveCategory,
      uuid: ids.inactiveCategoryUuid,
      name: 'Archived',
      slug: 'archived',
      status: 'INACTIVE',
    },
  ]);
  await models.SellerProfile.create([
    {
      _id: ids.seller,
      userId: ids.sellerUser,
      displayName: 'Trusted Tech',
      avatarUrl: 'https://example.test/seller.png',
      description: 'Public seller description',
      status: 'ACTIVE',
    },
    {
      _id: ids.inactiveSeller,
      userId: ids.inactiveSellerUser,
      displayName: 'Closed Shop',
      status: 'INACTIVE',
    },
  ]);
  await models.Product.create([
    {
      _id: ids.product,
      uuid: ids.productUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Precision Laptop',
      description: 'Portable developer workstation',
      price: 2500,
      stock: 4,
      images: ['https://example.test/laptop.png'],
      attributes: [
        {
          name: 'Color',
          normalizedName: 'color',
          dataType: 'string',
          value: 'silver',
        },
        {
          name: 'Weight',
          normalizedName: 'weight',
          dataType: 'number',
          value: 1.75,
          unit: 'kg',
        },
        {
          name: 'Touchscreen',
          normalizedName: 'touchscreen',
          dataType: 'boolean',
          value: true,
        },
        {
          name: 'Released',
          normalizedName: 'released',
          dataType: 'date',
          value: '2026-01-15T10:30:00.000Z',
        },
      ],
      status: 'ACTIVE',
      offersEnabled: true,
    },
    {
      _id: ids.outOfStockProduct,
      uuid: ids.outOfStockProductUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Wireless Headphones',
      description: 'Noise cancelling audio',
      price: 300,
      stock: 0,
      status: 'OUT_OF_STOCK',
    },
    {
      _id: ids.draftProduct,
      uuid: ids.draftProductUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Draft Laptop',
      description: 'Not yet published',
      price: 80,
      stock: 1,
      status: 'DRAFT',
    },
    {
      _id: ids.hiddenProduct,
      uuid: ids.hiddenProductUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Hidden Laptop',
      description: 'Not buyer visible',
      price: 100,
      stock: 1,
      status: 'HIDDEN',
    },
    {
      _id: ids.deletedProduct,
      uuid: ids.deletedProductUuid,
      sellerId: ids.seller,
      categoryId: ids.category,
      title: 'Deleted Laptop',
      description: 'Removed from sale',
      price: 70,
      stock: 1,
      status: 'DELETED',
    },
    {
      _id: ids.inactiveSellerProduct,
      uuid: ids.inactiveSellerProductUuid,
      sellerId: ids.inactiveSeller,
      categoryId: ids.category,
      title: 'Closed Shop Laptop',
      description: 'Not buyer visible',
      price: 100,
      stock: 1,
      status: 'ACTIVE',
    },
    {
      _id: ids.inactiveCategoryProduct,
      uuid: ids.inactiveCategoryProductUuid,
      sellerId: ids.seller,
      categoryId: ids.inactiveCategory,
      title: 'Archived Laptop',
      description: 'Not buyer visible',
      price: 100,
      stock: 1,
      status: 'ACTIVE',
    },
  ]);
  await models.Order.create([
    {
      _id: ids.order,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'DELIVERED',
      items: [
        {
          _id: ids.orderItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
        },
      ],
    },
    {
      _id: ids.selfOrder,
      buyerId: ids.sellerUser,
      sellerId: ids.seller,
      orderStatus: 'DELIVERED',
      items: [
        {
          _id: ids.selfOrderItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
        },
      ],
    },
  ]);
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  const [
    { User },
    { Category },
    { SellerProfile },
    { Product },
    { Order },
    { ProductReview },
    { SellerFeedback },
    { hashPassword },
  ] = await Promise.all([
    import('../../src/modules/users/user.model.js'),
    import('../../src/modules/categories/category.model.js'),
    import('../../src/modules/sellers/seller-profile.model.js'),
    import('../../src/modules/products/product.model.js'),
    import('../../src/modules/orders/order.model.js'),
    import('../../src/modules/product-reviews/product-review.model.js'),
    import('../../src/modules/seller-feedbacks/seller-feedback.model.js'),
    import('../../src/common/utils/hash.js'),
  ]);
  models = {
    User,
    Category,
    SellerProfile,
    Product,
    Order,
    ProductReview,
    SellerFeedback,
  };
  passwordHash = await hashPassword(password);
  await Promise.all(Object.values(models).map((model) => model.init()));
  sellerFeedbackService =
    await import('../../src/modules/seller-feedbacks/seller-feedback.service.js');
  ({ app } = await import('../../src/app.js'));
});

beforeEach(async () => {
  vi.restoreAllMocks();
  storageSend.mockReset();
  storageSend.mockResolvedValue({});
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  await seed();
});

afterAll(async () => {
  await database.disconnectDatabase();
  await mongo.stop();
});

describe('User 2 catalog and reputation', () => {
  it('shows only buyer-visible catalog results and supports search and detail', async () => {
    const list = await request(app).get(`${prefix}/products`).expect(200);
    expect(list.body.data.map((item) => item.id)).toEqual(
      expect.arrayContaining([ids.productUuid, ids.outOfStockProductUuid]),
    );
    expect(list.body.data).toHaveLength(2);

    const search = await request(app)
      .get(`${prefix}/products?search=Laptop`)
      .expect(200);
    expect(search.body.data.map((item) => item.id)).toEqual([ids.productUuid]);

    const detail = await request(app)
      .get(`${prefix}/products/${ids.productUuid}`)
      .expect(200);
    expect(detail.body.data).toEqual(
      expect.objectContaining({
        id: ids.productUuid,
        title: 'Precision Laptop',
        description: 'Portable developer workstation',
        recentReviews: [],
        seller: expect.objectContaining({
          id: String(ids.seller),
          displayName: 'Trusted Tech',
        }),
      }),
    );
    await request(app)
      .get(`${prefix}/products/${ids.hiddenProductUuid}`)
      .expect(404);
  });

  it('lists active categories with parent filtering and rejects inactive or invalid details', async () => {
    const all = await request(app).get(`${prefix}/categories`).expect(200);
    expect(all.body.data.map((item) => item.id)).toEqual([
      ids.categoryUuid,
      ids.childCategoryUuid,
    ]);
    const children = await request(app)
      .get(`${prefix}/categories?parentId=${ids.categoryUuid}`)
      .expect(200);
    expect(children.body.data.map((item) => item.id)).toEqual([
      ids.childCategoryUuid,
    ]);
    expect(children.body.data[0].parentId).toBe(ids.categoryUuid);
    const detail = await request(app)
      .get(`${prefix}/categories/${ids.categoryUuid}`)
      .expect(200);
    expect(detail.body.data.id).toBe(ids.categoryUuid);
    await request(app)
      .get(`${prefix}/categories/${ids.inactiveCategoryUuid}`)
      .expect(404);
    await request(app).get(`${prefix}/categories/not-an-id`).expect(400);
  });

  it('supports product filters, exact pagination, all sorts, and visibility rules', async () => {
    const defaultList = await request(app)
      .get(`${prefix}/products`)
      .expect(200);
    expect(defaultList.body.meta).toEqual({
      page: 1,
      limit: 20,
      totalItems: 2,
      totalPages: 1,
    });
    const custom = await request(app)
      .get(`${prefix}/products?page=2&limit=1`)
      .expect(200);
    expect(custom.body.meta).toEqual({
      page: 2,
      limit: 1,
      totalItems: 2,
      totalPages: 2,
    });
    await request(app).get(`${prefix}/products?limit=101`).expect(400);
    await request(app)
      .get(`${prefix}/products?minPrice=400&maxPrice=200`)
      .expect(400);
    await models.Product.collection.updateOne(
      { _id: ids.product },
      { $set: { createdAt: new Date('2026-01-01T00:00:00.000Z') } },
    );
    await models.Product.collection.updateOne(
      { _id: ids.outOfStockProduct },
      {
        $set: {
          averageRating: 4,
          reviewCount: 2,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      },
    );
    const expectedFirst = {
      newest: ids.outOfStockProductUuid,
      price_asc: ids.outOfStockProductUuid,
      price_desc: ids.productUuid,
      rating_desc: ids.outOfStockProductUuid,
    };
    for (const [sort, firstId] of Object.entries(expectedFirst)) {
      const sorted = await request(app)
        .get(`${prefix}/products?sort=${sort}`)
        .expect(200);
      expect(sorted.body.data[0].id).toBe(firstId);
    }
    expect(
      (
        await request(app).get(
          `${prefix}/products?categoryId=${ids.categoryUuid}`,
        )
      ).body.data,
    ).toHaveLength(2);
    expect(
      (
        await request(app).get(
          `${prefix}/products?sellerId=${ids.seller}&minPrice=300&maxPrice=300`,
        )
      ).body.data,
    ).toHaveLength(1);
    const outOfStock = await request(app).get(
      `${prefix}/products?inStock=false`,
    );
    expect(outOfStock.body.data).toHaveLength(1);
    expect(outOfStock.body.data[0]).toEqual(
      expect.objectContaining({ status: 'OUT_OF_STOCK', stock: 0 }),
    );
    expect(
      (await request(app).get(`${prefix}/products?inStock=true`)).body.data,
    ).toHaveLength(1);
    const idsInList = defaultList.body.data.map((item) => item.id);
    expect(idsInList).not.toEqual(
      expect.arrayContaining([
        ids.draftProductUuid,
        ids.hiddenProductUuid,
        ids.deletedProductUuid,
        ids.inactiveSellerProductUuid,
        ids.inactiveCategoryProductUuid,
      ]),
    );
  });

  it('filters the catalog by listing format and projects offersEnabled', async () => {
    // The seeded catalog has no AUCTION listing and one Best-Offer FIXED item.
    const offerable = await request(app)
      .get(`${prefix}/products?format=offerable`)
      .expect(200);
    expect(offerable.body.data.map((item) => item.id)).toEqual([
      ids.productUuid,
    ]);
    expect(offerable.body.data[0].offersEnabled).toBe(true);

    const auctions = await request(app)
      .get(`${prefix}/products?format=auction`)
      .expect(200);
    expect(auctions.body.data).toHaveLength(0);

    // Non-offer item still carries the projected flag as false.
    const all = await request(app).get(`${prefix}/products`).expect(200);
    const headphones = all.body.data.find(
      (item) => item.id === ids.outOfStockProductUuid,
    );
    expect(headphones.offersEnabled).toBe(false);

    await request(app).get(`${prefix}/products?format=bogus`).expect(400);
  });

  it('returns typed attributes and rejects missing, inactive, or invalid product details', async () => {
    const detail = await request(app)
      .get(`${prefix}/products/${ids.productUuid}`)
      .expect(200);
    expect(detail.body.data.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dataType: 'string', value: 'silver' }),
        expect.objectContaining({
          dataType: 'number',
          value: 1.75,
          unit: 'kg',
        }),
        expect.objectContaining({ dataType: 'boolean', value: true }),
        expect.objectContaining({
          dataType: 'date',
          value: '2026-01-15T10:30:00.000Z',
        }),
      ]),
    );
    expect(detail.body.data.recentReviews).toHaveLength(0);
    await request(app)
      .get(`${prefix}/products/00000000-0000-4000-8000-000000000000`)
      .expect(404);
    await request(app)
      .get(`${prefix}/products/${ids.inactiveSellerProductUuid}`)
      .expect(404);
    await request(app)
      .get(`${prefix}/products/${ids.inactiveCategoryProductUuid}`)
      .expect(404);
    await request(app).get(`${prefix}/products/not-an-id`).expect(400);
  });

  it('hides suspended sellers and their products', async () => {
    await models.SellerProfile.updateOne(
      { _id: ids.seller },
      { status: 'SUSPENDED' },
    );
    await request(app).get(`${prefix}/sellers/${ids.seller}`).expect(404);
    const products = await request(app).get(`${prefix}/products`).expect(200);
    expect(products.body.data).toHaveLength(0);
  });

  it('limits product detail recent reviews to five newest entries', async () => {
    await models.ProductReview.create(
      Array.from({ length: 6 }, (_, index) => ({
        productId: ids.product,
        buyerId: ids.buyer,
        orderId: ids.order,
        orderItemId: new mongoose.Types.ObjectId(),
        rating: index + 1 > 5 ? 5 : index + 1,
        comment: `Review ${index}`,
        createdAt: new Date(2026, 0, index + 1),
      })),
    );
    const detail = await request(app)
      .get(`${prefix}/products/${ids.productUuid}`)
      .expect(200);
    expect(detail.body.data.recentReviews).toHaveLength(5);
    expect(detail.body.data.recentReviews[0].comment).toBe('Review 5');
  });

  it('paginates and filters public reviews and rejects wrong product or item', async () => {
    const buyer = await login('buyer@example.test');
    expect(
      (
        await mutate(
          buyer,
          'post',
          `/products/${ids.productUuid}/reviews`,
          reviewInput(ids.order, ids.orderItem),
        )
      ).status,
    ).toBe(201);
    await request(app)
      .get(`${prefix}/products/${ids.productUuid}/reviews?page=1&limit=1`)
      .expect(200)
      .then(({ body }) => {
        expect(body.meta).toEqual({
          page: 1,
          limit: 1,
          totalItems: 1,
          totalPages: 1,
        });
      });
    expect(
      (
        await mutate(
          buyer,
          'post',
          `/products/${ids.outOfStockProductUuid}/reviews`,
          reviewInput(),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await mutate(
          buyer,
          'post',
          `/products/${ids.productUuid}/reviews`,
          reviewInput(ids.order, ids.selfOrderItem),
        )
      ).status,
    ).toBe(403);
  });

  it('rejects feedback for wrong buyer or order and paginates public feedback', async () => {
    const buyer = await login('buyer@example.test');
    const other = await login('other@example.test');
    expect(
      (
        await mutate(other, 'post', `/orders/${ids.order}/seller-feedback`, {
          rating: 4,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await mutate(
          buyer,
          'post',
          `/orders/${ids.selfOrder}/seller-feedback`,
          { rating: 4 },
        )
      ).status,
    ).toBe(403);
    await mutate(buyer, 'post', `/orders/${ids.order}/seller-feedback`, {
      rating: 4,
    });
    await request(app)
      .get(`${prefix}/sellers/${ids.seller}/feedbacks?page=1&limit=1`)
      .expect(200)
      .then(({ body }) => {
        expect(body.meta).toEqual({
          page: 1,
          limit: 1,
          totalItems: 1,
          totalPages: 1,
        });
      });
  });

  it('rolls back review and feedback writes when aggregate updates fail', async () => {
    const buyer = await login('buyer@example.test');
    const reviewRepository =
      await import('../../src/modules/products/product.repository.js');
    const feedbackRepository =
      await import('../../src/modules/sellers/seller.repository.js');
    vi.spyOn(reviewRepository, 'updateReviewAggregate').mockRejectedValueOnce(
      new Error('aggregate failed'),
    );
    await mutate(
      buyer,
      'post',
      `/products/${ids.productUuid}/reviews`,
      reviewInput(),
    ).then(({ status }) => expect(status).toBe(500));
    expect(await models.ProductReview.countDocuments()).toBe(0);
    vi.spyOn(
      feedbackRepository,
      'updateFeedbackAggregate',
    ).mockRejectedValueOnce(new Error('aggregate failed'));
    await mutate(buyer, 'post', `/orders/${ids.order}/seller-feedback`, {
      rating: 4,
    }).then(({ status }) => expect(status).toBe(500));
    expect(await models.SellerFeedback.countDocuments()).toBe(0);
    vi.restoreAllMocks();
  });

  it('exposes only public fields for active sellers', async () => {
    const response = await request(app)
      .get(`${prefix}/sellers/${ids.seller}`)
      .expect(200);
    expect(Object.keys(response.body.data).sort()).toEqual(
      [
        'averageFeedbackRating',
        'avatarUrl',
        'description',
        'displayName',
        'feedbackCount',
        'id',
      ].sort(),
    );
    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: String(ids.seller),
        displayName: 'Trusted Tech',
        averageFeedbackRating: 0,
        feedbackCount: 0,
      }),
    );
    await request(app)
      .get(`${prefix}/sellers/${ids.inactiveSeller}`)
      .expect(404);
  });

  it('creates, updates, lists, and deletes an owned review with aggregates', async () => {
    const buyer = await login('buyer@example.test');
    const created = await mutate(
      buyer,
      'post',
      `/products/${ids.productUuid}/reviews`,
      reviewInput(),
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(
      expect.objectContaining({
        rating: 5,
        comment: 'Excellent product',
        reviewer: { fullName: 'Buyer One' },
      }),
    );
    expect(await models.Product.findById(ids.product).lean()).toEqual(
      expect.objectContaining({ averageRating: 5, reviewCount: 1 }),
    );

    const listed = await request(app)
      .get(`${prefix}/products/${ids.productUuid}/reviews`)
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].buyerId).toBeUndefined();
    expect(listed.body.data[0].orderId).toBeUndefined();

    const reviewId = created.body.data.id;
    const updated = await mutate(
      buyer,
      'patch',
      `/product-reviews/${reviewId}`,
      { rating: 2, comment: 'Reconsidered' },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data.rating).toBe(2);
    expect(await models.Product.findById(ids.product).lean()).toEqual(
      expect.objectContaining({ averageRating: 2, reviewCount: 1 }),
    );

    const removed = await mutate(
      buyer,
      'delete',
      `/product-reviews/${reviewId}`,
    );
    expect(removed.status).toBe(200);
    expect(removed.body.data).toEqual({ deleted: true });
    expect(await models.Product.findById(ids.product).lean()).toEqual(
      expect.objectContaining({ averageRating: 0, reviewCount: 0 }),
    );
  });

  it('creates, lists, and rejects direct edits/deletes for owned feedback', async () => {
    const buyer = await login('buyer@example.test');
    const created = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/seller-feedback`,
      {
        rating: 4,
        comment: 'Reliable seller',
        communicationRating: 5,
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(
      expect.objectContaining({
        orderId: String(ids.order),
        orderItemId: String(ids.orderItem),
        sellerId: String(ids.seller),
        productId: String(ids.product),
        rating: 4,
        comment: 'Reliable seller',
        verifiedPurchase: true,
        buyer: { fullName: 'Buyer One' },
      }),
    );
    expect(await models.SellerProfile.findById(ids.seller).lean()).toEqual(
      expect.objectContaining({ averageFeedbackRating: 4, feedbackCount: 1 }),
    );

    const listed = await request(app)
      .get(`${prefix}/sellers/${ids.seller}/feedbacks`)
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].buyerId).toBeUndefined();
    expect(listed.body.data[0].orderId).toBeUndefined();
    expect(listed.body.data[0].verifiedPurchase).toBe(true);

    const feedbackId = created.body.data.id;
    const updated = await mutate(
      buyer,
      'patch',
      `/seller-feedbacks/${feedbackId}`,
      { rating: 2 },
    );
    expect(updated.status).toBe(409);
    expect(updated.body.error.message).toBe(
      'Submitted seller feedback cannot be edited directly',
    );
    expect(await models.SellerProfile.findById(ids.seller).lean()).toEqual(
      expect.objectContaining({ averageFeedbackRating: 4, feedbackCount: 1 }),
    );

    const removed = await mutate(
      buyer,
      'delete',
      `/seller-feedbacks/${feedbackId}`,
    );
    expect(removed.status).toBe(409);
    expect(removed.body.error.message).toBe(
      'Submitted seller feedback cannot be deleted directly',
    );
    expect(await models.SellerProfile.findById(ids.seller).lean()).toEqual(
      expect.objectContaining({ averageFeedbackRating: 4, feedbackCount: 1 }),
    );
  });

  it('adds one immutable buyer follow-up without changing original feedback fields', async () => {
    const buyer = await login('buyer@example.test');
    const other = await login('other@example.test');
    const seller = await login('seller@example.test');
    const created = await uploadFeedback(
      buyer,
      ids.order,
      ids.orderItem,
      feedbackInput({
        commentType: 'NEGATIVE',
        commentText: 'Original problem',
        shippingTimeRating: 2,
      }),
      [{ name: 'evidence.jpg', mime: 'image/jpeg', size: 32 }],
    );
    expect(created.status).toBe(201);
    const before = await models.SellerFeedback.findById(
      created.body.data.id,
    ).lean();

    await mutate(
      other,
      'post',
      `/seller-feedbacks/${created.body.data.id}/follow-up`,
      { commentText: 'Not my feedback' },
    ).then(({ status }) => expect(status).toBe(404));
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${created.body.data.id}/follow-up`,
      { commentText: 'Seller cannot add buyer follow-up' },
    ).then(({ status }) => expect(status).toBe(404));

    const followUp = await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${created.body.data.id}/follow-up`,
      { commentText: 'Seller later helped resolve it.' },
    );
    expect(followUp.status).toBe(201);
    expect(followUp.body.data.followUpComment).toEqual(
      expect.objectContaining({
        commentText: 'Seller later helped resolve it.',
        createdAt: expect.any(String),
      }),
    );
    expect(followUp.body.data).toEqual(
      expect.objectContaining({
        commentType: 'NEGATIVE',
        commentText: 'Original problem',
        shippingTimeRating: 2,
        submittedAt: before.submittedAt.toISOString(),
      }),
    );
    expect(followUp.body.data.images).toHaveLength(1);

    await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${created.body.data.id}/follow-up`,
      { commentText: 'Second follow-up' },
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe('Follow-up comment already submitted');
    });

    const listed = await request(app)
      .get(`${prefix}/sellers/${ids.seller}/feedbacks`)
      .expect(200);
    expect(listed.body.data[0].followUpComment.commentText).toBe(
      'Seller later helped resolve it.',
    );
  });

  it('rejects empty, forged, and automated seller feedback follow-ups', async () => {
    const buyer = await login('buyer@example.test');
    const created = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ verifiedPurchase: true }),
    );
    expect(created.status).toBe(400);

    const manualOrder = await createDeliveredOrderItem();
    const manual = await mutate(
      buyer,
      'post',
      `/orders/${manualOrder.orderId}/items/${manualOrder.orderItemId}/seller-feedback`,
      feedbackInput(),
    );
    await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${manual.body.data.id}/follow-up`,
      { commentText: '   ' },
    ).then(({ status }) => expect(status).toBe(400));

    const automatedOrder = await createDeliveredOrderItem({
      deliveredAt: new Date(Date.now() - 180_000),
    });
    await sellerFeedbackService.processAutomatedPositiveFeedback({
      now: new Date(),
    });
    const automated = await models.SellerFeedback.findOne({
      orderItemId: automatedOrder.orderItemId,
    }).lean();
    await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${automated._id}/follow-up`,
      { commentText: 'Buyer should replace automated first' },
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Automated feedback cannot receive a buyer follow-up',
      );
    });
  });

  it('keeps the legacy seller-feedback endpoint safe for single-item and multi-item orders', async () => {
    const buyer = await login('buyer@example.test');
    const legacySingle = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/seller-feedback`,
      { rating: 4, comment: 'Legacy single item' },
    );
    expect(legacySingle.status).toBe(201);
    expect(legacySingle.body.data).toEqual(
      expect.objectContaining({
        orderId: String(ids.order),
        orderItemId: String(ids.orderItem),
        sellerId: String(ids.seller),
        productId: String(ids.product),
      }),
    );

    const multiOrder = new mongoose.Types.ObjectId();
    const itemA = new mongoose.Types.ObjectId();
    const itemB = new mongoose.Types.ObjectId();
    await models.Order.create({
      _id: multiOrder,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'DELIVERED',
      items: [
        {
          _id: itemA,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
        },
        {
          _id: itemB,
          productId: ids.outOfStockProduct,
          sellerId: ids.seller,
          quantity: 1,
        },
      ],
    });

    await mutate(buyer, 'post', `/orders/${multiOrder}/seller-feedback`, {
      rating: 5,
      comment: 'Ambiguous legacy order',
    }).then(({ status, body }) => {
      expect(status).toBe(400);
      expect(body.error.message).toBe(
        'Legacy seller feedback endpoint only supports single-item orders',
      );
    });
    expect(
      await models.SellerFeedback.countDocuments({ orderId: multiOrder }),
    ).toBe(0);
  });

  it('creates seller feedback at order-item grain and derives persisted identities', async () => {
    const buyer = await login('buyer@example.test');
    const created = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput(),
    );
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual(
      expect.objectContaining({
        orderId: String(ids.order),
        orderItemId: String(ids.orderItem),
        buyer: { fullName: 'Buyer One' },
        sellerId: String(ids.seller),
        productId: String(ids.product),
        commentType: 'POSITIVE',
        commentText: 'Reliable seller',
        comment: 'Reliable seller',
        itemAsDescribedRating: 5,
        communicationRating: 5,
        shippingTimeRating: 5,
        shippingAndHandlingChargesRating: 4,
      }),
    );
    const stored = await models.SellerFeedback.findById(
      created.body.data.id,
    ).lean();
    expect(stored).toEqual(
      expect.objectContaining({
        orderId: ids.order,
        orderItemId: ids.orderItem,
        buyerId: ids.buyer,
        sellerId: ids.seller,
        productId: ids.product,
      }),
    );
  });

  it('enforces order-item seller feedback eligibility and validation', async () => {
    const buyer = await login('buyer@example.test');
    const other = await login('other@example.test');
    await mutate(
      other,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput(),
    ).then(({ status }) => expect(status).toBe(403));

    const pendingOrder = new mongoose.Types.ObjectId();
    const pendingItem = new mongoose.Types.ObjectId();
    await models.Order.create({
      _id: pendingOrder,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'PENDING_PAYMENT',
      items: [
        {
          _id: pendingItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
        },
      ],
    });
    await mutate(
      buyer,
      'post',
      `/orders/${pendingOrder}/items/${pendingItem}/seller-feedback`,
      feedbackInput(),
    ).then(({ status }) => expect(status).toBe(403));

    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${new mongoose.Types.ObjectId()}/seller-feedback`,
      feedbackInput(),
    ).then(({ status, body }) => {
      expect(status).toBe(404);
      expect(body.error.message).toBe('Order item not found');
    });

    await mutate(
      buyer,
      'post',
      `/orders/${ids.selfOrder}/items/${ids.selfOrderItem}/seller-feedback`,
      feedbackInput(),
    ).then(({ status }) => expect(status).toBe(403));

    for (const commentType of ['POSITIVE', 'NEUTRAL', 'NEGATIVE']) {
      const orderId = new mongoose.Types.ObjectId();
      const orderItemId = new mongoose.Types.ObjectId();
      await models.Order.create({
        _id: orderId,
        buyerId: ids.buyer,
        sellerId: ids.seller,
        orderStatus: 'DELIVERED',
        items: [
          {
            _id: orderItemId,
            productId: ids.product,
            sellerId: ids.seller,
            quantity: 1,
          },
        ],
      });
      await mutate(
        buyer,
        'post',
        `/orders/${orderId}/items/${orderItemId}/seller-feedback`,
        feedbackInput({ commentType }),
      ).then(({ status }) => expect(status).toBe(201));
    }

    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'MIXED' }),
    ).then(({ status }) => expect(status).toBe(400));
    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentText: 'x'.repeat(501) }),
    ).then(({ status }) => expect(status).toBe(400));
    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ itemAsDescribedRating: 0 }),
    ).then(({ status }) => expect(status).toBe(400));
    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ communicationRating: 6 }),
    ).then(({ status }) => expect(status).toBe(400));
  });

  it('allows different order items in one order to receive independent seller feedback', async () => {
    const seller2User = new mongoose.Types.ObjectId();
    const seller2 = new mongoose.Types.ObjectId();
    const product2 = new mongoose.Types.ObjectId();
    const product2Uuid = '99999999-9999-4999-8999-999999999999';
    const item2 = new mongoose.Types.ObjectId();
    await models.User.create({
      _id: seller2User,
      email: 'seller2@example.test',
      passwordHash,
      fullName: 'Seller Two',
      status: 'ACTIVE',
      isEmailVerified: true,
    });
    await models.SellerProfile.create({
      _id: seller2,
      userId: seller2User,
      displayName: 'Second Shop',
      status: 'ACTIVE',
    });
    await models.Product.create({
      _id: product2,
      uuid: product2Uuid,
      sellerId: seller2,
      categoryId: ids.category,
      title: 'Second item',
      description: 'Another listing',
      price: 100,
      stock: 2,
      status: 'ACTIVE',
    });
    await models.Order.findByIdAndUpdate(ids.order, {
      $push: {
        items: {
          _id: item2,
          productId: product2,
          sellerId: seller2,
          quantity: 1,
        },
      },
    });

    const buyer = await login('buyer@example.test');
    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'POSITIVE' }),
    ).then(({ status }) => expect(status).toBe(201));
    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${item2}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE' }),
    ).then(({ status }) => expect(status).toBe(201));

    const docs = await models.SellerFeedback.find({ orderId: ids.order })
      .sort({ sellerId: 1 })
      .lean();
    expect(docs).toHaveLength(2);
    expect(docs.map((doc) => String(doc.orderItemId))).toEqual(
      expect.arrayContaining([String(ids.orderItem), String(item2)]),
    );
    expect(
      docs.find((doc) => String(doc.orderItemId) === String(item2)),
    ).toEqual(
      expect.objectContaining({ sellerId: seller2, productId: product2 }),
    );
  });

  it('lists awaiting feedback, retrieves order-item feedback, summarizes, and lets the seller respond once', async () => {
    const buyer = await login('buyer@example.test');
    let awaiting = await buyer
      .get(`${prefix}/seller-feedbacks/awaiting`)
      .expect(200);
    expect(awaiting.body.data.map((item) => item.orderItemId)).toContain(
      String(ids.orderItem),
    );

    const feedback = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'NEUTRAL', shippingTimeRating: 3 }),
    );
    expect(feedback.status).toBe(201);

    awaiting = await buyer
      .get(`${prefix}/seller-feedbacks/awaiting`)
      .expect(200);
    expect(awaiting.body.data.map((item) => item.orderItemId)).not.toContain(
      String(ids.orderItem),
    );

    await buyer
      .get(
        `${prefix}/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.data.exists).toBe(true);
        expect(body.data.feedback.id).toBe(feedback.body.data.id);
      });

    await request(app)
      .get(`${prefix}/sellers/${ids.seller}/feedback-summary`)
      .expect(200)
      .then(({ body }) => {
        expect(body.data.totalFeedbackCount).toBe(1);
        expect(body.data.counts).toEqual({
          POSITIVE: 0,
          NEUTRAL: 1,
          NEGATIVE: 0,
        });
        expect(body.data.averageDetailedSellerRatings).toEqual(
          expect.objectContaining({ shippingTime: 3 }),
        );
      });

    const wrongSeller = await login('inactive-seller@example.test');
    await mutate(
      wrongSeller,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/response`,
      { commentText: 'Thanks' },
    ).then(({ status }) => expect(status).toBe(403));

    const seller = await login('seller@example.test');
    const response = await mutate(
      seller,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/response`,
      { commentText: 'Thanks for the transaction' },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.sellerResponse).toEqual(
      expect.objectContaining({ commentText: 'Thanks for the transaction' }),
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/response`,
      { commentText: 'Second response' },
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Seller response already exists for this feedback',
      );
    });
  });

  it('summarizes only seller feedback and excludes missing DSR values from averages', async () => {
    const buyer = await login('buyer@example.test');
    await mutate(buyer, 'post', `/products/${ids.productUuid}/reviews`, {
      ...reviewInput(),
      rating: 1,
    }).then(({ status }) => expect(status).toBe(201));

    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({
        commentType: 'POSITIVE',
        itemAsDescribedRating: 4,
        communicationRating: 5,
        shippingTimeRating: 3,
        shippingAndHandlingChargesRating: 2,
      }),
    ).then(({ status }) => expect(status).toBe(201));

    const secondOrder = new mongoose.Types.ObjectId();
    const secondItem = new mongoose.Types.ObjectId();
    await models.Order.create({
      _id: secondOrder,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'DELIVERED',
      items: [
        {
          _id: secondItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
        },
      ],
    });
    await mutate(
      buyer,
      'post',
      `/orders/${secondOrder}/items/${secondItem}/seller-feedback`,
      feedbackInput({
        commentType: 'NEGATIVE',
        itemAsDescribedRating: 2,
        communicationRating: undefined,
        shippingTimeRating: undefined,
        shippingAndHandlingChargesRating: undefined,
      }),
    ).then(({ status }) => expect(status).toBe(201));

    await request(app)
      .get(`${prefix}/sellers/${ids.seller}/feedback-summary`)
      .expect(200)
      .then(({ body }) => {
        expect(body.data.totalFeedbackCount).toBe(2);
        expect(body.data.counts).toEqual({
          POSITIVE: 1,
          NEUTRAL: 0,
          NEGATIVE: 1,
        });
        expect(body.data.averageDetailedSellerRatings).toEqual({
          itemAsDescribed: 3,
          communication: 5,
          shippingTime: 3,
          shippingAndHandlingCharges: 2,
        });
      });
  });

  it('creates revision requests for neutral and negative feedback and enforces request eligibility', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const unrelatedSeller = await login('inactive-seller@example.test');

    const negative = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE' }),
    );
    expect(negative.status).toBe(201);

    await mutate(
      unrelatedSeller,
      'post',
      `/seller-feedbacks/${negative.body.data.id}/revision-request`,
      {},
    ).then(({ status, body }) => {
      expect(status).toBe(403);
      expect(body.error.message).toBe(
        'Only the feedback seller can request revision',
      );
    });

    const requested = await mutate(
      seller,
      'post',
      `/seller-feedbacks/${negative.body.data.id}/revision-request`,
      {},
    );
    expect(requested.status).toBe(201);
    expect(requested.body.data.revisionRequest.status).toBe('PENDING');
    expect(
      new Date(requested.body.data.revisionRequest.expiresAt).getTime() -
        new Date(requested.body.data.revisionRequest.requestedAt).getTime(),
    ).toBe(10 * 86_400_000);

    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${negative.body.data.id}/revision-request`,
      {},
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Feedback revision request already exists',
      );
    });

    const positiveOrder = await createDeliveredOrderItem();
    const positive = await mutate(
      buyer,
      'post',
      `/orders/${positiveOrder.orderId}/items/${positiveOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'POSITIVE' }),
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${positive.body.data.id}/revision-request`,
      {},
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Feedback revision is only available for neutral or negative feedback',
      );
    });

    const neutralOrder = await createDeliveredOrderItem();
    const neutral = await mutate(
      buyer,
      'post',
      `/orders/${neutralOrder.orderId}/items/${neutralOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'NEUTRAL' }),
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${neutral.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(201));

    const expiredOrder = await createDeliveredOrderItem();
    const expired = await mutate(
      buyer,
      'post',
      `/orders/${expiredOrder.orderId}/items/${expiredOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE' }),
    );
    await models.SellerFeedback.updateOne(
      { _id: expired.body.data.id },
      { $set: { submittedAt: new Date(Date.now() - 31 * 86_400_000) } },
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${expired.body.data.id}/revision-request`,
      {},
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Feedback revision request period has expired',
      );
    });

    const automatedOrder = await createDeliveredOrderItem({
      deliveredAt: new Date(Date.now() - 180_000),
    });
    await sellerFeedbackService.processAutomatedPositiveFeedback({
      now: new Date(),
    });
    const automated = await models.SellerFeedback.findOne({
      orderItemId: automatedOrder.orderItemId,
    }).lean();
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${automated._id}/revision-request`,
      {},
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Automated feedback cannot receive revision request',
      );
    });
  });

  it('does not apply a yearly revision quota across separate feedback records', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    for (let index = 0; index < 6; index += 1) {
      const { orderId, orderItemId } = await createDeliveredOrderItem();
      const feedback = await mutate(
        buyer,
        'post',
        `/orders/${orderId}/items/${orderItemId}/seller-feedback`,
        feedbackInput({ commentType: 'NEUTRAL' }),
      );
      await mutate(
        seller,
        'post',
        `/seller-feedbacks/${feedback.body.data.id}/revision-request`,
        {},
      ).then(({ status }) => expect(status).toBe(201));
    }
  });

  it('lets the buyer accept a pending revision atomically without changing transaction identity', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const feedback = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE', commentText: 'Problem' }),
    );
    await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/follow-up`,
      { commentText: 'Follow-up before revision.' },
    ).then(({ status }) => expect(status).toBe(201));
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(201));

    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/revision-request/respond`,
      { decision: 'DECLINE' },
    ).then(({ status, body }) => {
      expect(status).toBe(403);
      expect(body.error.message).toBe(
        'Only the feedback buyer can respond to revision request',
      );
    });

    const accepted = await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/revision-request/respond`,
      {
        decision: 'ACCEPT',
        feedback: {
          commentType: 'POSITIVE',
          commentText: 'Seller resolved the problem.',
          itemAsDescribedRating: 5,
          communicationRating: 5,
          shippingTimeRating: 4,
          shippingAndHandlingChargesRating: 4,
          sellerId: String(ids.inactiveSeller),
        },
      },
    );
    expect(accepted.status).toBe(400);

    const cleanAccepted = await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/revision-request/respond`,
      {
        decision: 'ACCEPT',
        feedback: {
          commentType: 'POSITIVE',
          commentText: 'Seller resolved the problem.',
          itemAsDescribedRating: 5,
          communicationRating: 5,
          shippingTimeRating: 4,
          shippingAndHandlingChargesRating: 4,
        },
      },
    );
    expect(cleanAccepted.status).toBe(200);
    expect(cleanAccepted.body.data).toEqual(
      expect.objectContaining({
        id: feedback.body.data.id,
        orderId: String(ids.order),
        orderItemId: String(ids.orderItem),
        buyer: { fullName: 'Buyer One' },
        sellerId: String(ids.seller),
        productId: String(ids.product),
        source: 'BUYER',
        commentType: 'POSITIVE',
        commentText: 'Seller resolved the problem.',
      }),
    );
    expect(cleanAccepted.body.data.revisionRequest.status).toBe('ACCEPTED');
    expect(cleanAccepted.body.data.followUpComment.commentText).toBe(
      'Follow-up before revision.',
    );

    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${feedback.body.data.id}/revision-request`,
      {},
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Feedback revision request already exists',
      );
    });
  });

  it('lets the buyer decline, expires pending revisions lazily, and serializes competing decisions', async () => {
    const buyer = await login('buyer@example.test');
    const other = await login('other@example.test');
    const seller = await login('seller@example.test');

    const declineOrder = await createDeliveredOrderItem();
    const declined = await mutate(
      buyer,
      'post',
      `/orders/${declineOrder.orderId}/items/${declineOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE', commentText: 'Original' }),
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${declined.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(201));
    await mutate(
      other,
      'post',
      `/seller-feedbacks/${declined.body.data.id}/revision-request/respond`,
      { decision: 'DECLINE' },
    ).then(({ status }) => expect(status).toBe(403));
    const decline = await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${declined.body.data.id}/revision-request/respond`,
      { decision: 'DECLINE' },
    );
    expect(decline.status).toBe(200);
    expect(decline.body.data).toEqual(
      expect.objectContaining({
        commentType: 'NEGATIVE',
        commentText: 'Original',
      }),
    );
    expect(decline.body.data.revisionRequest.status).toBe('DECLINED');
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${declined.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(409));

    const expiredOrder = await createDeliveredOrderItem();
    const expired = await mutate(
      buyer,
      'post',
      `/orders/${expiredOrder.orderId}/items/${expiredOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE' }),
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${expired.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(201));
    await models.SellerFeedback.updateOne(
      { _id: expired.body.data.id },
      {
        $set: {
          'revisionRequest.expiresAt': new Date(Date.now() - 1_000),
        },
      },
    );
    await buyer
      .get(
        `${prefix}/orders/${expiredOrder.orderId}/items/${expiredOrder.orderItemId}/seller-feedback`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body.data.feedback.revisionRequest.status).toBe('EXPIRED');
      });
    await mutate(
      buyer,
      'post',
      `/seller-feedbacks/${expired.body.data.id}/revision-request/respond`,
      { decision: 'DECLINE' },
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe('Feedback revision request has expired');
    });
    expect(
      (await models.SellerFeedback.findById(expired.body.data.id).lean())
        .revisionRequest.status,
    ).toBe('EXPIRED');
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${expired.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(409));

    const raceOrder = await createDeliveredOrderItem();
    const race = await mutate(
      buyer,
      'post',
      `/orders/${raceOrder.orderId}/items/${raceOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE' }),
    );
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${race.body.data.id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(201));
    const [acceptRace, declineRace] = await Promise.all([
      mutate(
        buyer,
        'post',
        `/seller-feedbacks/${race.body.data.id}/revision-request/respond`,
        {
          decision: 'ACCEPT',
          feedback: {
            commentType: 'POSITIVE',
            commentText: 'Fixed.',
          },
        },
      ),
      mutate(
        buyer,
        'post',
        `/seller-feedbacks/${race.body.data.id}/revision-request/respond`,
        { decision: 'DECLINE' },
      ),
    ]);
    expect([acceptRace.status, declineRace.status].sort()).toEqual([200, 409]);
    expect(
      (await models.SellerFeedback.findById(race.body.data.id).lean())
        .revisionRequest.status,
    ).toMatch(/ACCEPTED|DECLINED/);
  });

  it('processes automated positive feedback eligibility and duplicate races without fabricating DSR', async () => {
    const now = new Date();
    const beforeDelay = await createDeliveredOrderItem({
      deliveredAt: new Date(now.getTime() - 60_000),
    });
    const afterDelay = await createDeliveredOrderItem({
      deliveredAt: new Date(now.getTime() - 180_000),
    });
    const deliveredAtOrder = await createDeliveredOrderItem({
      createdAt: now,
      deliveredAt: new Date(now.getTime() - 180_000),
    });
    await mutate(
      await login('buyer@example.test'),
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'POSITIVE' }),
    ).then(({ status }) => expect(status).toBe(201));

    const self = await createDeliveredOrderItem({
      buyerId: ids.sellerUser,
      deliveredAt: new Date(now.getTime() - 180_000),
    });
    const [firstRun, secondRun] = await Promise.all([
      sellerFeedbackService.processAutomatedPositiveFeedback({ now }),
      sellerFeedbackService.processAutomatedPositiveFeedback({ now }),
    ]);
    expect(firstRun.created + secondRun.created).toBe(2);
    expect(
      await models.SellerFeedback.countDocuments({
        orderItemId: {
          $in: [afterDelay.orderItemId, deliveredAtOrder.orderItemId],
        },
        source: 'AUTOMATED',
      }),
    ).toBe(2);
    expect(
      await models.SellerFeedback.exists({
        orderItemId: beforeDelay.orderItemId,
      }),
    ).toBeNull();
    expect(
      await models.SellerFeedback.exists({ orderItemId: self.orderItemId }),
    ).toBeNull();
    const automated = await models.SellerFeedback.findOne({
      orderItemId: afterDelay.orderItemId,
    }).lean();
    expect(automated).toEqual(
      expect.objectContaining({
        commentType: 'POSITIVE',
        commentText: 'Automated positive feedback',
        source: 'AUTOMATED',
      }),
    );
    expect(automated.itemAsDescribedRating).toBeUndefined();
    expect(automated.communicationRating).toBeUndefined();
    expect(automated.shippingTimeRating).toBeUndefined();
    expect(automated.shippingAndHandlingChargesRating).toBeUndefined();
  });

  it('lets manual buyer feedback replace automated feedback, including multipart images, while preserving one record', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const oldOrder = await createDeliveredOrderItem({
      deliveredAt: new Date(Date.now() - 180_000),
    });
    await sellerFeedbackService.processAutomatedPositiveFeedback({
      now: new Date(),
    });
    const automated = await models.SellerFeedback.findOne({
      orderItemId: oldOrder.orderItemId,
    }).lean();
    expect(automated.source).toBe('AUTOMATED');

    const replacement = await uploadFeedback(
      buyer,
      oldOrder.orderId,
      oldOrder.orderItemId,
      feedbackInput({
        commentType: 'NEGATIVE',
        commentText: 'Buyer supplied real feedback.',
      }),
      [{ name: 'replacement.jpg', mime: 'image/jpeg', size: 32 }],
    );
    expect(replacement.status).toBe(201);
    expect(replacement.body.data).toEqual(
      expect.objectContaining({
        id: String(automated._id),
        orderId: String(oldOrder.orderId),
        orderItemId: String(oldOrder.orderItemId),
        sellerId: String(ids.seller),
        productId: String(ids.product),
        source: 'BUYER',
        commentType: 'NEGATIVE',
        commentText: 'Buyer supplied real feedback.',
      }),
    );
    expect(replacement.body.data.images).toHaveLength(1);
    const replaced = await models.SellerFeedback.findById(automated._id).lean();
    expect(replaced.submittedAt.getTime()).toBeGreaterThan(
      automated.submittedAt.getTime(),
    );
    expect(
      await models.SellerFeedback.countDocuments({
        orderId: oldOrder.orderId,
        orderItemId: oldOrder.orderItemId,
      }),
    ).toBe(1);

    await mutate(
      buyer,
      'post',
      `/orders/${oldOrder.orderId}/items/${oldOrder.orderItemId}/seller-feedback`,
      feedbackInput({ commentType: 'POSITIVE' }),
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Seller feedback already exists for this order item',
      );
    });
    await mutate(
      seller,
      'post',
      `/seller-feedbacks/${automated._id}/revision-request`,
      {},
    ).then(({ status }) => expect(status).toBe(201));
  });

  it('keeps manual feedback authoritative in a manual-vs-auto race and blocks direct automated edits', async () => {
    const buyer = await login('buyer@example.test');
    const raceOrder = await createDeliveredOrderItem({
      deliveredAt: new Date(Date.now() - 180_000),
    });
    const [autoResult, manualResult] = await Promise.all([
      sellerFeedbackService.processAutomatedPositiveFeedback({
        now: new Date(),
      }),
      mutate(
        buyer,
        'post',
        `/orders/${raceOrder.orderId}/items/${raceOrder.orderItemId}/seller-feedback`,
        feedbackInput({ commentType: 'NEGATIVE' }),
      ),
    ]);
    expect(autoResult.created).toBeLessThanOrEqual(1);
    expect(manualResult.status).toBe(201);
    const finalFeedback = await models.SellerFeedback.findOne({
      orderItemId: raceOrder.orderItemId,
    }).lean();
    expect(finalFeedback.source).toBe('BUYER');
    expect(finalFeedback.commentType).toBe('NEGATIVE');
    expect(
      await models.SellerFeedback.countDocuments({
        orderItemId: raceOrder.orderItemId,
      }),
    ).toBe(1);

    const autoOnlyOrder = await createDeliveredOrderItem({
      deliveredAt: new Date(Date.now() - 180_000),
    });
    await sellerFeedbackService.processAutomatedPositiveFeedback({
      now: new Date(),
    });
    const autoOnly = await models.SellerFeedback.findOne({
      orderItemId: autoOnlyOrder.orderItemId,
    }).lean();
    await mutate(buyer, 'patch', `/seller-feedbacks/${autoOnly._id}`, {
      commentType: 'NEGATIVE',
    }).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Submitted seller feedback cannot be edited directly',
      );
    });
    await mutate(buyer, 'delete', `/seller-feedbacks/${autoOnly._id}`).then(
      ({ status, body }) => {
        expect(status).toBe(409);
        expect(body.error.message).toBe(
          'Submitted seller feedback cannot be deleted directly',
        );
      },
    );
  });

  it('rejects client-controlled seller feedback identity, source, submittedAt, and revision state fields', async () => {
    const buyer = await login('buyer@example.test');
    const forbiddenFields = [
      { sellerId: String(ids.inactiveSeller) },
      { buyerId: String(ids.otherBuyer) },
      { productId: String(ids.outOfStockProduct) },
      { source: 'AUTOMATED' },
      { submittedAt: new Date().toISOString() },
      { revisionRequest: { status: 'ACCEPTED' } },
    ];
    for (const fields of forbiddenFields) {
      const { orderId, orderItemId } = await createDeliveredOrderItem();
      await mutate(
        buyer,
        'post',
        `/orders/${orderId}/items/${orderItemId}/seller-feedback`,
        { ...feedbackInput(), ...fields },
      ).then(({ status }) => expect(status).toBe(400));
    }

    const feedback = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'NEGATIVE' }),
    );
    await mutate(buyer, 'patch', `/seller-feedbacks/${feedback.body.data.id}`, {
      source: 'AUTOMATED',
    }).then(({ status }) => expect(status).toBe(400));
  });

  it('accepts optional feedback images and rejects public feedback removal', async () => {
    const buyer = await login('buyer@example.test');
    const created = await uploadFeedback(
      buyer,
      ids.order,
      ids.orderItem,
      feedbackInput({ communicationRating: 4 }),
      [
        { name: 'one.jpg', mime: 'image/jpeg', size: 32 },
        { name: 'two.png', mime: 'image/png', size: 48 },
      ],
    );
    expect(created.status).toBe(201);
    expect(created.body.data.images).toHaveLength(2);
    expect(created.body.data.images[0]).toEqual(
      expect.objectContaining({
        key: expect.stringContaining('seller-feedbacks/'),
        url: expect.stringContaining(
          'https://cdn.example.test/sbay/seller-feedbacks/',
        ),
      }),
    );
    const putKeys = storageSend.mock.calls
      .map(([command]) => command.input)
      .filter((input) => input.Body)
      .map((input) => input.Key);
    expect(putKeys).toHaveLength(2);

    storageSend.mockClear();
    await mutate(
      buyer,
      'delete',
      `/seller-feedbacks/${created.body.data.id}`,
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe(
        'Submitted seller feedback cannot be deleted directly',
      );
    });
    expect(storageSend).not.toHaveBeenCalled();
    expect(await models.SellerFeedback.countDocuments()).toBe(1);
  });

  it('cleans up feedback images when upload or duplicate creation fails', async () => {
    const buyer = await login('buyer@example.test');
    storageSend
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('r2 down'));
    const failedUpload = await uploadFeedback(
      buyer,
      ids.order,
      ids.orderItem,
      feedbackInput(),
      [
        { name: 'one.jpg', mime: 'image/jpeg', size: 32 },
        { name: 'two.jpg', mime: 'image/jpeg', size: 32 },
      ],
    );
    expect(failedUpload.status).toBe(502);
    expect(await models.SellerFeedback.countDocuments()).toBe(0);
    expect(
      storageSend.mock.calls
        .map(([command]) => command.input)
        .filter((input) => !input.Body),
    ).toHaveLength(1);

    storageSend.mockReset();
    storageSend.mockResolvedValue({});
    await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput(),
    ).then(({ status }) => expect(status).toBe(201));
    storageSend.mockClear();
    const duplicate = await uploadFeedback(
      buyer,
      ids.order,
      ids.orderItem,
      feedbackInput({ commentText: 'duplicate with image' }),
      [{ name: 'duplicate.jpg', mime: 'image/jpeg', size: 32 }],
    );
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toBe(
      'Seller feedback already exists for this order item',
    );
    const duplicateStorageInputs = storageSend.mock.calls.map(
      ([command]) => command.input,
    );
    expect(duplicateStorageInputs.filter((input) => input.Body)).toHaveLength(
      1,
    );
    expect(duplicateStorageInputs.filter((input) => !input.Body)).toHaveLength(
      1,
    );
  });

  it('enforces feedback image count/type limits without uploading invalid requests', async () => {
    const buyer = await login('buyer@example.test');
    const tooMany = await uploadFeedback(
      buyer,
      ids.order,
      ids.orderItem,
      feedbackInput(),
      Array.from({ length: 6 }, (_, index) => ({
        name: `image-${index}.jpg`,
        mime: 'image/jpeg',
        size: 8,
      })),
    );
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toBe('Too many feedback images');

    const invalidType = await uploadFeedback(
      buyer,
      ids.order,
      ids.orderItem,
      feedbackInput(),
      [{ name: 'notes.txt', mime: 'text/plain', size: 8 }],
    );
    expect(invalidType.status).toBe(400);
    expect(invalidType.body.error.message).toBe('Unsupported image type');
    expect(storageSend).not.toHaveBeenCalled();
  });

  it('enforces feedback deadline for creation and awaiting feedback', async () => {
    const buyer = await login('buyer@example.test');
    const expiredOrder = new mongoose.Types.ObjectId();
    const expiredItem = new mongoose.Types.ObjectId();
    await models.Order.create({
      _id: expiredOrder,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'DELIVERED',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [
        {
          _id: expiredItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 1,
        },
      ],
    });
    await models.Order.updateOne(
      { _id: expiredOrder },
      {
        $set: {
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      },
    );

    await models.Order.updateOne(
      { _id: ids.order },
      { $set: { createdAt: new Date(), updatedAt: new Date() } },
    );
    await mutate(
      buyer,
      'post',
      `/orders/${expiredOrder}/items/${expiredItem}/seller-feedback`,
      feedbackInput(),
    ).then(({ status, body }) => {
      expect(status).toBe(409);
      expect(body.error.message).toBe('Feedback period has expired');
    });

    await buyer
      .get(`${prefix}/seller-feedbacks/awaiting`)
      .expect(200)
      .then(({ body }) => {
        expect(body.data.map((item) => item.orderItemId)).toContain(
          String(ids.orderItem),
        );
        expect(body.data.map((item) => item.orderItemId)).not.toContain(
          String(expiredItem),
        );
        expect(body.data[0]).toEqual(
          expect.objectContaining({ feedbackDeadline: expect.any(String) }),
        );
      });
  });

  it('rejects public canonical seller feedback edits', async () => {
    const buyer = await login('buyer@example.test');
    const created = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/items/${ids.orderItem}/seller-feedback`,
      feedbackInput({ commentType: 'POSITIVE' }),
    );
    expect(created.status).toBe(201);
    const updated = await mutate(
      buyer,
      'patch',
      `/seller-feedbacks/${created.body.data.id}`,
      {
        commentType: 'NEGATIVE',
        commentText: 'Updated transaction feedback',
        shippingTimeRating: 2,
        shippingAndHandlingChargesRating: 3,
      },
    );
    expect(updated.status).toBe(409);
    expect(updated.body.error.message).toBe(
      'Submitted seller feedback cannot be edited directly',
    );
  });

  it('enforces authentication, CSRF, purchase eligibility, and ownership', async () => {
    const anonymous = request.agent(app);
    const anonymousToken = await csrf(anonymous);
    await anonymous
      .post(`${prefix}/products/${ids.productUuid}/reviews`)
      .set('x-csrf-token', anonymousToken)
      .send(reviewInput())
      .expect(401);

    const buyer = await login('buyer@example.test');
    await buyer
      .post(`${prefix}/products/${ids.productUuid}/reviews`)
      .send(reviewInput())
      .expect(403);

    const other = await login('other@example.test');
    expect(
      (
        await mutate(
          other,
          'post',
          `/products/${ids.productUuid}/reviews`,
          reviewInput(),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await mutate(other, 'post', `/orders/${ids.order}/seller-feedback`, {
          rating: 5,
        })
      ).status,
    ).toBe(403);

    const review = await mutate(
      buyer,
      'post',
      `/products/${ids.productUuid}/reviews`,
      reviewInput(),
    );
    const feedback = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/seller-feedback`,
      { rating: 5 },
    );
    expect(
      (
        await mutate(
          other,
          'patch',
          `/product-reviews/${review.body.data.id}`,
          { rating: 1 },
        )
      ).status,
    ).toBe(404);
    expect(
      (await mutate(other, 'delete', `/product-reviews/${review.body.data.id}`))
        .status,
    ).toBe(404);
    expect(
      (
        await mutate(
          other,
          'patch',
          `/seller-feedbacks/${feedback.body.data.id}`,
          { rating: 1 },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await mutate(
          other,
          'delete',
          `/seller-feedbacks/${feedback.body.data.id}`,
        )
      ).status,
    ).toBe(404);

    const seller = await login('seller@example.test');
    expect(
      (
        await mutate(
          seller,
          'post',
          `/orders/${ids.selfOrder}/seller-feedback`,
          { rating: 5 },
        )
      ).status,
    ).toBe(403);
  });

  it('rejects duplicate review and feedback submissions with conflicts', async () => {
    const buyer = await login('buyer@example.test');
    await mutate(
      buyer,
      'post',
      `/products/${ids.productUuid}/reviews`,
      reviewInput(),
    ).then((response) => expect(response.status).toBe(201));
    const duplicateReview = await mutate(
      buyer,
      'post',
      `/products/${ids.productUuid}/reviews`,
      reviewInput(),
    );
    expect(duplicateReview.status).toBe(409);
    expect(duplicateReview.body.error.code).toBe('CONFLICT');

    await mutate(buyer, 'post', `/orders/${ids.order}/seller-feedback`, {
      rating: 4,
    }).then((response) => expect(response.status).toBe(201));
    const duplicateFeedback = await mutate(
      buyer,
      'post',
      `/orders/${ids.order}/seller-feedback`,
      { rating: 3 },
    );
    expect(duplicateFeedback.status).toBe(409);
    expect(duplicateFeedback.body.error.code).toBe('CONFLICT');
    expect(duplicateFeedback.body.error.message).toBe(
      'Seller feedback already exists for this order item',
    );
  });
});
