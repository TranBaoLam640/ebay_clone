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
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let database;
let mongo;
let models;
let service;
let shipmentService;
let productRepository;
let replacementRepository;
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

const productStock = async () =>
  (await models.Product.findById(ids.product).select('stock').lean()).stock;

const notifications = (filter = {}) =>
  models.Notification.find(filter).sort({ createdAt: 1, _id: 1 }).lean();

const acceptedReplacement = async () => {
  const proposal = await proposeBuyer();
  return service.accept(ids.sellerUser, proposal.id);
};

const replacementShipment = async (replacementId) =>
  models.Shipment.findOne({
    replacementId,
    purpose: 'REPLACEMENT',
  }).lean();

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
    import('../../src/modules/shipments/shipment.model.js'),
    import('../../src/modules/notifications/notification.model.js'),
    import('../../src/modules/replacements/replacement.service.js'),
    import('../../src/modules/shipments/shipment.service.js'),
    import('../../src/modules/products/product.repository.js'),
    import('../../src/modules/replacements/replacement.repository.js'),
  ]);
  models = {
    User: modules[0].User,
    Category: modules[1].Category,
    SellerProfile: modules[2].SellerProfile,
    Product: modules[3].Product,
    Order: modules[4].Order,
    INRRequest: modules[5].INRRequest,
    Replacement: modules[6].Replacement,
    Shipment: modules[7].Shipment,
    Notification: modules[8].Notification,
  };
  service = modules[9];
  shipmentService = modules[10];
  productRepository = modules[11];
  replacementRepository = modules[12];
  await Promise.all(Object.values(models).map((model) => model.init()));
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

  it('notifies only the counterparty when a replacement is proposed', async () => {
    const buyerProposal = await proposeBuyer();
    let proposed = await notifications({
      eventType: 'REPLACEMENT_PROPOSED',
    });
    expect(proposed).toHaveLength(1);
    expect(proposed[0]).toEqual(
      expect.objectContaining({
        userId: ids.sellerUser,
        type: 'DISPUTE',
        title: 'Replacement requested',
        referenceType: 'INRRequest',
        referenceId: ids.inr,
        eventKey: `REPLACEMENT_PROPOSED:${buyerProposal.id}:SELLER`,
      }),
    );
    expect(
      await models.Notification.countDocuments({
        userId: ids.buyer,
        eventType: 'REPLACEMENT_PROPOSED',
      }),
    ).toBe(0);

    await service.decline(ids.sellerUser, buyerProposal.id);
    const duplicateDecline = await service
      .decline(ids.sellerUser, buyerProposal.id)
      .catch((error) => error);
    expect(duplicateDecline.status).toBe(409);
    await models.INRRequest.updateOne(
      { _id: ids.inr },
      { resolutionMode: 'NONE' },
    );
    const sellerProposal = await proposeSeller();
    proposed = await notifications({ eventType: 'REPLACEMENT_PROPOSED' });
    expect(proposed).toHaveLength(2);
    expect(proposed[1]).toEqual(
      expect.objectContaining({
        userId: ids.buyer,
        title: 'Replacement offered',
        referenceId: ids.inr,
        eventKey: `REPLACEMENT_PROPOSED:${sellerProposal.id}:BUYER`,
      }),
    );
    expect(
      await models.Notification.countDocuments({
        eventType: 'REPLACEMENT_DECLINED',
      }),
    ).toBe(1);
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
    let acceptedNotifications = await notifications({
      eventType: 'REPLACEMENT_ACCEPTED',
    });
    expect(acceptedNotifications).toHaveLength(1);
    expect(acceptedNotifications[0]).toEqual(
      expect.objectContaining({
        userId: ids.buyer,
        title: 'Replacement accepted',
        referenceType: 'INRRequest',
        referenceId: ids.inr,
        eventKey: `REPLACEMENT_ACCEPTED:${buyerProposal.id}:BUYER`,
      }),
    );
    expect(accepted).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        acceptedBy: String(ids.sellerUser),
        acceptedAt: expect.any(Date),
        inventoryClaimStatus: 'CLAIMED',
        inventoryClaimedAt: expect.any(Date),
        inventoryReleasedAt: null,
      }),
    );
    await expectStatus(service.decline(ids.sellerUser, buyerProposal.id), 409);

    await models.Replacement.deleteMany({});
    await models.INRRequest.updateOne(
      { _id: ids.inr },
      { resolutionMode: 'NONE' },
    );
    const sellerProposal = await proposeSeller();
    await expectStatus(service.accept(ids.sellerUser, sellerProposal.id), 403);
    const buyerAccepted = await service.accept(ids.buyer, sellerProposal.id);
    acceptedNotifications = await notifications({
      eventType: 'REPLACEMENT_ACCEPTED',
    });
    expect(acceptedNotifications).toHaveLength(2);
    expect(acceptedNotifications[1]).toEqual(
      expect.objectContaining({
        userId: ids.sellerUser,
        eventKey: `REPLACEMENT_ACCEPTED:${sellerProposal.id}:SELLER`,
      }),
    );
    expect(buyerAccepted).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        acceptedBy: String(ids.buyer),
        acceptedAt: expect.any(Date),
        inventoryClaimStatus: 'CLAIMED',
        inventoryClaimedAt: expect.any(Date),
      }),
    );
  });

  it('claims inventory on successful acceptance for buyer and seller proposals', async () => {
    const buyerProposal = await proposeBuyer();
    const buyerAccepted = await service.accept(
      ids.sellerUser,
      buyerProposal.id,
    );
    expect(await productStock()).toBe(3);
    expect(buyerAccepted).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        inventoryClaimStatus: 'CLAIMED',
        inventoryClaimedAt: expect.any(Date),
      }),
    );

    await service.cancel(ids.buyer, buyerProposal.id);
    expect(await productStock()).toBe(5);

    const sellerProposal = await proposeSeller();
    const sellerAccepted = await service.accept(ids.buyer, sellerProposal.id);
    expect(await productStock()).toBe(3);
    expect(sellerAccepted).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        inventoryClaimStatus: 'CLAIMED',
        inventoryClaimedAt: expect.any(Date),
      }),
    );
  });

  it('leaves replacement proposed and stock unchanged when acceptance has insufficient stock', async () => {
    await models.Product.updateOne({ _id: ids.product }, { stock: 1 });
    const proposal = await proposeBuyer();
    await expect(
      service.accept(ids.sellerUser, proposal.id),
    ).rejects.toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_STOCK',
    });
    expect(await productStock()).toBe(1);
    expect(await service.findById(proposal.id)).toEqual(
      expect.objectContaining({
        status: 'PROPOSED',
        inventoryClaimStatus: 'UNCLAIMED',
        inventoryClaimedAt: null,
      }),
    );
  });

  it('deducts stock exactly once under concurrent accept attempts', async () => {
    const proposal = await proposeBuyer();
    const results = await Promise.allSettled([
      service.accept(ids.sellerUser, proposal.id),
      service.accept(ids.sellerUser, proposal.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await productStock()).toBe(3);
    expect(await service.findById(proposal.id)).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        inventoryClaimStatus: 'CLAIMED',
      }),
    );
  });

  it('competes safely with normal checkout stock deduction for the last units', async () => {
    await models.Product.updateOne({ _id: ids.product }, { stock: 2 });
    const proposal = await proposeBuyer();
    const results = await Promise.allSettled([
      service.accept(ids.sellerUser, proposal.id),
      productRepository.deductStock(ids.product, 2),
    ]);
    const replacementAccepted = results[0].status === 'fulfilled';
    const checkoutClaimed =
      results[1].status === 'fulfilled' && Boolean(results[1].value);

    expect([replacementAccepted, checkoutClaimed].filter(Boolean)).toHaveLength(
      1,
    );
    expect(await productStock()).toBe(0);
    expect(await service.findById(proposal.id)).toEqual(
      replacementAccepted
        ? expect.objectContaining({
            status: 'ACCEPTED',
            inventoryClaimStatus: 'CLAIMED',
          })
        : expect.objectContaining({
            status: 'PROPOSED',
            inventoryClaimStatus: 'UNCLAIMED',
          }),
    );
  });

  it('rolls back stock deduction when replacement transition fails', async () => {
    const proposal = await proposeBuyer();
    vi.spyOn(replacementRepository, 'transition').mockRejectedValueOnce(
      new Error('injected replacement transition failure'),
    );
    await expect(service.accept(ids.sellerUser, proposal.id)).rejects.toThrow(
      'injected replacement transition failure',
    );
    expect(await productStock()).toBe(5);
    expect(await service.findById(proposal.id)).toEqual(
      expect.objectContaining({
        status: 'PROPOSED',
        inventoryClaimStatus: 'UNCLAIMED',
      }),
    );
  });

  it('does not claim stock from a product that no longer belongs to the seller or is inactive', async () => {
    const wrongSellerProposal = await proposeBuyer();
    await models.Product.updateOne(
      { _id: ids.product },
      { sellerId: ids.seller2 },
    );
    await expectStatus(
      service.accept(ids.sellerUser, wrongSellerProposal.id),
      409,
    );
    expect(await service.findById(wrongSellerProposal.id)).toEqual(
      expect.objectContaining({
        status: 'PROPOSED',
        inventoryClaimStatus: 'UNCLAIMED',
      }),
    );

    await models.Product.updateOne(
      { _id: ids.product },
      { sellerId: ids.seller, status: 'HIDDEN' },
    );
    await expectStatus(
      service.accept(ids.sellerUser, wrongSellerProposal.id),
      409,
    );
    expect(await productStock()).toBe(5);
  });

  it('declines only by the counterparty from PROPOSED', async () => {
    const buyerProposal = await proposeBuyer();
    await expectStatus(service.decline(ids.buyer, buyerProposal.id), 403);
    const declined = await service.decline(ids.sellerUser, buyerProposal.id, {
      reason: 'NO_STOCK',
      note: 'Cannot replace this item yet',
    });
    const declinedNotifications = await notifications({
      eventType: 'REPLACEMENT_DECLINED',
    });
    expect(declinedNotifications).toHaveLength(1);
    expect(declinedNotifications[0]).toEqual(
      expect.objectContaining({
        userId: ids.buyer,
        title: 'Replacement declined',
        referenceType: 'INRRequest',
        referenceId: ids.inr,
        eventKey: `REPLACEMENT_DECLINED:${buyerProposal.id}:BUYER`,
      }),
    );
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
    let cancelledNotifications = await notifications({
      eventType: 'REPLACEMENT_CANCELLED',
    });
    expect(cancelledNotifications).toHaveLength(1);
    expect(cancelledNotifications[0]).toEqual(
      expect.objectContaining({
        userId: ids.sellerUser,
        title: 'Replacement cancelled',
        referenceId: ids.inr,
        eventKey: `REPLACEMENT_CANCELLED:${buyerProposal.id}:SELLER`,
      }),
    );
    expect(await productStock()).toBe(5);
    expect(buyerCancelled).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.buyer),
        cancelledAt: expect.any(Date),
        inventoryClaimStatus: 'UNCLAIMED',
        inventoryClaimedAt: null,
        inventoryReleasedAt: null,
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
    cancelledNotifications = await notifications({
      eventType: 'REPLACEMENT_CANCELLED',
    });
    expect(cancelledNotifications).toHaveLength(2);
    expect(cancelledNotifications[1]).toEqual(
      expect.objectContaining({
        userId: ids.buyer,
        eventKey: `REPLACEMENT_CANCELLED:${sellerProposal.id}:BUYER`,
      }),
    );
    expect(await productStock()).toBe(5);
    expect(sellerCancelled).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.sellerUser),
        cancelledAt: expect.any(Date),
        inventoryClaimStatus: 'UNCLAIMED',
        inventoryClaimedAt: null,
        inventoryReleasedAt: null,
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
    expect(await productStock()).toBe(5);
    expect(sellerDeclined).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        declinedBy: String(ids.sellerUser),
        inventoryClaimStatus: 'UNCLAIMED',
      }),
    );

    const sellerProposal = await proposeSeller();
    const buyerDeclined = await service.decline(ids.buyer, sellerProposal.id);
    expect(await productStock()).toBe(5);
    expect(buyerDeclined).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        declinedBy: String(ids.buyer),
        inventoryClaimStatus: 'UNCLAIMED',
      }),
    );
  });

  it('allows either legitimate party to cancel ACCEPTED before fulfillment', async () => {
    const sellerProposalBuyerCancels = await proposeSeller();
    await service.accept(ids.buyer, sellerProposalBuyerCancels.id);
    expect(await productStock()).toBe(3);
    await expectStatus(
      service.cancel(ids.otherBuyer, sellerProposalBuyerCancels.id),
      403,
    );
    const buyerCancelledSellerProposal = await service.cancel(
      ids.buyer,
      sellerProposalBuyerCancels.id,
      { note: 'Buyer wants refund path later' },
    );
    let cancelledNotifications = await notifications({
      eventType: 'REPLACEMENT_CANCELLED',
    });
    expect(cancelledNotifications).toHaveLength(1);
    expect(cancelledNotifications[0]).toEqual(
      expect.objectContaining({
        userId: ids.sellerUser,
        eventKey: `REPLACEMENT_CANCELLED:${sellerProposalBuyerCancels.id}:SELLER`,
      }),
    );
    expect(await productStock()).toBe(5);
    expect(buyerCancelledSellerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.buyer),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
        inventoryClaimStatus: 'RELEASED',
        inventoryClaimedAt: expect.any(Date),
        inventoryReleasedAt: expect.any(Date),
        cancellation: { note: 'Buyer wants refund path later' },
      }),
    );

    const sellerProposalSellerCancels = await proposeSeller();
    await service.accept(ids.buyer, sellerProposalSellerCancels.id);
    expect(await productStock()).toBe(3);
    const sellerCancelledSellerProposal = await service.cancel(
      ids.sellerUser,
      sellerProposalSellerCancels.id,
      { note: 'Seller cannot fulfill later' },
    );
    cancelledNotifications = await notifications({
      eventType: 'REPLACEMENT_CANCELLED',
    });
    expect(cancelledNotifications).toHaveLength(2);
    expect(cancelledNotifications[1]).toEqual(
      expect.objectContaining({
        userId: ids.buyer,
        eventKey: `REPLACEMENT_CANCELLED:${sellerProposalSellerCancels.id}:BUYER`,
      }),
    );
    expect(await productStock()).toBe(5);
    expect(sellerCancelledSellerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.sellerUser),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
        inventoryClaimStatus: 'RELEASED',
        inventoryClaimedAt: expect.any(Date),
        inventoryReleasedAt: expect.any(Date),
        cancellation: { note: 'Seller cannot fulfill later' },
      }),
    );

    const buyerProposalBuyerCancels = await proposeBuyer();
    await service.accept(ids.sellerUser, buyerProposalBuyerCancels.id);
    expect(await productStock()).toBe(3);
    const buyerCancelledBuyerProposal = await service.cancel(
      ids.buyer,
      buyerProposalBuyerCancels.id,
    );
    expect(await productStock()).toBe(5);
    expect(buyerCancelledBuyerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.buyer),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
        inventoryClaimStatus: 'RELEASED',
        inventoryClaimedAt: expect.any(Date),
        inventoryReleasedAt: expect.any(Date),
      }),
    );

    const buyerProposalSellerCancels = await proposeBuyer();
    await service.accept(ids.sellerUser, buyerProposalSellerCancels.id);
    expect(await productStock()).toBe(3);
    const sellerCancelledBuyerProposal = await service.cancel(
      ids.sellerUser,
      buyerProposalSellerCancels.id,
    );
    expect(await productStock()).toBe(5);
    expect(sellerCancelledBuyerProposal).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        cancelledBy: String(ids.sellerUser),
        acceptedAt: expect.any(Date),
        cancelledAt: expect.any(Date),
        inventoryClaimStatus: 'RELEASED',
        inventoryClaimedAt: expect.any(Date),
        inventoryReleasedAt: expect.any(Date),
      }),
    );
  });

  it('restores stock exactly once under concurrent accepted cancellation attempts', async () => {
    const proposal = await proposeSeller();
    await service.accept(ids.buyer, proposal.id);
    expect(await productStock()).toBe(3);
    const results = await Promise.allSettled([
      service.cancel(ids.buyer, proposal.id),
      service.cancel(ids.sellerUser, proposal.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await productStock()).toBe(5);
    expect(await service.findById(proposal.id)).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        inventoryClaimStatus: 'RELEASED',
      }),
    );
  });

  it('lets the owning seller prepare a replacement shipment without consuming inventory', async () => {
    const accepted = await acceptedReplacement();
    expect(await productStock()).toBe(3);

    const prepared = await service.prepareShipment(
      ids.sellerUser,
      accepted.id,
      { now: new Date('2026-08-22T00:00:00.000Z') },
    );
    const storedShipment = await replacementShipment(accepted.id);
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();

    expect(prepared.replacement).toEqual(
      expect.objectContaining({
        id: accepted.id,
        status: 'ACCEPTED',
        inventoryClaimStatus: 'CLAIMED',
      }),
    );
    expect(prepared.shipment).not.toHaveProperty('purpose');
    expect(storedShipment).toEqual(
      expect.objectContaining({
        orderId: ids.order,
        replacementId: storedReplacement._id,
        buyerId: ids.buyer,
        sellerId: ids.seller,
        purpose: 'REPLACEMENT',
        status: 'READY_FOR_PICKUP',
      }),
    );
    expect(storedShipment.trackingNumber).toMatch(/^SBAY-[A-F0-9]{8}$/);
    expect(storedReplacement.status).toBe('ACCEPTED');
    expect(storedReplacement.inventoryClaimStatus).toBe('CLAIMED');
    expect(await productStock()).toBe(3);
  });

  it('rejects replacement shipment preparation from wrong state, claim, or actor', async () => {
    const proposed = await proposeBuyer();
    await expectStatus(
      service.prepareShipment(ids.sellerUser, proposed.id),
      409,
    );

    const accepted = await service.accept(ids.sellerUser, proposed.id);
    await expectStatus(service.prepareShipment(ids.buyer, accepted.id), 403);
    await expectStatus(
      service.prepareShipment(ids.sellerUser2, accepted.id),
      403,
    );
    await expectStatus(
      service.prepareShipment(ids.otherBuyer, accepted.id),
      403,
    );

    for (const status of [
      'DECLINED',
      'CANCELLED',
      'FULFILLING',
      'COMPLETED',
      'FAILED',
    ]) {
      await models.Replacement.updateOne(
        { _id: accepted.id },
        {
          $set: {
            status,
            inventoryClaimStatus:
              status === 'FULFILLING' ? 'CONSUMED' : 'RELEASED',
            ...(status === 'DECLINED' && { declinedAt: new Date() }),
            ...(status === 'CANCELLED' && { cancelledAt: new Date() }),
            ...(status === 'COMPLETED' && { completedAt: new Date() }),
            ...(status === 'FAILED' && { failedAt: new Date() }),
          },
          $unset: { activeKey: 1 },
        },
      );
      await expectStatus(
        service.prepareShipment(ids.sellerUser, accepted.id),
        409,
      );
    }

    for (const inventoryClaimStatus of ['UNCLAIMED', 'RELEASED', 'CONSUMED']) {
      await models.Replacement.updateOne(
        { _id: accepted.id },
        {
          $set: {
            status: 'ACCEPTED',
            inventoryClaimStatus,
            activeKey: 'ACTIVE',
          },
        },
      );
      await expectStatus(
        service.prepareShipment(ids.sellerUser, accepted.id),
        409,
      );
    }
  });

  it('enforces one shipment per replacement under concurrent preparation', async () => {
    const accepted = await acceptedReplacement();
    const results = await Promise.allSettled([
      service.prepareShipment(ids.sellerUser, accepted.id),
      service.prepareShipment(ids.sellerUser, accepted.id),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    expect(
      results.map((result) =>
        result.status === 'fulfilled'
          ? String(result.value.shipment._id)
          : 'rejected',
      ),
    ).toEqual([expect.any(String), expect.any(String)]);
    expect(
      new Set(
        results.map((result) =>
          result.status === 'fulfilled'
            ? String(result.value.shipment._id)
            : 'rejected',
        ),
      ).size,
    ).toBe(1);
    expect(
      await models.Shipment.countDocuments({
        replacementId: accepted.id,
        purpose: 'REPLACEMENT',
      }),
    ).toBe(1);
    expect(await productStock()).toBe(3);
  });

  it('cancels an accepted replacement with a ready shipment atomically', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);

    const cancelled = await service.cancel(ids.buyer, accepted.id, {
      note: 'Switching away before pickup',
    });
    const storedShipment = await replacementShipment(accepted.id);

    expect(cancelled).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        inventoryClaimStatus: 'RELEASED',
        cancellation: { note: 'Switching away before pickup' },
      }),
    );
    expect(storedShipment.status).toBe('CANCELLED');
    expect(storedShipment.cancelledAt).toBeInstanceOf(Date);
    expect(await productStock()).toBe(5);
  });

  it('notifies seller for refund-instead without a duplicate replacement cancellation notice', async () => {
    const accepted = await acceptedReplacement();
    const result = await service.requestRefundInstead(ids.buyer, ids.inr);

    expect(result.request).toEqual(
      expect.objectContaining({
        requestedResolution: 'REFUND',
        resolutionMode: 'REFUND',
      }),
    );
    expect(await notifications({ eventType: 'INR_REFUND_REQUESTED' })).toEqual([
      expect.objectContaining({
        userId: ids.sellerUser,
        type: 'DISPUTE',
        title: 'Refund requested',
        message: 'The buyer wants a refund instead of the replacement.',
        referenceType: 'INRRequest',
        referenceId: ids.inr,
        eventKey: `INR_REFUND_REQUESTED:${ids.inr}:SELLER`,
      }),
    ]);
    expect(
      await models.Notification.countDocuments({
        eventType: 'REPLACEMENT_CANCELLED',
        eventKey: `REPLACEMENT_CANCELLED:${accepted.id}:SELLER`,
      }),
    ).toBe(0);

    await expect(
      service.requestRefundInstead(ids.buyer, ids.inr),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await models.Notification.countDocuments({
        eventType: 'INR_REFUND_REQUESTED',
      }),
    ).toBe(1);
  });

  it('restores stock once under duplicate prepared replacement cancellation', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);

    const results = await Promise.allSettled([
      service.cancel(ids.buyer, accepted.id),
      service.cancel(ids.sellerUser, accepted.id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await productStock()).toBe(5);
    expect((await replacementShipment(accepted.id)).status).toBe('CANCELLED');
    expect(await service.findById(accepted.id)).toEqual(
      expect.objectContaining({
        status: 'CANCELLED',
        inventoryClaimStatus: 'RELEASED',
      }),
    );
  });

  it('moves replacement pickup to fulfilling and consumes claimed inventory without stock changes', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    expect(await productStock()).toBe(3);

    const pickedUp = await shipmentService.pickup(
      ids.sellerUser2,
      shipment._id,
    );
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();
    const storedShipment = await models.Shipment.findById(shipment._id).lean();

    expect(pickedUp.status).toBe('IN_TRANSIT');
    expect(storedShipment.status).toBe('IN_TRANSIT');
    expect(String(storedShipment.shipperId)).toBe(String(ids.sellerUser2));
    expect(storedReplacement.status).toBe('FULFILLING');
    expect(storedReplacement.inventoryClaimStatus).toBe('CONSUMED');
    expect(await productStock()).toBe(3);
    expect(
      await notifications({ eventType: 'REPLACEMENT_IN_TRANSIT' }),
    ).toEqual([
      expect.objectContaining({
        userId: ids.buyer,
        title: 'Replacement shipped',
        referenceType: 'INRRequest',
        referenceId: ids.inr,
        eventKey: `REPLACEMENT_IN_TRANSIT:${accepted.id}:BUYER`,
      }),
    ]);
  });

  it('makes duplicate replacement pickup stale-safe without extra stock mutation', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);

    const results = await Promise.allSettled([
      shipmentService.pickup(ids.sellerUser2, shipment._id),
      shipmentService.pickup(ids.sellerUser2, shipment._id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await productStock()).toBe(3);
    expect(await service.findById(accepted.id)).toEqual(
      expect.objectContaining({
        status: 'FULFILLING',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect(
      await models.Notification.countDocuments({
        eventType: 'REPLACEMENT_IN_TRANSIT',
      }),
    ).toBe(1);
  });

  it('serializes cancel vs pickup races into one valid branch', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);

    const results = await Promise.allSettled([
      service.cancel(ids.buyer, accepted.id),
      shipmentService.pickup(ids.sellerUser2, shipment._id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();
    const storedShipment = await models.Shipment.findById(shipment._id).lean();
    const stock = await productStock();

    if (storedReplacement.status === 'CANCELLED') {
      expect(storedShipment.status).toBe('CANCELLED');
      expect(storedReplacement.inventoryClaimStatus).toBe('RELEASED');
      expect(stock).toBe(5);
    } else {
      expect(storedReplacement.status).toBe('FULFILLING');
      expect(storedShipment.status).toBe('IN_TRANSIT');
      expect(storedReplacement.inventoryClaimStatus).toBe('CONSUMED');
      expect(stock).toBe(3);
    }
  });

  it('rejects cancellation after replacement shipment is in transit', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.sellerUser2, shipment._id);

    await expectStatus(service.cancel(ids.buyer, accepted.id), 409);
    await expect(
      service.requestRefundInstead(ids.buyer, ids.inr),
    ).rejects.toMatchObject({ status: 409 });

    expect(await service.findById(accepted.id)).toEqual(
      expect.objectContaining({
        status: 'FULFILLING',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect((await models.Shipment.findById(shipment._id).lean()).status).toBe(
      'IN_TRANSIT',
    );
    expect(await productStock()).toBe(3);
    expect(
      await models.Notification.countDocuments({
        eventType: 'INR_REFUND_REQUESTED',
      }),
    ).toBe(0);
  });

  it('delivers replacement shipments without completing the order, INR, or replacement', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.sellerUser2, shipment._id);

    const delivered = await shipmentService.deliver(
      ids.sellerUser2,
      shipment._id,
    );
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();
    const storedInr = await models.INRRequest.findById(ids.inr).lean();
    const storedOrder = await models.Order.findById(ids.order).lean();

    expect(delivered.status).toBe('DELIVERED');
    expect(storedReplacement.status).toBe('FULFILLING');
    expect(storedReplacement.inventoryClaimStatus).toBe('CONSUMED');
    expect(storedInr.status).toBe('OPEN');
    expect(storedOrder.orderStatus).toBe('CONFIRMED');
    expect(await productStock()).toBe(3);
    expect(await notifications({ eventType: 'REPLACEMENT_DELIVERED' })).toEqual(
      [
        expect.objectContaining({
          userId: ids.buyer,
          title: 'Replacement delivered',
          referenceType: 'INRRequest',
          referenceId: ids.inr,
          eventKey: `REPLACEMENT_DELIVERED:${accepted.id}:BUYER`,
        }),
      ],
    );
  });

  it('lets the buyer confirm a delivered replacement and closes the INR without stock changes', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.sellerUser2, shipment._id);
    await shipmentService.deliver(ids.sellerUser2, shipment._id);
    const deliveredAt = (await replacementShipment(accepted.id)).deliveredAt;
    const stockBefore = await productStock();

    const result = await service.confirmReceived(ids.buyer, accepted.id);
    const storedReplacement = await models.Replacement.findById(
      accepted.id,
    ).lean();
    const storedInr = await models.INRRequest.findById(ids.inr).lean();
    const storedShipment = await replacementShipment(accepted.id);

    expect(result.replacement).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect(storedReplacement.completedAt).toBeInstanceOf(Date);
    expect(storedInr).toEqual(
      expect.objectContaining({
        status: 'CLOSED',
        closeReason: 'REPLACEMENT_RECEIVED',
        resolutionMode: 'REPLACEMENT',
      }),
    );
    expect(storedInr.closedAt).toBeInstanceOf(Date);
    expect(storedShipment.status).toBe('DELIVERED');
    expect(storedShipment.deliveredAt).toEqual(deliveredAt);
    expect(await productStock()).toBe(stockBefore);
    expect(await notifications({ eventType: 'REPLACEMENT_COMPLETED' })).toEqual(
      [
        expect.objectContaining({
          userId: ids.sellerUser,
          title: 'Replacement received',
          message: 'The buyer confirmed receiving the replacement.',
          referenceType: 'INRRequest',
          referenceId: ids.inr,
          eventKey: `REPLACEMENT_COMPLETED:${accepted.id}:SELLER`,
        }),
      ],
    );
    expect(
      await models.Notification.countDocuments({
        userId: ids.buyer,
        eventType: 'REPLACEMENT_COMPLETED',
      }),
    ).toBe(0);
  });

  it('rejects confirm received from wrong actors and wrong states', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);

    await expectStatus(
      service.confirmReceived(ids.sellerUser, accepted.id),
      403,
    );
    await expectStatus(
      service.confirmReceived(ids.sellerUser2, accepted.id),
      403,
    );
    await expectStatus(
      service.confirmReceived(ids.otherBuyer, accepted.id),
      403,
    );
    await expectStatus(service.confirmReceived(ids.buyer, accepted.id), 409);

    await shipmentService.pickup(ids.sellerUser2, shipment._id);
    await expectStatus(service.confirmReceived(ids.buyer, accepted.id), 409);
    await shipmentService.deliver(ids.sellerUser2, shipment._id);
    await models.Replacement.updateOne(
      { _id: accepted.id },
      { inventoryClaimStatus: 'CLAIMED' },
    );
    await expectStatus(service.confirmReceived(ids.buyer, accepted.id), 409);
    await models.Replacement.updateOne(
      { _id: accepted.id },
      { inventoryClaimStatus: 'CONSUMED' },
    );
    await models.INRRequest.updateOne(
      { _id: ids.inr },
      { resolutionMode: 'NONE' },
    );
    await expectStatus(service.confirmReceived(ids.buyer, accepted.id), 409);
    expect(
      await notifications({ eventType: 'REPLACEMENT_COMPLETED' }),
    ).toHaveLength(0);
  });

  it('requires committed replacement delivery before confirmation can complete', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.sellerUser2, shipment._id);

    await expectStatus(service.confirmReceived(ids.buyer, accepted.id), 409);
    expect(await service.findById(accepted.id)).toEqual(
      expect.objectContaining({
        status: 'FULFILLING',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect((await replacementShipment(accepted.id)).status).toBe('IN_TRANSIT');
    expect(
      await notifications({ eventType: 'REPLACEMENT_COMPLETED' }),
    ).toHaveLength(0);

    await shipmentService.deliver(ids.sellerUser2, shipment._id);
    await expect(
      service.confirmReceived(ids.buyer, accepted.id),
    ).resolves.toEqual(
      expect.objectContaining({
        replacement: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('keeps duplicate buyer confirmations to one completion notification', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.sellerUser2, shipment._id);
    await shipmentService.deliver(ids.sellerUser2, shipment._id);

    const results = await Promise.allSettled([
      service.confirmReceived(ids.buyer, accepted.id),
      service.confirmReceived(ids.buyer, accepted.id),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(await service.findById(accepted.id)).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect(
      await notifications({ eventType: 'REPLACEMENT_COMPLETED' }),
    ).toHaveLength(1);
    expect(await productStock()).toBe(3);
  });

  it('rejects replacement mutation commands after the INR is closed', async () => {
    const closeInr = () =>
      models.INRRequest.updateOne(
        { _id: ids.inr },
        {
          status: 'CLOSED',
          closedAt: new Date(),
          closeReason: 'ITEM_ARRIVED',
        },
      );
    const reopenInr = async () => {
      await models.Replacement.deleteMany({ inrRequestId: ids.inr });
      await models.Shipment.deleteMany({ replacementId: { $exists: true } });
      await models.INRRequest.updateOne(
        { _id: ids.inr },
        {
          $set: {
            status: 'OPEN',
            resolutionMode: 'NONE',
          },
          $unset: { closedAt: 1, closeReason: 1 },
        },
      );
      await models.Product.updateOne({ _id: ids.product }, { stock: 5 });
    };

    const proposed = await proposeSeller();
    await closeInr();
    await expectStatus(service.accept(ids.buyer, proposed.id), 409);
    expect(await service.findById(proposed.id)).toEqual(
      expect.objectContaining({ status: 'PROPOSED' }),
    );

    await reopenInr();
    const acceptedForPrepare = await acceptedReplacement();
    await closeInr();
    await expectStatus(
      service.prepareShipment(ids.sellerUser, acceptedForPrepare.id),
      409,
    );
    expect(await replacementShipment(acceptedForPrepare.id)).toBeNull();

    await reopenInr();
    const acceptedForPickup = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, acceptedForPickup.id);
    const pickupShipment = await replacementShipment(acceptedForPickup.id);
    await closeInr();
    await expectStatus(
      shipmentService.pickup(ids.sellerUser2, pickupShipment._id),
      409,
    );
    expect((await replacementShipment(acceptedForPickup.id)).status).toBe(
      'READY_FOR_PICKUP',
    );
    expect(await service.findById(acceptedForPickup.id)).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        inventoryClaimStatus: 'CLAIMED',
      }),
    );

    await reopenInr();
    const acceptedForConfirm = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, acceptedForConfirm.id);
    const confirmShipment = await replacementShipment(acceptedForConfirm.id);
    await shipmentService.pickup(ids.sellerUser2, confirmShipment._id);
    await shipmentService.deliver(ids.sellerUser2, confirmShipment._id);
    await closeInr();
    await expectStatus(
      service.confirmReceived(ids.buyer, acceptedForConfirm.id),
      409,
    );
    expect(await service.findById(acceptedForConfirm.id)).toEqual(
      expect.objectContaining({
        status: 'FULFILLING',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
  });

  it('rejects duplicate replacement delivery without duplicate side effects', async () => {
    const accepted = await acceptedReplacement();
    await service.prepareShipment(ids.sellerUser, accepted.id);
    const shipment = await replacementShipment(accepted.id);
    await shipmentService.pickup(ids.sellerUser2, shipment._id);
    await shipmentService.deliver(ids.sellerUser2, shipment._id);

    await expectStatus(
      shipmentService.deliver(ids.sellerUser2, shipment._id),
      409,
    );

    expect(await service.findById(accepted.id)).toEqual(
      expect.objectContaining({
        status: 'FULFILLING',
        inventoryClaimStatus: 'CONSUMED',
      }),
    );
    expect((await models.Order.findById(ids.order).lean()).orderStatus).toBe(
      'CONFIRMED',
    );
    expect(await productStock()).toBe(3);
    expect(
      await models.Notification.countDocuments({
        eventType: 'REPLACEMENT_DELIVERED',
      }),
    ).toBe(1);
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
    await models.INRRequest.updateOne(
      { _id: ids.inr },
      { resolutionMode: 'NONE' },
    );
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
