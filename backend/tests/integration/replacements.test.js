import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let database;
let mongo;
let models;
let service;
let ids;

const objectId = () => new mongoose.Types.ObjectId();

const seed = async () => {
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
    order: objectId(),
    orderItem: objectId(),
    orderItem2: objectId(),
    otherOrder: objectId(),
    inr: objectId(),
    closedInr: objectId(),
  };
  await models.User.create([
    {
      _id: ids.buyer,
      email: 'buyer@example.test',
      passwordHash: 'hash',
      fullName: 'Buyer',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.otherBuyer,
      email: 'other@example.test',
      passwordHash: 'hash',
      fullName: 'Other Buyer',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.sellerUser,
      email: 'seller@example.test',
      passwordHash: 'hash',
      fullName: 'Seller',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: ids.sellerUser2,
      email: 'seller2@example.test',
      passwordHash: 'hash',
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
  await models.Order.create([
    {
      _id: ids.order,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderStatus: 'CONFIRMED',
      currency: 'VND',
      items: [
        {
          _id: ids.orderItem,
          productId: ids.product,
          sellerId: ids.seller,
          quantity: 5,
          title: 'Camera',
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
  await models.INRRequest.create([
    {
      _id: ids.inr,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderId: ids.order,
      orderItemId: ids.orderItem,
      productId: ids.product,
      shipmentId: objectId(),
      requestedResolution: 'WANT_ITEM',
      quantityMissing: 2,
      requestAmount: 2000,
      currency: 'VND',
      conversationId: objectId(),
      status: 'OPEN',
    },
    {
      _id: ids.closedInr,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      orderId: ids.order,
      orderItemId: ids.orderItem2,
      productId: ids.product2,
      shipmentId: objectId(),
      requestedResolution: 'REFUND',
      quantityMissing: 1,
      requestAmount: 500,
      currency: 'VND',
      conversationId: objectId(),
      status: 'CLOSED',
      closedAt: new Date(),
      closeReason: 'ITEM_ARRIVED',
    },
  ]);
};

const proposalInput = (overrides = {}) => ({
  inrRequestId: String(ids.inr),
  orderId: String(ids.order),
  orderItemId: String(ids.orderItem),
  buyerId: String(ids.otherBuyer),
  sellerId: String(ids.seller2),
  productId: String(ids.product2),
  quantity: 99,
  status: 'ACCEPTED',
  acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const proposeBuyer = (overrides) =>
  service.propose(ids.buyer, proposalInput(overrides));

const proposeSeller = (overrides) =>
  service.propose(ids.sellerUser, proposalInput(overrides));

const expectStatus = async (promise, status) => {
  await expect(promise).rejects.toMatchObject({ status });
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
    import('../../src/modules/orders/order.model.js'),
    import('../../src/modules/inr-requests/inr-request.model.js'),
    import('../../src/modules/replacements/replacement.model.js'),
    import('../../src/modules/replacements/replacement.service.js'),
  ]);
  models = {
    User: modules[0].User,
    Category: modules[1].Category,
    SellerProfile: modules[2].SellerProfile,
    Product: modules[3].Product,
    Order: modules[4].Order,
    INRRequest: modules[5].INRRequest,
    Replacement: modules[6].Replacement,
  };
  service = modules[7];
  await Promise.all(Object.values(models).map((model) => model.init()));
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

describe('replacement domain foundation', () => {
  it('lets buyers and sellers propose replacements with server-derived identity', async () => {
    const buyerProposal = await proposeBuyer();
    expect(buyerProposal).toEqual(
      expect.objectContaining({
        inrRequestId: String(ids.inr),
        orderId: String(ids.order),
        orderItemId: String(ids.orderItem),
        buyerId: String(ids.buyer),
        sellerId: String(ids.seller),
        productId: String(ids.product),
        quantity: 2,
        initiatorRole: 'BUYER',
        initiatedBy: String(ids.buyer),
        status: 'PROPOSED',
        acceptedAt: null,
      }),
    );
    await service.decline(ids.sellerUser, buyerProposal.id);

    const sellerProposal = await proposeSeller();
    expect(sellerProposal).toEqual(
      expect.objectContaining({
        buyerId: String(ids.buyer),
        sellerId: String(ids.seller),
        productId: String(ids.product),
        quantity: 2,
        initiatorRole: 'SELLER',
        initiatedBy: String(ids.sellerUser),
        status: 'PROPOSED',
      }),
    );

    const stored = await models.Replacement.findById(sellerProposal.id).lean();
    expect(stored).toEqual(
      expect.objectContaining({
        inrRequestId: ids.inr,
        orderId: ids.order,
        orderItemId: ids.orderItem,
        buyerId: ids.buyer,
        sellerId: ids.seller,
        productId: ids.product,
        quantity: 2,
        status: 'PROPOSED',
        activeKey: 'ACTIVE',
      }),
    );
  });

  it('rejects unrelated owners, closed INR, and mismatched transaction input', async () => {
    await expectStatus(service.propose(ids.otherBuyer, proposalInput()), 403);
    await expectStatus(service.propose(ids.sellerUser2, proposalInput()), 403);
    await expectStatus(
      service.propose(
        ids.buyer,
        proposalInput({ inrRequestId: String(ids.closedInr) }),
      ),
      409,
    );
    await expectStatus(
      service.propose(
        ids.buyer,
        proposalInput({ orderId: String(ids.otherOrder) }),
      ),
      409,
    );
    await expectStatus(
      service.propose(
        ids.buyer,
        proposalInput({ orderItemId: String(ids.orderItem2) }),
      ),
      409,
    );
  });

  it('accepts only by the counterparty from PROPOSED', async () => {
    const buyerProposal = await proposeBuyer();
    await expectStatus(service.accept(ids.buyer, buyerProposal.id), 403);
    await expectStatus(service.accept(ids.otherBuyer, buyerProposal.id), 403);

    const accepted = await service.accept(ids.sellerUser, buyerProposal.id);
    expect(accepted).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        acceptedBy: String(ids.sellerUser),
        acceptedAt: expect.any(Date),
      }),
    );
    await expectStatus(service.decline(ids.sellerUser, buyerProposal.id), 409);

    await models.Replacement.deleteMany({});
    const sellerProposal = await proposeSeller();
    await expectStatus(service.accept(ids.sellerUser, sellerProposal.id), 403);
    const buyerAccepted = await service.accept(ids.buyer, sellerProposal.id);
    expect(buyerAccepted).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        acceptedBy: String(ids.buyer),
        acceptedAt: expect.any(Date),
      }),
    );
  });

  it('declines only by the counterparty from PROPOSED', async () => {
    const buyerProposal = await proposeBuyer();
    await expectStatus(service.decline(ids.buyer, buyerProposal.id), 403);
    const declined = await service.decline(ids.sellerUser, buyerProposal.id, {
      reason: 'NO_STOCK',
      note: 'Cannot replace this item yet',
    });
    expect(declined).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        declinedBy: String(ids.sellerUser),
        declinedAt: expect.any(Date),
        decline: { reason: 'NO_STOCK', note: 'Cannot replace this item yet' },
      }),
    );
    expect(
      await models.Replacement.findById(declined.id).select('activeKey').lean(),
    ).not.toHaveProperty('activeKey');
  });

  it('keeps PROPOSED cancellation as initiator-only withdrawal', async () => {
    const buyerProposal = await proposeBuyer();
    await expectStatus(service.cancel(ids.sellerUser, buyerProposal.id), 403);
    await expectStatus(service.cancel(ids.otherBuyer, buyerProposal.id), 403);
    const buyerCancelled = await service.cancel(ids.buyer, buyerProposal.id, {
      reason: 'WITHDRAWN',
    });
    expect(buyerCancelled).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.buyer),
        cancelledAt: expect.any(Date),
        cancellation: { reason: 'WITHDRAWN' },
      }),
    );

    const sellerProposal = await proposeSeller();
    await expectStatus(service.cancel(ids.buyer, sellerProposal.id), 403);
    await expectStatus(service.cancel(ids.otherBuyer, sellerProposal.id), 403);
    const sellerCancelled = await service.cancel(
      ids.sellerUser,
      sellerProposal.id,
      { reason: 'WITHDRAWN' },
    );
    expect(sellerCancelled).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.sellerUser),
        cancelledAt: expect.any(Date),
        cancellation: { reason: 'WITHDRAWN' },
      }),
    );
  });

  it('allows the PROPOSED counterparty to decline instead of cancel', async () => {
    const buyerProposal = await proposeBuyer();
    const sellerDeclined = await service.decline(
      ids.sellerUser,
      buyerProposal.id,
    );
    expect(sellerDeclined).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        declinedBy: String(ids.sellerUser),
      }),
    );

    const sellerProposal = await proposeSeller();
    const buyerDeclined = await service.decline(ids.buyer, sellerProposal.id);
    expect(buyerDeclined).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        declinedBy: String(ids.buyer),
      }),
    );
  });

  it('allows either legitimate party to cancel ACCEPTED before fulfillment', async () => {
    const sellerProposalBuyerCancels = await proposeSeller();
    await service.accept(ids.buyer, sellerProposalBuyerCancels.id);
    await expectStatus(
      service.cancel(ids.otherBuyer, sellerProposalBuyerCancels.id),
      403,
    );
    const buyerCancelledSellerProposal = await service.cancel(
      ids.buyer,
      sellerProposalBuyerCancels.id,
      { note: 'Buyer wants refund path later' },
    );
    expect(buyerCancelledSellerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.buyer),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
        cancellation: { note: 'Buyer wants refund path later' },
      }),
    );

    const sellerProposalSellerCancels = await proposeSeller();
    await service.accept(ids.buyer, sellerProposalSellerCancels.id);
    const sellerCancelledSellerProposal = await service.cancel(
      ids.sellerUser,
      sellerProposalSellerCancels.id,
      { note: 'Seller cannot fulfill later' },
    );
    expect(sellerCancelledSellerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.sellerUser),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
        cancellation: { note: 'Seller cannot fulfill later' },
      }),
    );

    const buyerProposalBuyerCancels = await proposeBuyer();
    await service.accept(ids.sellerUser, buyerProposalBuyerCancels.id);
    const buyerCancelledBuyerProposal = await service.cancel(
      ids.buyer,
      buyerProposalBuyerCancels.id,
    );
    expect(buyerCancelledBuyerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.buyer),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
      }),
    );

    const buyerProposalSellerCancels = await proposeBuyer();
    await service.accept(ids.sellerUser, buyerProposalSellerCancels.id);
    const sellerCancelledBuyerProposal = await service.cancel(
      ids.sellerUser,
      buyerProposalSellerCancels.id,
    );
    expect(sellerCancelledBuyerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.sellerUser),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
      }),
    );
  });

  it('protects terminal states from later mutation', async () => {
    const declined = await proposeBuyer().then((replacement) =>
      service.decline(ids.sellerUser, replacement.id),
    );
    await expectStatus(service.accept(ids.sellerUser, declined.id), 409);

    const cancelled = await proposeBuyer().then((replacement) =>
      service.cancel(ids.buyer, replacement.id),
    );
    await expectStatus(service.accept(ids.sellerUser, cancelled.id), 409);

    const base = {
      inrRequestId: ids.inr,
      orderId: ids.order,
      orderItemId: ids.orderItem,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      productId: ids.product,
      quantity: 2,
      initiatorRole: 'BUYER',
      initiatedBy: ids.buyer,
    };
    const completed = await models.Replacement.create({
      ...base,
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    const failed = await models.Replacement.create({
      ...base,
      status: 'FAILED',
      failedAt: new Date(),
      failure: { reason: 'LOST' },
    });
    await expectStatus(service.accept(ids.sellerUser, completed._id), 409);
    await expectStatus(service.accept(ids.sellerUser, failed._id), 409);
  });

  it('enforces one active replacement per INR/order item, including concurrent proposals', async () => {
    await proposeBuyer();
    await expectStatus(proposeSeller(), 409);
    expect(
      await models.Replacement.countDocuments({ activeKey: 'ACTIVE' }),
    ).toBe(1);

    await models.Replacement.deleteMany({});
    const results = await Promise.allSettled([proposeBuyer(), proposeSeller()]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(
      await models.Replacement.countDocuments({ activeKey: 'ACTIVE' }),
    ).toBe(1);
  });

  it('allows a new proposal after terminal history exists', async () => {
    const first = await proposeBuyer();
    await service.decline(ids.sellerUser, first.id);
    const second = await proposeSeller();
    expect(second.status).toBe('PROPOSED');
    expect(
      await models.Replacement.countDocuments({ inrRequestId: ids.inr }),
    ).toBe(2);
    expect(
      await models.Replacement.countDocuments({ activeKey: 'ACTIVE' }),
    ).toBe(1);
  });

  it('serializes accept vs decline races with atomic conditional transitions', async () => {
    const proposal = await proposeBuyer();
    const results = await Promise.allSettled([
      service.accept(ids.sellerUser, proposal.id),
      service.decline(ids.sellerUser, proposal.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const stored = await models.Replacement.findById(proposal.id).lean();
    expect(['ACCEPTED', 'DECLINED']).toContain(stored.status);
    if (stored.status === 'ACCEPTED') {
      expect(stored.acceptedAt).toBeInstanceOf(Date);
      expect(stored.declinedAt).toBeUndefined();
    } else {
      expect(stored.declinedAt).toBeInstanceOf(Date);
      expect(stored.acceptedAt).toBeUndefined();
    }
  });

  it('validates model-level timestamp invariants', async () => {
    const base = {
      inrRequestId: ids.inr,
      orderId: ids.order,
      orderItemId: ids.orderItem,
      buyerId: ids.buyer,
      sellerId: ids.seller,
      productId: ids.product,
      quantity: 2,
      initiatorRole: 'BUYER',
      initiatedBy: ids.buyer,
    };
    const validationErrors = async (data) => {
      try {
        await new models.Replacement(data).validate();
        return null;
      } catch (error) {
        return error.errors;
      }
    };

    await expect(
      new models.Replacement({ ...base, status: 'PROPOSED' }).validate(),
    ).resolves.toBeUndefined();
    await expect(
      validationErrors({ ...base, status: 'ACCEPTED' }),
    ).resolves.toHaveProperty('acceptedAt');
    await expect(
      validationErrors({ ...base, status: 'DECLINED' }),
    ).resolves.toHaveProperty('declinedAt');
    await expect(
      validationErrors({ ...base, status: 'CANCELLED' }),
    ).resolves.toHaveProperty('cancelledAt');
    await expect(
      validationErrors({ ...base, status: 'COMPLETED' }),
    ).resolves.toHaveProperty('completedAt');
    await expect(
      validationErrors({ ...base, status: 'FAILED' }),
    ).resolves.toHaveProperty('failedAt');
  });
});
