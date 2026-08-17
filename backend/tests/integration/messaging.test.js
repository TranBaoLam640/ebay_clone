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
const { s3Send } = vi.hoisted(() => ({ s3Send: vi.fn() }));
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

vi.mock('../../src/modules/uploads/s3-client.js', () => ({
  isStorageConfigured: true,
  s3Client: { send: s3Send },
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
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
    Address: (await import('../../src/modules/addresses/address.model.js'))
      .Address,
    Order: (await import('../../src/modules/orders/order.model.js')).Order,
    Offer: (await import('../../src/modules/offers/offer.model.js')).Offer,
    Message: (await import('../../src/modules/conversations/message.model.js'))
      .Message,
  };
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
  s3Send.mockResolvedValue({});
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
  ioServer.close();
  await new Promise((resolve) => httpServer.close(resolve));
  await database.disconnectDatabase();
  await mongo.stop();
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
    const second = await mutate(buyer.agent, 'post', '/conversations', {
      productId: ids.productUuid,
    });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

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

  it('upgrades pre-purchase conversation to post-purchase, preserves history, and blocks new offers', async () => {
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
    expect(postPurchaseOffer.status).toBe(409);
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
