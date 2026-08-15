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
let app;
let database;
let mongo;
let passwordHash;
let models;
let ids;

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
  ({ app } = await import('../../src/app.js'));
});

beforeEach(async () => {
  vi.restoreAllMocks();
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

  it('creates, updates, lists, and deletes owned feedback with aggregates', async () => {
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
        rating: 4,
        comment: 'Reliable seller',
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

    const feedbackId = created.body.data.id;
    const updated = await mutate(
      buyer,
      'patch',
      `/seller-feedbacks/${feedbackId}`,
      { rating: 2 },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.data.rating).toBe(2);
    expect(await models.SellerProfile.findById(ids.seller).lean()).toEqual(
      expect.objectContaining({ averageFeedbackRating: 2, feedbackCount: 1 }),
    );

    const removed = await mutate(
      buyer,
      'delete',
      `/seller-feedbacks/${feedbackId}`,
    );
    expect(removed.status).toBe(200);
    expect(removed.body.data).toEqual({ deleted: true });
    expect(await models.SellerProfile.findById(ids.seller).lean()).toEqual(
      expect.objectContaining({ averageFeedbackRating: 0, feedbackCount: 0 }),
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
  });
});
