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
import { User } from '../../src/modules/users/user.model.js';
import { Shipment } from '../../src/modules/shipments/shipment.model.js';
import {
  SHIPMENT_CARRIERS,
  SHIPMENT_STATUSES,
  SHIPMENT_TRANSITIONS,
} from '../../src/modules/shipments/shipment.constants.js';
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

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  await Promise.all([User.init(), Shipment.init()]);
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
    expect(shipment.trackingNumber).toMatch(/^SBAY-[A-F0-9]{8}$/);
    expect(shipment.estimatedDeliveryAt).toEqual(
      new Date('2026-08-24T00:00:00.000Z'),
    );
    expect(shipment.createdAt).toBeInstanceOf(Date);
    expect(shipment.updatedAt).toBeInstanceOf(Date);

    const stored = await Shipment.findById(shipment._id);
    expect(stored.pickedUpAt).toBeNull();
    expect(stored.deliveredAt).toBeNull();
    expect(Shipment.schema.path('trackingNumber').options.immutable).toBe(true);
    stored.trackingNumber = 'SBAY-CHANGED';
    await stored.save();
    expect((await Shipment.findById(shipment._id).lean()).trackingNumber).toBe(
      shipment.trackingNumber,
    );
    expect(Shipment.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ orderId: 1 }, { unique: true }],
        [{ trackingNumber: 1 }, { unique: true }],
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
    expect(await Shipment.countDocuments({ orderId: order._id })).toBe(1);

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

  it('defines only MVP shipment statuses and forward transitions', () => {
    expect(SHIPMENT_STATUSES).toEqual([
      'READY_FOR_PICKUP',
      'IN_TRANSIT',
      'DELIVERED',
    ]);
    expect(SHIPMENT_TRANSITIONS).toEqual({
      READY_FOR_PICKUP: ['IN_TRANSIT'],
      IN_TRANSIT: ['DELIVERED'],
      DELIVERED: [],
    });
  });
});
