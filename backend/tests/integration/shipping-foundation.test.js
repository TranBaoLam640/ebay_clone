import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { accessCookie } from '../../src/config/cookies.js';
import { USER_STATUS } from '../../src/common/constants/user-status.js';
import { errorHandler } from '../../src/common/middleware/error-handler.js';
import { authenticate } from '../../src/common/middleware/authenticate.js';
import { authorize } from '../../src/common/middleware/authorize.js';
import { signAccess } from '../../src/common/utils/token.js';
import { Notification } from '../../src/modules/notifications/notification.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { Replacement } from '../../src/modules/replacements/replacement.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { Shipment } from '../../src/modules/shipments/shipment.model.js';
import {
  SHIPMENT_CARRIERS,
  SHIPMENT_PURPOSES,
  SHIPMENT_STATUSES,
  SHIPMENT_TRANSITIONS,
} from '../../src/modules/shipments/shipment.constants.js';
import { maintainShipmentIndexes } from '../../src/modules/shipments/shipment-indexes.js';
import * as shipmentRepository from '../../src/modules/shipments/shipment.repository.js';
import * as shipmentService from '../../src/modules/shipments/shipment.service.js';

let database;
let mongo;

const id = () => new mongoose.Types.ObjectId();

const createUser = (role) =>
  User.create({
    email: `${role.toLowerCase()}-${id()}@example.test`,
    passwordHash: 'hash',
    fullName: `${role} User`,
    role,
    status: USER_STATUS.ACTIVE,
    isEmailVerified: true,
  });

const testApp = () => {
  const app = express();
  app.use(cookieParser());
  app.get('/shipper-only', authenticate, authorize('SHIPPER'), (req, res) =>
    res.json({ success: true, data: { role: req.user.role } }),
  );
  app.use(errorHandler);
  return app;
};

const authenticated = (app, user) =>
  request(app)
    .get('/shipper-only')
    .set('Cookie', [`${accessCookie}=${signAccess(user)}`]);

const orderSnapshot = (overrides = {}) => ({
  _id: id(),
  buyerId: id(),
  sellerId: id(),
  ...overrides,
});

const orderDocument = (overrides = {}) => {
  const buyerId = overrides.buyerId || id();
  const sellerId = overrides.sellerId || id();
  return Order.create({
    buyerId,
    sellerId,
    orderStatus: 'CONFIRMED',
    paymentMethod: 'COD',
    subtotal: 100,
    discount: 0,
    shippingFee: 0,
    total: 100,
    items: [
      {
        _id: overrides.orderItemId || id(),
        productId: overrides.productId || id(),
        sellerId,
        quantity: 1,
      },
    ],
    ...overrides,
  });
};

const replacementDocument = (overrides = {}) =>
  Replacement.create({
    inrRequestId: id(),
    orderId: id(),
    orderItemId: id(),
    buyerId: id(),
    sellerId: id(),
    productId: id(),
    quantity: 1,
    initiatorRole: 'SELLER',
    initiatedBy: id(),
    status: 'ACCEPTED',
    acceptedBy: id(),
    acceptedAt: new Date(),
    inventoryClaimStatus: 'CLAIMED',
    inventoryClaimedAt: new Date(),
    ...overrides,
  });

const replacementShipmentData = (replacement, overrides = {}) => ({
  orderId: replacement.orderId,
  buyerId: replacement.buyerId,
  sellerId: replacement.sellerId,
  purpose: 'REPLACEMENT',
  replacementId: replacement._id,
  carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
  trackingNumber: `SBAY-${id().toString().slice(-8).toUpperCase()}`,
  status: 'READY_FOR_PICKUP',
  estimatedDeliveryAt: new Date(),
  ...overrides,
});

const indexByName = async (name) =>
  (await Shipment.collection.indexes()).find((index) => index.name === name);

const dropIndexIfPresent = async (name) => {
  const existing = await indexByName(name);
  if (existing) await Shipment.collection.dropIndex(name);
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  await Promise.all([
    User.init(),
    Order.init(),
    Replacement.init(),
    Shipment.init(),
    Notification.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  await database.disconnectDatabase();
  await mongo.stop();
});

describe('shipping backend foundation', () => {
  it('accepts USER, ADMIN, and SHIPPER as global User roles', async () => {
    expect(User.schema.path('role').options).toEqual(
      expect.objectContaining({
        enum: ['USER', 'ADMIN', 'SHIPPER'],
        default: 'USER',
      }),
    );
    await expect(createUser('USER')).resolves.toBeTruthy();
    await expect(createUser('ADMIN')).resolves.toBeTruthy();
    await expect(createUser('SHIPPER')).resolves.toBeTruthy();
  });

  it('authorizes only authenticated users with the required role', async () => {
    const app = testApp();
    await request(app).get('/shipper-only').expect(401);

    const user = await createUser('USER');
    const userResponse = await authenticated(app, user).expect(403);
    expect(userResponse.body.error.code).toBe('FORBIDDEN');

    const shipper = await createUser('SHIPPER');
    const shipperResponse = await authenticated(app, shipper).expect(200);
    expect(shipperResponse.body.data).toEqual({ role: 'SHIPPER' });
  });

  it('creates shipments with generated tracking, ETA, defaults, and indexes', async () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    const order = orderSnapshot();
    const shipment = await shipmentService.createForOrder(order, { now });

    expect(shipment).toEqual(
      expect.objectContaining({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        shipperId: null,
        carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
        status: 'READY_FOR_PICKUP',
      }),
    );
    expect(shipment).not.toHaveProperty('purpose');
    expect(shipment).not.toHaveProperty('replacementId');
    expect(shipment.trackingNumber).toMatch(/^SBAY-[A-F0-9]{8}$/);
    expect(shipment.estimatedDeliveryAt).toEqual(
      new Date('2026-08-21T00:10:00.000Z'),
    );
    expect(shipment.createdAt).toBeInstanceOf(Date);
    expect(shipment.updatedAt).toBeInstanceOf(Date);

    const stored = await Shipment.findById(shipment._id);
    expect(stored.purpose).toBe('ORIGINAL');
    expect(stored.replacementId).toBeUndefined();
    expect(stored.pickedUpAt).toBeNull();
    expect(stored.deliveredAt).toBeNull();
    expect(Shipment.schema.path('trackingNumber').options.immutable).toBe(true);
    expect(Shipment.schema.path('purpose').options.immutable).toBe(true);
    expect(Shipment.schema.path('replacementId').options.immutable).toBe(true);
    stored.trackingNumber = 'SBAY-CHANGED';
    await stored.save();
    expect((await Shipment.findById(shipment._id).lean()).trackingNumber).toBe(
      shipment.trackingNumber,
    );
    expect(SHIPMENT_PURPOSES).toEqual(['ORIGINAL', 'REPLACEMENT']);
    expect(Shipment.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { orderId: 1, purpose: 1 },
          expect.objectContaining({
            unique: true,
            name: 'unique_original_shipment_per_order',
            partialFilterExpression: { purpose: 'ORIGINAL' },
          }),
        ],
        [
          { replacementId: 1 },
          expect.objectContaining({
            unique: true,
            name: 'unique_replacement_shipment_per_replacement',
            partialFilterExpression: { purpose: 'REPLACEMENT' },
          }),
        ],
        [{ trackingNumber: 1 }, { unique: true }],
        [{ orderId: 1, purpose: 1, createdAt: -1 }, {}],
        [{ shipperId: 1, status: 1, createdAt: -1 }, {}],
        [{ sellerId: 1, status: 1, createdAt: -1 }, {}],
        [{ buyerId: 1, createdAt: -1 }, {}],
      ]),
    );
  });

  it('replays one shipment per order and enforces unique tracking numbers', async () => {
    const order = orderSnapshot();
    const first = await shipmentService.createForOrder(order);
    const replay = await shipmentService.createForOrder(order);
    expect(String(replay._id)).toBe(String(first._id));
    expect(
      await Shipment.countDocuments({
        orderId: order._id,
        purpose: 'ORIGINAL',
      }),
    ).toBe(1);

    await Shipment.create({
      orderId: id(),
      buyerId: id(),
      sellerId: id(),
      carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
      trackingNumber: 'SBAY-DUPLICATE',
      status: 'READY_FOR_PICKUP',
      estimatedDeliveryAt: new Date(),
    });
    await expect(
      Shipment.create({
        orderId: id(),
        buyerId: id(),
        sellerId: id(),
        carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
        trackingNumber: 'SBAY-DUPLICATE',
        status: 'READY_FOR_PICKUP',
        estimatedDeliveryAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('enforces one original shipment per order under concurrent creation', async () => {
    const order = orderSnapshot();
    const attempts = await Promise.all([
      shipmentService.createForOrder(order),
      shipmentService.createForOrder(order),
    ]);

    expect(String(attempts[0]._id)).toBe(String(attempts[1]._id));
    expect(
      await Shipment.countDocuments({
        orderId: order._id,
        purpose: 'ORIGINAL',
      }),
    ).toBe(1);
  });

  it('allows original and replacement shipments to coexist for one order', async () => {
    const order = orderSnapshot();
    const original = await shipmentService.createForOrder(order);
    const replacements = await Promise.all([
      replacementDocument({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
      }),
      replacementDocument({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
      }),
    ]);

    const replacementShipments = await Shipment.create(
      replacements.map((replacement) => replacementShipmentData(replacement)),
    );

    expect(await Shipment.countDocuments({ orderId: order._id })).toBe(3);
    await expect(
      Shipment.create(
        replacementShipmentData(replacements[0], {
          purpose: 'ORIGINAL',
        }),
      ),
    ).rejects.toThrow(/ORIGINAL shipments cannot have replacementId/);
    await expect(
      Shipment.create({
        ...replacementShipmentData(replacements[0], {
          replacementId: undefined,
        }),
      }),
    ).rejects.toThrow(/REPLACEMENT shipments require replacementId/);

    const foundOriginal = await shipmentRepository.findOriginalByOrderId(
      order._id,
    );
    expect(String(foundOriginal._id)).toBe(String(original._id));
    expect(foundOriginal).not.toHaveProperty('purpose');

    const foundReplacement = await shipmentRepository.findByReplacementId(
      replacements[0]._id,
    );
    expect(String(foundReplacement._id)).toBe(
      String(replacementShipments[0]._id),
    );
    expect(foundReplacement.purpose).toBe('REPLACEMENT');

    const byOrder = await shipmentRepository.listByOrderId(order._id);
    expect(byOrder.map((shipment) => shipment.purpose).sort()).toEqual([
      'ORIGINAL',
      'REPLACEMENT',
      'REPLACEMENT',
    ]);
  });

  it('rejects duplicate replacement shipments for the same replacement', async () => {
    const replacement = await replacementDocument();
    await Shipment.create(replacementShipmentData(replacement));

    await expect(
      Shipment.create(
        replacementShipmentData(replacement, {
          trackingNumber: 'SBAY-DUPREPL1',
        }),
      ),
    ).rejects.toMatchObject({ code: 11000 });

    const racedReplacement = await replacementDocument();
    const attempts = await Promise.allSettled([
      Shipment.create(
        replacementShipmentData(racedReplacement, {
          trackingNumber: 'SBAY-RACE0001',
        }),
      ),
      Shipment.create(
        replacementShipmentData(racedReplacement, {
          trackingNumber: 'SBAY-RACE0002',
        }),
      ),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await Shipment.countDocuments({
        replacementId: racedReplacement._id,
        purpose: 'REPLACEMENT',
      }),
    ).toBe(1);
  });

  it('keeps original delivery side effects unchanged', async () => {
    const order = await orderDocument();
    const shipperId = id();
    const shipment = await Shipment.create({
      orderId: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      purpose: 'ORIGINAL',
      shipperId,
      carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
      trackingNumber: 'SBAY-ORIGDONE',
      status: 'IN_TRANSIT',
      estimatedDeliveryAt: new Date(),
      pickedUpAt: new Date(),
    });

    await shipmentService.deliver(shipperId, shipment._id);

    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder.orderStatus).toBe('DELIVERED');
    expect(updatedOrder.deliveredAt).toBeInstanceOf(Date);
    expect(await Notification.countDocuments({ userId: order.buyerId })).toBe(
      1,
    );
  });

  it('does not run original order delivery side effects for replacement shipments', async () => {
    const order = await orderDocument();
    const replacement = await replacementDocument({
      orderId: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
    });
    const shipperId = id();
    const shipment = await Shipment.create(
      replacementShipmentData(replacement, {
        shipperId,
        status: 'IN_TRANSIT',
        pickedUpAt: new Date(),
        trackingNumber: 'SBAY-REPLDONE',
      }),
    );

    const delivered = await shipmentService.deliver(shipperId, shipment._id);

    expect(delivered.status).toBe('DELIVERED');
    const unchangedOrder = await Order.findById(order._id).lean();
    expect(unchangedOrder.orderStatus).toBe('CONFIRMED');
    expect(unchangedOrder.deliveredAt).toBeUndefined();
    expect(await Notification.countDocuments({ userId: order.buyerId })).toBe(
      0,
    );
  });

  it('keeps buyer-safe shipment redaction unchanged', async () => {
    const replacement = await replacementDocument();
    const replacementShipment = await Shipment.create(
      replacementShipmentData(replacement),
    );
    const buyerPublic = shipmentRepository.toBuyerPublic(replacementShipment);

    expect(buyerPublic).toEqual({
      _id: replacementShipment._id,
      orderId: replacementShipment.orderId,
      status: replacementShipment.status,
      estimatedDeliveryAt: replacementShipment.estimatedDeliveryAt,
      pickedUpAt: null,
      deliveredAt: null,
      createdAt: replacementShipment.createdAt,
      updatedAt: replacementShipment.updatedAt,
    });
  });

  it('maintains shipment indexes idempotently and backfills original purpose', async () => {
    await Promise.all([
      dropIndexIfPresent('unique_original_shipment_per_order'),
      dropIndexIfPresent('unique_replacement_shipment_per_replacement'),
      dropIndexIfPresent('orderId_1_purpose_1_createdAt_-1'),
    ]);
    await Shipment.collection.createIndex(
      { orderId: 1 },
      { unique: true, name: 'orderId_1' },
    );
    const order = orderSnapshot();
    const nullPurposeOrder = orderSnapshot();
    await Shipment.collection.insertOne({
      orderId: order._id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
      trackingNumber: 'SBAY-LEGACY01',
      status: 'READY_FOR_PICKUP',
      estimatedDeliveryAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Shipment.collection.insertOne({
      orderId: nullPurposeOrder._id,
      buyerId: nullPurposeOrder.buyerId,
      sellerId: nullPurposeOrder.sellerId,
      purpose: null,
      carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
      trackingNumber: 'SBAY-LEGACY02',
      status: 'READY_FOR_PICKUP',
      estimatedDeliveryAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const first = await maintainShipmentIndexes();
    const second = await maintainShipmentIndexes();
    const indexes = await Shipment.collection.indexes();

    expect(first.backfilled).toBe(2);
    expect(first.dropped).toContain('orderId_1');
    expect(first.created).toEqual(
      expect.arrayContaining([
        'unique_original_shipment_per_order',
        'unique_replacement_shipment_per_replacement',
      ]),
    );
    expect(second.backfilled).toBe(0);
    expect(second.dropped).toEqual([]);
    expect(second.created).toEqual([]);
    expect(
      indexes.some(
        (index) =>
          index.name === 'orderId_1' &&
          index.unique === true &&
          JSON.stringify(index.key) === JSON.stringify({ orderId: 1 }),
      ),
    ).toBe(false);
    expect(await indexByName('unique_original_shipment_per_order')).toEqual(
      expect.objectContaining({
        unique: true,
        key: { orderId: 1, purpose: 1 },
        partialFilterExpression: { purpose: 'ORIGINAL' },
      }),
    );
    expect(
      await indexByName('unique_replacement_shipment_per_replacement'),
    ).toEqual(
      expect.objectContaining({
        unique: true,
        key: { replacementId: 1 },
        partialFilterExpression: { purpose: 'REPLACEMENT' },
      }),
    );
    expect(
      (await Shipment.findOne({ orderId: order._id }).lean()).purpose,
    ).toBe('ORIGINAL');
    expect(
      (await Shipment.findOne({ orderId: nullPurposeOrder._id }).lean())
        .purpose,
    ).toBe('ORIGINAL');

    await expect(
      Shipment.create({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        purpose: 'ORIGINAL',
        carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
        trackingNumber: 'SBAY-DUPORIG1',
        status: 'READY_FOR_PICKUP',
        estimatedDeliveryAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });

    const replacements = await Promise.all([
      replacementDocument({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
      }),
      replacementDocument({
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
      }),
    ]);
    await Shipment.create(
      replacements.map((replacement) => replacementShipmentData(replacement)),
    );
    expect(await Shipment.countDocuments({ orderId: order._id })).toBe(3);
    await expect(
      Shipment.create(
        replacementShipmentData(replacements[0], {
          trackingNumber: 'SBAY-DUPREPL2',
        }),
      ),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('refuses shipment index maintenance when duplicate originals already exist', async () => {
    await Promise.all([
      dropIndexIfPresent('unique_original_shipment_per_order'),
      dropIndexIfPresent('unique_replacement_shipment_per_replacement'),
      dropIndexIfPresent('orderId_1_purpose_1_createdAt_-1'),
      dropIndexIfPresent('orderId_1'),
    ]);
    const order = orderSnapshot();
    await Shipment.collection.insertMany([
      {
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        purpose: 'ORIGINAL',
        carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
        trackingNumber: 'SBAY-DUPORIG2',
        status: 'READY_FOR_PICKUP',
        estimatedDeliveryAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        orderId: order._id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        purpose: 'ORIGINAL',
        carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
        trackingNumber: 'SBAY-DUPORIG3',
        status: 'READY_FOR_PICKUP',
        estimatedDeliveryAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(maintainShipmentIndexes()).rejects.toThrow(
      /duplicate ORIGINAL shipments exist/,
    );

    await Shipment.deleteMany({});
    await maintainShipmentIndexes();
  });

  it('defines only MVP shipment statuses and forward transitions', () => {
    expect(SHIPMENT_STATUSES).toEqual([
      'READY_FOR_PICKUP',
      'IN_TRANSIT',
      'DELIVERED',
      'CANCELLED',
    ]);
    expect(SHIPMENT_TRANSITIONS).toEqual({
      READY_FOR_PICKUP: ['IN_TRANSIT', 'CANCELLED'],
      IN_TRANSIT: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    });
  });
});
