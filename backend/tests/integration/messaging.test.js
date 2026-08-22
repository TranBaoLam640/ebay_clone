import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import crypto from 'node:crypto';
import { createServer } from 'node:http';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as connectSocket } from 'socket.io-client';
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
let emailService;
let httpServer;
let ioServer;
let baseUrl;
const sockets = new Set();

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

const login = async (email) => {
  const agent = request.agent(app);
  const response = await mutate(agent, 'post', '/auth/login', {
    email,
    password,
  });
  expect(response.status).toBe(200);
  return {
    agent,
    cookie: response.headers['set-cookie']
      .map((value) => value.split(';')[0])
      .join('; '),
  };
};

const seed = async () => {
  const objectId = () => new mongoose.Types.ObjectId();
  ids = {
    buyer: objectId(),
    other: objectId(),
    sellerUser: objectId(),
    seller: objectId(),
    category: objectId(),
    product: objectId(),
    order: objectId(),
    orderItem: objectId(),
    address: objectId(),
    productUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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
      _id: ids.other,
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
      fullName: 'Seller Owner',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
  ]);
  await models.Category.create({
    _id: ids.category,
    uuid: '10000000-0000-4000-8000-000000000001',
    name: 'Electronics',
    slug: 'electronics',
    status: 'ACTIVE',
  });
  await models.SellerProfile.create({
    _id: ids.seller,
    userId: ids.sellerUser,
    displayName: 'Seller Store',
    status: 'ACTIVE',
  });
  await models.Product.create({
    _id: ids.product,
    uuid: ids.productUuid,
    sellerId: ids.seller,
    categoryId: ids.category,
    title: 'Laptop',
    description: 'Fast laptop',
    price: 100000,
    stock: 2,
    images: ['https://example.test/laptop.png'],
    status: 'ACTIVE',
    listingType: 'FIXED',
    offersEnabled: true,
  });
  await models.Order.create({
    _id: ids.order,
    buyerId: ids.buyer,
    sellerId: ids.seller,
    orderStatus: 'CONFIRMED',
    subtotal: 100000,
    discount: 0,
    total: 100000,
    items: [
      {
        _id: ids.orderItem,
        productId: ids.product,
        sellerId: ids.seller,
        quantity: 1,
        title: 'Laptop',
        image: 'https://example.test/laptop.png',
        unitPrice: 100000,
        itemSubtotal: 100000,
      },
    ],
  });
  await models.Address.create({
    _id: ids.address,
    userId: ids.buyer,
    recipientName: 'Buyer',
    phone: '0123456789',
    addressLine: '1 Main',
    ward: 'Ward',
    district: 'District',
    province: 'Province',
    country: 'VN',
  });
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 120000 }],
  });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.EMAIL_FROM = 'no-reply@example.test';
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  ({ hashPassword: passwordHash } =
    await import('../../src/common/utils/hash.js').then(async (mod) => ({
      hashPassword: await mod.hashPassword(password),
    })));
  models = {
    User: (await import('../../src/modules/users/user.model.js')).User,
    Category: (await import('../../src/modules/categories/category.model.js'))
      .Category,
    SellerProfile: (
      await import('../../src/modules/sellers/seller-profile.model.js')
    ).SellerProfile,
    Product: (await import('../../src/modules/products/product.model.js'))
      .Product,
    Cart: (await import('../../src/modules/carts/cart.model.js')).Cart,
    Conversation: (
      await import('../../src/modules/conversations/conversation.model.js')
    ).Conversation,
    Address: (await import('../../src/modules/addresses/address.model.js'))
      .Address,
    Order: (await import('../../src/modules/orders/order.model.js')).Order,
    Offer: (await import('../../src/modules/offers/offer.model.js')).Offer,
    INRRequest: (
      await import('../../src/modules/inr-requests/inr-request.model.js')
    ).INRRequest,
    Replacement: (
      await import('../../src/modules/replacements/replacement.model.js')
    ).Replacement,
    Shipment: (await import('../../src/modules/shipments/shipment.model.js'))
      .Shipment,
    Message: (await import('../../src/modules/conversations/message.model.js'))
      .Message,
  };
  await Promise.all(Object.values(models).map((model) => model.init?.()));
  ({ emailService } =
    await import('../../src/common/services/email.service.js'));
  ({ app } = await import('../../src/app.js'));
  const { initSocket } = await import('../../src/socket/socket.js');
  httpServer = createServer(app);
  ioServer = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

beforeEach(async () => {
  storageSend.mockResolvedValue({});
  vi.spyOn(emailService, 'sendMessageCopy').mockResolvedValue(true);
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
  await seed();
});

afterAll(async () => {
  vi.restoreAllMocks();
  for (const socket of sockets) socket.disconnect();
  ioServer?.close();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (database) await database.disconnectDatabase();
  if (mongo) await mongo.stop();
});

const createConversation = async (buyer) =>
  mutate(buyer.agent, 'post', '/conversations', {
    productId: ids.productUuid,
  }).then((response) => {
    expect(response.status).toBe(201);
    return response.body.data;
  });

const connectAs = (session) => {
  const socket = connectSocket(baseUrl, {
    path: '/socket.io/',
    extraHeaders: { Cookie: session.cookie },
    forceNew: true,
    reconnection: false,
  });
  sockets.add(socket);
  socket.on('disconnect', () => sockets.delete(socket));
  return socket;
};

const waitFor = (socket, event) =>
  new Promise((resolve) => socket.once(event, resolve));

const addCartItem = (session, productId, quantity = 1) =>
  mutate(session.agent, 'post', '/cart/items', {
    productId,
    quantity,
  }).then((response) => {
    expect(response.status).toBe(200);
    return response.body.data.items.find(
      (item) => item.productId === productId,
    );
  });

const checkout = async (session, body) => {
  const token = await csrf(session.agent);
  return session.agent
    .post(`${prefix}/checkout`)
    .set('x-csrf-token', token)
    .set('Idempotency-Key', crypto.randomUUID())
    .send(body);
};

const createInrRequest = async (conversationId, overrides = {}) =>
  models.INRRequest.create({
    buyerId: ids.buyer,
    sellerId: ids.seller,
    orderId: ids.order,
    orderItemId: ids.orderItem,
    productId: ids.product,
    shipmentId: new mongoose.Types.ObjectId(),
    requestedResolution: 'WANT_ITEM',
    quantityMissing: 1,
    details: 'Package did not arrive',
    requestAmount: 100000,
    currency: 'VND',
    conversationId,
    status: 'OPEN',
    ...overrides,
  });

const uploadAttachments = async (session, conversationId, files) => {
  const token = await csrf(session.agent);
  let operation = session.agent
    .post(`${prefix}/conversations/${conversationId}/attachments`)
    .set('x-csrf-token', token);
  for (const file of files) {
    operation = operation.attach('files', Buffer.alloc(file.size, 'a'), {
      filename: file.name,
      contentType: file.mime,
    });
  }
  return operation;
};

describe('buyer/seller messaging', () => {
  it('creates and reuses a pre-purchase conversation and blocks outsiders', async () => {
    const buyer = await login('buyer@example.test');
    const first = await mutate(buyer.agent, 'post', '/conversations', {
      productId: ids.productUuid,
    });
    expect(first.status).toBe(201);
    expect(first.body.data.seller).toEqual(
      expect.objectContaining({
        displayName: 'Seller Store',
        username: 'seller',
        email: 'seller@example.test',
      }),
    );
    const second = await mutate(buyer.agent, 'post', '/conversations', {
      productId: ids.productUuid,
    });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    await models.Conversation.create({
      buyerId: ids.buyer,
      sellerId: ids.seller,
      productId: ids.product,
      type: 'POST_PURCHASE',
      orderId: ids.order,
      lastMessageAt: new Date(Date.now() + 1000),
    });
    const inbox = await buyer.agent.get(`${prefix}/conversations`).expect(200);
    expect(
      inbox.body.data.filter(
        (item) =>
          item.buyer.id === String(ids.buyer) &&
          item.seller.id === String(ids.seller) &&
          item.product.id === ids.productUuid,
      ),
    ).toHaveLength(1);

    const other = await login('other@example.test');
    await other.agent
      .get(`${prefix}/conversations/${first.body.data.id}/messages`)
      .expect(403);
  });

  it('lets buyer and seller exchange persistent messages using SellerProfile.userId authorization', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const buyerMessage = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        content: 'Is it available?',
        sendCopyToEmail: true,
      },
    );
    expect(buyerMessage.status).toBe(201);
    expect(emailService.sendMessageCopy).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.test' }),
    );

    const sellerMessage = await mutate(
      seller.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        content: 'Yes, it is.',
        sendCopyToEmail: false,
      },
    );
    expect(sellerMessage.status).toBe(201);

    const history = await buyer.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(history.body.data.map((message) => message.content)).toEqual([
      'Is it available?',
      'Yes, it is.',
    ]);
    expect(history.body.data.map((message) => message.sender)).toEqual([
      expect.objectContaining({
        id: String(ids.buyer),
        displayName: 'Buyer',
        username: 'buyer',
      }),
      expect.objectContaining({
        id: String(ids.sellerUser),
        displayName: 'Seller Owner',
        username: 'seller',
      }),
    ]);
  });

  it('delivers buyer and seller messages through Socket.IO without duplicate history rows', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const sellerSocket = connectAs(seller);
    await waitFor(sellerSocket, 'connect');
    await new Promise((resolve) =>
      sellerSocket.emit('conversation:join', conversation.id, resolve),
    ).then((ack) => expect(ack).toEqual(expect.objectContaining({ ok: true })));

    const realtime = waitFor(sellerSocket, 'message:new');
    const sent = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        clientMessageId: 'client-1',
        content: 'Realtime hello',
        sendCopyToEmail: false,
      },
    );
    expect(sent.status).toBe(201);
    await expect(realtime).resolves.toEqual(
      expect.objectContaining({
        content: 'Realtime hello',
        clientMessageId: 'client-1',
        senderId: String(ids.buyer),
        sender: expect.objectContaining({
          id: String(ids.buyer),
          displayName: 'Buyer',
          username: 'buyer',
        }),
      }),
    );
    const duplicate = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        clientMessageId: 'client-1',
        content: 'Realtime hello',
        sendCopyToEmail: false,
      },
    );
    expect(duplicate.body.data.id).toBe(sent.body.data.id);
    expect(
      await models.Message.countDocuments({ conversationId: conversation.id }),
    ).toBe(1);
    sellerSocket.disconnect();
  });

  it('rejects unauthorized Socket.IO room joins', async () => {
    const buyer = await login('buyer@example.test');
    const other = await login('other@example.test');
    const conversation = await createConversation(buyer);
    const socket = connectAs(other);
    await waitFor(socket, 'connect');
    const ack = await new Promise((resolve) =>
      socket.emit('conversation:join', conversation.id, resolve),
    );
    expect(ack).toEqual(expect.objectContaining({ ok: false }));
    socket.disconnect();
  });

  it('preserves offer history through buyer/seller counters and accept', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 80000,
      },
    ).then((response) => response.body.data);
    const sellerCounter = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/counter`,
      {
        price: 90000,
      },
    ).then((response) => response.body.data);
    const buyerCounter = await mutate(
      buyer.agent,
      'post',
      `/offers/${sellerCounter.id}/counter`,
      {
        price: 85000,
      },
    ).then((response) => response.body.data);
    const accepted = await mutate(
      seller.agent,
      'post',
      `/offers/${buyerCounter.id}/accept`,
    );
    expect(accepted.status).toBe(200);
    const acceptedAgain = await mutate(
      seller.agent,
      'post',
      `/offers/${buyerCounter.id}/accept`,
    );
    expect(acceptedAgain.status).toBe(409);

    const offers = await models.Offer.find({ conversationId: conversation.id })
      .sort({ createdAt: 1 })
      .lean();
    expect(offers.map((item) => item.amount)).toEqual([80000, 90000, 85000]);
    expect(offers.map((item) => item.status)).toEqual([
      'COUNTERED',
      'COUNTERED',
      'ACCEPTED',
    ]);
  });

  it('enforces monotonic counteroffer price rules server-side', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const createBuyerOffer = (price) =>
      mutate(buyer.agent, 'post', `/conversations/${conversation.id}/offers`, {
        price,
      }).then((response) => {
        expect(response.status).toBe(201);
        return response.body.data;
      });

    const invalidSellerCounter = async (price) => {
      const offer = await createBuyerOffer(60000);
      const response = await mutate(
        seller.agent,
        'post',
        `/offers/${offer.id}/counter`,
        { price },
      );
      expect(response.status).toBe(409);
      await models.Offer.updateOne(
        { _id: offer.id },
        { $set: { status: 'WITHDRAWN' } },
      );
    };

    await invalidSellerCounter(60000);
    await invalidSellerCounter(50000);
    await invalidSellerCounter(100000);

    const acceptedSellerCounter = await createBuyerOffer(60000).then((offer) =>
      mutate(seller.agent, 'post', `/offers/${offer.id}/counter`, {
        price: 70000,
      }),
    );
    expect(acceptedSellerCounter.status).toBe(201);
    await models.Offer.updateOne(
      { _id: acceptedSellerCounter.body.data.id },
      { $set: { status: 'WITHDRAWN' } },
    );

    const chainForBuyerFail = async () => {
      const offer = await createBuyerOffer(60000);
      return mutate(seller.agent, 'post', `/offers/${offer.id}/counter`, {
        price: 80000,
      }).then((response) => {
        expect(response.status).toBe(201);
        return response.body.data;
      });
    };

    for (const price of [59000, 60000, 80000]) {
      const sellerCounter = await chainForBuyerFail();
      const response = await mutate(
        buyer.agent,
        'post',
        `/offers/${sellerCounter.id}/counter`,
        { price },
      );
      expect(response.status).toBe(409);
      await models.Offer.updateOne(
        { _id: sellerCounter.id },
        { $set: { status: 'WITHDRAWN' } },
      );
    }

    const sellerCounter = await chainForBuyerFail();
    const acceptedBuyerCounter = await mutate(
      buyer.agent,
      'post',
      `/offers/${sellerCounter.id}/counter`,
      {
        price: 70000,
      },
    );
    expect(acceptedBuyerCounter.status).toBe(201);
  }, 90000);

  it('enforces offer quantity and seller counter quantity bounds', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    await models.Product.updateOne({ _id: ids.product }, { stock: 5 });

    for (const quantity of [1, 3, 5]) {
      const response = await mutate(
        buyer.agent,
        'post',
        `/conversations/${conversation.id}/offers`,
        { price: 60000, quantity },
      );
      expect(response.status).toBe(201);
      expect(response.body.data.quantity).toBe(quantity);
      await models.Offer.updateOne(
        { _id: response.body.data.id },
        { $set: { status: 'WITHDRAWN' } },
      );
    }

    for (const quantity of [0, 6, 1.5]) {
      const response = await mutate(
        buyer.agent,
        'post',
        `/conversations/${conversation.id}/offers`,
        { price: 60000, quantity },
      );
      expect([400, 409]).toContain(response.status);
    }

    const buyerOffer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 60000, quantity: 3 },
    ).then((response) => response.body.data);

    const sellerQuantity2 = await mutate(
      seller.agent,
      'post',
      `/offers/${buyerOffer.id}/counter`,
      { price: 70000, quantity: 2 },
    );
    expect(sellerQuantity2.status).toBe(201);
    expect(sellerQuantity2.body.data.quantity).toBe(2);
    await models.Offer.updateOne(
      { _id: sellerQuantity2.body.data.id },
      { $set: { status: 'WITHDRAWN' } },
    );

    const buyerOffer2 = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 60000, quantity: 3 },
    ).then((response) => response.body.data);
    const sellerQuantity4 = await mutate(
      seller.agent,
      'post',
      `/offers/${buyerOffer2.id}/counter`,
      { price: 70000, quantity: 4 },
    );
    expect(sellerQuantity4.status).toBe(409);
  }, 90000);

  it('declines offers and rejects resolved or expired offer actions', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 75000,
      },
    ).then((response) => response.body.data);
    const declined = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/decline`,
    );
    expect(declined.status).toBe(200);
    const counterDeclined = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/counter`,
      {
        price: 76000,
      },
    );
    expect(counterDeclined.status).toBe(409);

    const expiring = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 70000,
      },
    ).then((response) => response.body.data);
    await models.Offer.updateOne(
      { _id: expiring.id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    const acceptExpired = await mutate(
      seller.agent,
      'post',
      `/offers/${expiring.id}/accept`,
    );
    expect(acceptExpired.status).toBe(409);
  });

  it('lets only the pending proposal sender retract and emits offer updates', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const sellerSocket = connectAs(seller);
    await waitFor(sellerSocket, 'connect');
    await new Promise((resolve) =>
      sellerSocket.emit('conversation:join', conversation.id, resolve),
    );

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 78000,
      },
    ).then((response) => response.body.data);
    const recipientRetract = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/retract`,
    );
    expect(recipientRetract.status).toBe(403);

    const offerUpdated = waitFor(sellerSocket, 'offer:updated');
    const retracted = await mutate(
      buyer.agent,
      'post',
      `/offers/${offer.id}/retract`,
    );
    expect(retracted.status).toBe(200);
    expect(retracted.body.data).toEqual(
      expect.objectContaining({
        id: offer.id,
        conversationId: conversation.id,
        amount: 78000,
        offerPrice: 78000,
        status: 'WITHDRAWN',
      }),
    );
    await expect(offerUpdated).resolves.toEqual(
      expect.objectContaining({
        id: offer.id,
        conversationId: conversation.id,
        status: 'WITHDRAWN',
      }),
    );

    const acceptRetracted = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/accept`,
    );
    expect(acceptRetracted.status).toBe(409);
    const persisted = await models.Offer.findById(offer.id).lean();
    expect(persisted.amount).toBe(78000);
    expect(persisted.status).toBe('WITHDRAWN');

    sellerSocket.disconnect();
  });

  it('retracts pending counteroffers without reactivating parent offers', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 80000,
      },
    ).then((response) => response.body.data);
    const sellerCounter = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/counter`,
      {
        price: 90000,
      },
    ).then((response) => response.body.data);
    const buyerRetractCounter = await mutate(
      buyer.agent,
      'post',
      `/offers/${sellerCounter.id}/retract`,
    );
    expect(buyerRetractCounter.status).toBe(403);
    const sellerRetractCounter = await mutate(
      seller.agent,
      'post',
      `/offers/${sellerCounter.id}/retract`,
    );
    expect(sellerRetractCounter.status).toBe(200);
    expect(sellerRetractCounter.body.data.status).toBe('WITHDRAWN');

    const offers = await models.Offer.find({ conversationId: conversation.id })
      .sort({ createdAt: 1 })
      .lean();
    expect(offers.map((item) => item.amount)).toEqual([80000, 90000]);
    expect(offers.map((item) => item.status)).toEqual([
      'COUNTERED',
      'WITHDRAWN',
    ]);
  });

  it('rejects checkout with a retracted offer', async () => {
    const buyer = await login('buyer@example.test');
    const conversation = await createConversation(buyer);
    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 82000,
      },
    ).then((response) => response.body.data);
    const retracted = await mutate(
      buyer.agent,
      'post',
      `/offers/${offer.id}/retract`,
    );
    expect(retracted.status).toBe(200);
    const cartItem = await addCartItem(buyer, ids.productUuid, 1);

    const response = await checkout(buyer, {
      selectedCartItemIds: [cartItem.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: offer.id,
    });
    expect(response.status).toBe(409);
  });

  it('upgrades pre-purchase conversation to post-purchase, preserves history, and allows a new offer when no active cycle remains', async () => {
    const buyer = await login('buyer@example.test');
    const conversation = await createConversation(buyer);
    await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        content: 'Before buying',
        sendCopyToEmail: false,
      },
    );

    const upgraded = await mutate(buyer.agent, 'post', '/conversations', {
      productId: ids.productUuid,
      orderId: String(ids.order),
    }).then((response) => response.body.data);
    expect(upgraded.id).toBe(conversation.id);
    expect(upgraded.type).toBe('POST_PURCHASE');
    const history = await buyer.agent
      .get(`${prefix}/conversations/${upgraded.id}/messages`)
      .expect(200);
    expect(history.body.data.map((message) => message.content)).toContain(
      'Before buying',
    );

    const postPurchaseOffer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${upgraded.id}/offers`,
      {
        price: 70000,
      },
    );
    expect(postPurchaseOffer.status).toBe(201);
    expect(postPurchaseOffer.body.data.conversationId).toBe(conversation.id);
    expect(postPurchaseOffer.body.data.status).toBe('PENDING');
  });

  it('blocks a second initial offer while a pending or accepted proposal is active', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const pending = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 70000 },
    );
    expect(pending.status).toBe(201);
    const secondPending = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 71000 },
    );
    expect(secondPending.status).toBe(409);

    await mutate(
      seller.agent,
      'post',
      `/offers/${pending.body.data.id}/accept`,
    );
    const secondAccepted = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 72000 },
    );
    expect(secondAccepted.status).toBe(409);
  });

  it('allows a new initial offer after withdrawn, declined, or expired cycles', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);

    const withdrawn = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 70000 },
    ).then((response) => response.body.data);
    await mutate(buyer.agent, 'post', `/offers/${withdrawn.id}/retract`);
    const afterWithdraw = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 71000 },
    );
    expect(afterWithdraw.status).toBe(201);

    await mutate(
      seller.agent,
      'post',
      `/offers/${afterWithdraw.body.data.id}/decline`,
    );
    const afterDecline = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 72000 },
    );
    expect(afterDecline.status).toBe(201);

    await models.Offer.updateOne(
      { _id: afterDecline.body.data.id },
      { $set: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 1000) } },
    );
    const afterExpired = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 73000 },
    );
    expect(afterExpired.status).toBe(201);
  });

  it('allows repeat purchased offer cycles in one conversation with independent offer and order records', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    await models.Product.updateOne({ _id: ids.product }, { stock: 10 });
    const conversation = await createConversation(buyer);

    const purchaseOffer = async (price, quantity = 1) => {
      const offer = await mutate(
        buyer.agent,
        'post',
        `/conversations/${conversation.id}/offers`,
        { price, quantity },
      ).then((response) => {
        expect(response.status).toBe(201);
        return response.body.data;
      });
      await mutate(seller.agent, 'post', `/offers/${offer.id}/accept`).then(
        (response) => expect(response.status).toBe(200),
      );
      const cartItem = await addCartItem(buyer, ids.productUuid, quantity);
      const checkoutResponse = await checkout(buyer, {
        selectedCartItemIds: [cartItem.id],
        addressId: String(ids.address),
        paymentMethod: 'COD',
        offerId: offer.id,
      });
      expect(checkoutResponse.status).toBe(201);
      return {
        offer,
        order: checkoutResponse.body.data.orders[0],
      };
    };

    const first = await purchaseOffer(70000, 1);
    const firstPersisted = await models.Offer.findById(first.offer.id).lean();
    expect(firstPersisted.status).toBe('PURCHASED');

    const reuseFirst = await addCartItem(buyer, ids.productUuid, 1).then(
      (cartItem) =>
        checkout(buyer, {
          selectedCartItemIds: [cartItem.id],
          addressId: String(ids.address),
          paymentMethod: 'COD',
          offerId: first.offer.id,
        }),
    );
    expect(reuseFirst.status).toBe(409);
    await models.Cart.deleteMany({ userId: ids.buyer });

    const second = await purchaseOffer(72000, 2);
    expect(second.offer.id).not.toBe(first.offer.id);
    expect(second.order._id).not.toBe(first.order._id);

    const thirdOffer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 73000, quantity: 3 },
    );
    expect(thirdOffer.status).toBe(201);
    expect(thirdOffer.body.data.conversationId).toBe(conversation.id);

    const offers = await models.Offer.find({ conversationId: conversation.id })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    expect(offers.map((offer) => offer.status)).toEqual([
      'PURCHASED',
      'PURCHASED',
      'PENDING',
    ]);
    expect(offers.map((offer) => String(offer._id))).toEqual([
      first.offer.id,
      second.offer.id,
      thirdOffer.body.data.id,
    ]);
    expect(String(offers[0].orderId)).toBe(first.order._id);
    expect(String(offers[1].orderId)).toBe(second.order._id);
    expect(
      await models.Conversation.countDocuments({
        buyerId: ids.buyer,
        sellerId: ids.seller,
        productId: ids.product,
      }),
    ).toBe(1);

    const history = await buyer.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(history.body.data.filter((message) => message.offer)).toHaveLength(
      3,
    );
  });

  it('rejects a new offer after purchase when the listing is no longer eligible', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    await models.Product.updateOne({ _id: ids.product }, { stock: 5 });
    const conversation = await createConversation(buyer);

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      { price: 70000 },
    ).then((response) => response.body.data);
    await mutate(seller.agent, 'post', `/offers/${offer.id}/accept`);
    const cartItem = await addCartItem(buyer, ids.productUuid, 1);
    await checkout(buyer, {
      selectedCartItemIds: [cartItem.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: offer.id,
    }).then((response) => expect(response.status).toBe(201));

    for (const patch of [
      { stock: 0 },
      { stock: 5, offersEnabled: false },
      { offersEnabled: true, status: 'HIDDEN' },
      { status: 'ACTIVE', listingType: 'AUCTION' },
    ]) {
      await models.Product.updateOne({ _id: ids.product }, { $set: patch });
      const response = await mutate(
        buyer.agent,
        'post',
        `/conversations/${conversation.id}/offers`,
        { price: 71000 },
      );
      expect(response.status).toBe(409);
    }
  });

  it('emits purchased offer and post-purchase conversation updates after accepted offer checkout', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const sellerSocket = connectAs(seller);
    await waitFor(sellerSocket, 'connect');
    await new Promise((resolve) =>
      sellerSocket.emit('conversation:join', conversation.id, resolve),
    );

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 85000,
      },
    ).then((response) => response.body.data);
    const accepted = await mutate(
      seller.agent,
      'post',
      `/offers/${offer.id}/accept`,
    );
    expect(accepted.status).toBe(200);
    const cartItem = await addCartItem(buyer, ids.productUuid, 1);

    const offerUpdated = waitFor(sellerSocket, 'offer:updated');
    const conversationUpdated = waitFor(sellerSocket, 'conversation:updated');
    const response = await checkout(buyer, {
      selectedCartItemIds: [cartItem.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: offer.id,
    });
    expect(response.status).toBe(201);
    const orderId = response.body.data.orders[0]._id;

    await expect(offerUpdated).resolves.toEqual(
      expect.objectContaining({
        id: offer.id,
        conversationId: conversation.id,
        status: 'PURCHASED',
        offerPrice: 85000,
        amount: 85000,
        quantity: 1,
        orderId,
        usedAt: expect.any(String),
      }),
    );
    await expect(conversationUpdated).resolves.toEqual(
      expect.objectContaining({
        id: conversation.id,
        type: 'POST_PURCHASE',
        orderId,
      }),
    );

    sellerSocket.disconnect();
  });

  it('checks out accepted multi-quantity offers without creating duplicate conversations', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    await models.Product.updateOne({ _id: ids.product }, { stock: 5 });
    const conversation = await createConversation(buyer);

    const offer = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/offers`,
      {
        price: 80000,
        quantity: 3,
      },
    ).then((response) => {
      expect(response.status).toBe(201);
      return response.body.data;
    });
    await mutate(seller.agent, 'post', `/offers/${offer.id}/accept`).then(
      (response) => expect(response.status).toBe(200),
    );

    const wrongQuantityItem = await addCartItem(buyer, ids.productUuid, 2);
    await checkout(buyer, {
      selectedCartItemIds: [wrongQuantityItem.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: offer.id,
    }).then((response) => expect(response.status).toBe(409));

    await models.Cart.deleteMany({ userId: ids.buyer });
    const cartItem = await addCartItem(buyer, ids.productUuid, 3);
    const response = await checkout(buyer, {
      selectedCartItemIds: [cartItem.id],
      addressId: String(ids.address),
      paymentMethod: 'COD',
      offerId: offer.id,
    });
    expect(response.status).toBe(201);
    const order = response.body.data.orders[0];
    expect(order.subtotal).toBe(240000);
    expect(order.items[0]).toEqual(
      expect.objectContaining({
        quantity: 3,
        unitPrice: 80000,
        itemSubtotal: 240000,
        offerId: offer.id,
        finalPrice: 80000,
      }),
    );

    const afterPurchase = await mutate(buyer.agent, 'post', '/conversations', {
      productId: ids.productUuid,
      orderId: order._id,
    });
    expect(afterPurchase.status).toBe(201);
    expect(afterPurchase.body.data.id).toBe(conversation.id);
    expect(afterPurchase.body.data.type).toBe('POST_PURCHASE');
    expect(
      await models.Conversation.countDocuments({
        buyerId: ids.buyer,
        sellerId: ids.seller,
        productId: ids.product,
      }),
    ).toBe(1);
  });

  it('only sends message copy email when requested and uses authenticated user email', async () => {
    const buyer = await login('buyer@example.test');
    const conversation = await createConversation(buyer);
    await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        content: 'No copy',
        sendCopyToEmail: false,
      },
    );
    expect(emailService.sendMessageCopy).not.toHaveBeenCalled();
    await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        content: 'Copy me',
        sendCopyToEmail: true,
      },
    );
    expect(emailService.sendMessageCopy).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.test', content: 'Copy me' }),
    );
  });

  it('uploads image/file attachments, persists metadata, and emits normalized realtime payload', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const sellerSocket = connectAs(seller);
    await waitFor(sellerSocket, 'connect');
    await new Promise((resolve) =>
      sellerSocket.emit('conversation:join', conversation.id, resolve),
    );

    const upload = await uploadAttachments(buyer, conversation.id, [
      { name: 'photo.jpg', mime: 'image/jpeg', size: 128 },
      { name: 'project-specification.pdf', mime: 'application/pdf', size: 256 },
    ]);
    expect(upload.status).toBe(201);
    expect(upload.body.data).toEqual([
      expect.objectContaining({
        url: expect.stringContaining('https://cdn.example.test/sbay/messages/'),
        fileName: 'photo.jpg',
        mimeType: 'image/jpeg',
        size: 128,
        type: 'IMAGE',
      }),
      expect.objectContaining({
        fileName: 'project-specification.pdf',
        mimeType: 'application/pdf',
        size: 256,
        type: 'FILE',
      }),
    ]);

    const realtime = waitFor(sellerSocket, 'message:new');
    const sent = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        clientMessageId: 'attachments-1',
        type: 'FILE',
        content: 'See attached',
        attachments: upload.body.data,
        sendCopyToEmail: true,
      },
    );
    expect(sent.status).toBe(201);
    await expect(realtime).resolves.toEqual(
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({ fileName: 'photo.jpg', type: 'IMAGE' }),
          expect.objectContaining({
            fileName: 'project-specification.pdf',
            type: 'FILE',
          }),
        ]),
      }),
    );
    const history = await seller.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(history.body.data[0].attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileName: 'photo.jpg', type: 'IMAGE' }),
        expect.objectContaining({
          fileName: 'project-specification.pdf',
          type: 'FILE',
        }),
      ]),
    );
    expect(emailService.sendMessageCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.test',
        attachments: expect.arrayContaining([
          expect.objectContaining({ fileName: 'photo.jpg' }),
        ]),
      }),
    );
    sellerSocket.disconnect();
  });

  it('creates seller- and buyer-initiated structured replacement proposal messages', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const inr = await createInrRequest(conversation.id);

    const sellerProposal = await mutate(
      seller.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    );
    expect(sellerProposal.status).toBe(201);
    expect(sellerProposal.body.data).toEqual(
      expect.objectContaining({
        conversationId: conversation.id,
        type: 'REPLACEMENT',
        replacement: expect.objectContaining({
          inrRequestId: String(inr._id),
          status: 'PROPOSED',
          initiatorRole: 'SELLER',
          quantity: 1,
          availableActions: [],
        }),
      }),
    );
    await models.Replacement.updateOne(
      { _id: sellerProposal.body.data.replacement.id },
      {
        $set: {
          status: 'DECLINED',
          declinedBy: ids.buyer,
          declinedAt: new Date(),
        },
        $unset: { activeKey: 1 },
      },
    );
    await models.INRRequest.updateOne(
      { _id: inr._id },
      { $set: { resolutionMode: 'NONE' } },
    );

    const buyerProposal = await mutate(
      buyer.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    );
    expect(buyerProposal.status).toBe(201);
    expect(buyerProposal.body.data.replacement).toEqual(
      expect.objectContaining({
        status: 'PROPOSED',
        initiatorRole: 'BUYER',
        quantity: 1,
      }),
    );

    expect(
      await models.Replacement.countDocuments({ inrRequestId: inr._id }),
    ).toBe(2);
    expect(
      await models.Message.countDocuments({
        conversationId: conversation.id,
        type: 'REPLACEMENT',
      }),
    ).toBe(2);
  });

  it('rolls back a replacement proposal when structured message creation fails', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const inr = await createInrRequest(conversation.id);
    const conversationRepository =
      await import('../../src/modules/conversations/conversation.repository.js');
    vi.spyOn(conversationRepository, 'addMessage').mockRejectedValueOnce(
      new Error('injected message failure'),
    );

    const response = await mutate(
      seller.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    );
    expect(response.status).toBe(500);
    expect(
      await models.Replacement.countDocuments({ inrRequestId: inr._id }),
    ).toBe(0);
    expect(
      await models.Message.countDocuments({
        conversationId: conversation.id,
        type: 'REPLACEMENT',
      }),
    ).toBe(0);
    expect(
      (await models.INRRequest.findById(inr._id).lean()).resolutionMode,
    ).toBe('NONE');
  });

  it('keeps duplicate replacement proposal races to one active replacement and one card', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const inr = await createInrRequest(conversation.id);

    const results = await Promise.all([
      mutate(buyer.agent, 'post', `/inr-requests/${inr._id}/replacements`),
      mutate(seller.agent, 'post', `/inr-requests/${inr._id}/replacements`),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      await models.Replacement.countDocuments({
        inrRequestId: inr._id,
        activeKey: 'ACTIVE',
      }),
    ).toBe(1);
    expect(
      await models.Message.countDocuments({
        conversationId: conversation.id,
        type: 'REPLACEMENT',
      }),
    ).toBe(1);
  });

  it('rejects spoofed replacement cards through the normal message endpoint', async () => {
    const buyer = await login('buyer@example.test');
    const conversation = await createConversation(buyer);

    const spoof = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        type: 'REPLACEMENT',
        replacementId: String(new mongoose.Types.ObjectId()),
        content: 'Seller offered a replacement',
        sendCopyToEmail: false,
      },
    );
    expect(spoof.status).toBe(400);

    const plainText = await mutate(
      buyer.agent,
      'post',
      `/conversations/${conversation.id}/messages`,
      {
        content: 'Seller offered a replacement',
        sendCopyToEmail: false,
      },
    );
    expect(plainText.status).toBe(201);
    expect(plainText.body.data).toEqual(
      expect.objectContaining({
        type: 'TEXT',
        content: 'Seller offered a replacement',
        replacement: null,
      }),
    );
  });

  it('derives replacement chat actions by viewer and removes them after accept', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const inr = await createInrRequest(conversation.id);
    const proposal = await mutate(
      seller.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    ).then((response) => response.body.data.replacement);

    const buyerHistory = await buyer.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(buyerHistory.body.data[0].replacement.availableActions).toEqual([
      'ACCEPT',
      'REFUND_INSTEAD',
    ]);
    const sellerHistory = await seller.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(sellerHistory.body.data[0].replacement.availableActions).toEqual([]);

    const accepted = await mutate(
      buyer.agent,
      'post',
      `/replacements/${proposal.id}/accept`,
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toEqual(
      expect.objectContaining({
        status: 'ACCEPTED',
        availableActions: [],
      }),
    );
    expect(accepted.body.data).not.toHaveProperty('inventoryClaimStatus');
    expect((await models.Product.findById(ids.product).lean()).stock).toBe(1);
    const stored = await models.Replacement.findById(proposal.id).lean();
    expect(stored.status).toBe('ACCEPTED');
    expect(stored.inventoryClaimStatus).toBe('CLAIMED');
  });

  it('lets the seller accept or decline buyer-requested replacement cards', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const inr = await createInrRequest(conversation.id);
    const proposal = await mutate(
      buyer.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    ).then((response) => response.body.data.replacement);

    const sellerHistory = await seller.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(sellerHistory.body.data[0].replacement.availableActions).toEqual([
      'ACCEPT',
      'DECLINE',
    ]);

    const declined = await mutate(
      seller.agent,
      'post',
      `/replacements/${proposal.id}/decline`,
    );
    expect(declined.status).toBe(200);
    expect(declined.body.data).toEqual(
      expect.objectContaining({
        status: 'DECLINED',
        availableActions: [],
      }),
    );
    expect(
      (await models.INRRequest.findById(inr._id).lean()).resolutionMode,
    ).toBe('NONE');
  });

  it('keeps replacement cards coherent after buyer refund-instead and accept-vs-decline races', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const inr = await createInrRequest(conversation.id);
    const sellerProposal = await mutate(
      seller.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    ).then((response) => response.body.data.replacement);
    const refundInstead = await mutate(
      buyer.agent,
      'patch',
      `/inr-requests/${inr._id}/refund-instead`,
    );
    expect(refundInstead.status).toBe(200);
    const refundHistory = await buyer.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(refundHistory.body.data[0].replacement).toEqual(
      expect.objectContaining({
        id: sellerProposal.id,
        displayState: 'REFUND_REQUESTED',
        availableActions: [],
      }),
    );

    await models.Message.deleteMany({ conversationId: conversation.id });
    await models.Replacement.deleteMany({ inrRequestId: inr._id });
    await models.INRRequest.updateOne(
      { _id: inr._id },
      { $set: { resolutionMode: 'NONE', requestedResolution: 'WANT_ITEM' } },
    );
    const buyerProposal = await mutate(
      buyer.agent,
      'post',
      `/inr-requests/${inr._id}/replacements`,
    ).then((response) => response.body.data.replacement);

    const race = await Promise.allSettled([
      mutate(seller.agent, 'post', `/replacements/${buyerProposal.id}/accept`),
      mutate(seller.agent, 'post', `/replacements/${buyerProposal.id}/decline`),
    ]);
    expect(race.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'fulfilled',
    ]);
    expect(race.map((result) => result.value.status).sort()).toEqual([
      200, 409,
    ]);
    const finalHistory = await seller.agent
      .get(`${prefix}/conversations/${conversation.id}/messages`)
      .expect(200);
    expect(finalHistory.body.data[0].replacement.availableActions).toEqual([]);
    expect(['ACCEPTED', 'DECLINED']).toContain(
      finalHistory.body.data[0].replacement.status,
    );
  });

  it('allows seller attachment upload through SellerProfile.userId authorization', async () => {
    const buyer = await login('buyer@example.test');
    const seller = await login('seller@example.test');
    const conversation = await createConversation(buyer);
    const upload = await uploadAttachments(seller, conversation.id, [
      { name: 'reply.txt', mime: 'text/plain', size: 32 },
    ]);
    expect(upload.status).toBe(201);
    expect(upload.body.data[0]).toEqual(
      expect.objectContaining({ fileName: 'reply.txt', type: 'FILE' }),
    );
  });

  it('rejects unrelated, unsupported, too many, and oversized attachment uploads', async () => {
    const buyer = await login('buyer@example.test');
    const other = await login('other@example.test');
    const conversation = await createConversation(buyer);

    const outsider = await uploadAttachments(other, conversation.id, [
      { name: 'photo.jpg', mime: 'image/jpeg', size: 16 },
    ]);
    expect(outsider.status).toBe(403);

    const unsupported = await uploadAttachments(buyer, conversation.id, [
      { name: 'script.js', mime: 'application/javascript', size: 16 },
    ]);
    expect(unsupported.status).toBe(400);

    const tooMany = await uploadAttachments(
      buyer,
      conversation.id,
      Array.from({ length: 6 }, (_, index) => ({
        name: `file-${index}.txt`,
        mime: 'text/plain',
        size: 16,
      })),
    );
    expect(tooMany.status).toBe(400);

    const oversized = await uploadAttachments(buyer, conversation.id, [
      {
        name: 'large.pdf',
        mime: 'application/pdf',
        size: 5 * 1024 * 1024 + 1,
      },
    ]);
    expect(oversized.status).toBe(413);
  });
});
