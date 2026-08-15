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
let emailService;
let sentEmails;

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

const register = (agent, email = 'owner@example.com') =>
  mutate(agent, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Notification Owner',
  });

const activate = async (agent, email = 'owner@example.com') => {
  const response = await register(agent, email);
  expect(response.status).toBe(201);
  await mutate(agent, 'post', '/auth/verify-email', {
    email,
    otp: sentEmails.at(-1).otp,
  }).then((verification) => expect(verification.status).toBe(200));
};

const login = async (agent, email = 'owner@example.com') => {
  await activate(agent, email);
  const response = await mutate(agent, 'post', '/auth/login', {
    email,
    password,
  });
  expect(response.status).toBe(200);
  return response.body.data.user.id;
};

const createNotifications = async (userId, items) => {
  const { Notification } =
    await import('../../src/modules/notifications/notification.model.js');
  return Notification.create(
    items.map((item, index) => ({
      userId,
      title: `Notification ${index + 1}`,
      message: `Message ${index + 1}`,
      ...item,
    })),
  );
};

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  ({ emailService } =
    await import('../../src/common/services/email.service.js'));
  ({ app } = await import('../../src/app.js'));
});

beforeEach(async () => {
  sentEmails = [];
  vi.spyOn(emailService, 'sendVerificationEmail').mockImplementation((arg) => {
    sentEmails.push(arg);
    return Promise.resolve(true);
  });
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  vi.restoreAllMocks();
  await database.disconnectDatabase();
  await mongo.stop();
});

describe('notifications', () => {
  it('34 registration ACCOUNT notif', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await agent.get(`${prefix}/notifications`).expect(200);
    const { Notification } =
      await import('../../src/modules/notifications/notification.model.js');
    expect(Notification.schema.path('title').options.required).toBe(true);
    expect(Notification.schema.path('message').options.required).toBe(true);
    expect(Notification.schema.path('referenceType').instance).toBe('String');
    expect(Notification.schema.path('referenceId').instance).toBe('ObjectId');
    expect(Notification.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ userId: 1, createdAt: -1 }, expect.any(Object)],
        [{ userId: 1, isRead: 1, createdAt: -1 }, expect.any(Object)],
      ]),
    );
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ACCOUNT',
          title: 'Account registered',
        }),
      ]),
    );
  });

  it('35 verification ACCOUNT', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await agent.get(`${prefix}/notifications`).expect(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'ACCOUNT', title: 'Email verified' }),
      ]),
    );
  });

  it('36 password ACCOUNT', async () => {
    const agent = request.agent(app);
    await login(agent);
    await mutate(agent, 'patch', '/users/me/password', {
      currentPassword: password,
      newPassword: 'Changed1!Password',
    }).then((response) => expect(response.status).toBe(200));
    const response = await agent.get(`${prefix}/notifications`).expect(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'ACCOUNT', title: 'Password changed' }),
      ]),
    );
  });

  it('37 pagination exact envelope meta totalItems,totalPages', async () => {
    const agent = request.agent(app);
    const userId = await login(agent);
    await createNotifications(userId, [
      { type: 'SYSTEM', title: 'First' },
      { type: 'ORDER', title: 'Second' },
      { type: 'PAYMENT', title: 'Third' },
    ]);
    const response = await agent
      .get(`${prefix}/notifications?page=1&limit=2`)
      .expect(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 2,
      totalItems: 5,
      totalPages: 3,
    });
  });

  it('38 unread count', async () => {
    const agent = request.agent(app);
    const userId = await login(agent);
    await createNotifications(userId, [
      { type: 'SYSTEM' },
      { type: 'ORDER', isRead: true, readAt: new Date() },
    ]);
    const response = await agent
      .get(`${prefix}/notifications/unread-count`)
      .expect(200);
    expect(response.body.data).toEqual({ count: 3 });
  });

  it('39 mark read fields', async () => {
    const agent = request.agent(app);
    const userId = await login(agent);
    const [notification] = await createNotifications(userId, [
      { type: 'SYSTEM' },
    ]);
    const response = await mutate(
      agent,
      'patch',
      `/notifications/${notification.id}/read`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.isRead).toBe(true);
    expect(response.body.data.readAt).toBeTruthy();
  });

  it('40 read all owner only', async () => {
    const owner = request.agent(app);
    const ownerId = await login(owner);
    const other = request.agent(app);
    const otherId = await login(other, 'other@example.com');
    await createNotifications(ownerId, [{ type: 'SYSTEM' }]);
    await createNotifications(otherId, [{ type: 'SYSTEM' }]);
    await mutate(owner, 'patch', '/notifications/read-all').then((response) =>
      expect(response.status).toBe(200),
    );
    expect(
      (await owner.get(`${prefix}/notifications/unread-count`)).body.data.count,
    ).toBe(0);
    expect(
      (await other.get(`${prefix}/notifications/unread-count`)).body.data.count,
    ).toBe(3);
  });

  it('41 A cannot read or update B notification', async () => {
    const a = request.agent(app);
    await login(a, 'a@example.com');
    const b = request.agent(app);
    const bId = await login(b, 'b@example.com');
    const [notification] = await createNotifications(bId, [
      { type: 'SYSTEM', title: 'B only' },
    ]);
    const list = await a.get(`${prefix}/notifications`).expect(200);
    expect(list.body.data.some((item) => item.title === 'B only')).toBe(false);
    await mutate(a, 'patch', `/notifications/${notification.id}/read`).then(
      (response) => expect(response.status).toBe(404),
    );
  });
});

describe('security', () => {
  it('42 no CSRF rejects', async () => {
    await request(app)
      .post(`${prefix}/auth/login`)
      .send({ email: 'missing@example.com', password })
      .expect(403);
  });

  it.each([
    ['/auth/verify-email', { email: 'owner@example.com', otp: '123456' }],
    ['/auth/resend-verification', { email: 'owner@example.com' }],
  ])('OTP endpoint %s requires CSRF', async (path, body) => {
    await request(app).post(`${prefix}${path}`).send(body).expect(403);
  });

  it('43 valid CSRF allows', async () => {
    const agent = request.agent(app);
    const token = await csrf(agent);
    const response = await agent
      .post(`${prefix}/auth/login`)
      .set('x-csrf-token', token)
      .send({ email: 'missing@example.com', password });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('44 auth routes mounted without in-app rate limiting (stateless; limits live at ingress)', async () => {
    const { authRoute } = await import('../../src/modules/auth/route.js');
    const paths = new Set(
      authRoute.stack
        .filter((layer) => layer.route)
        .map((layer) => layer.route.path),
    );
    for (const p of [
      '/register',
      '/verify-email',
      '/resend-verification',
      '/login',
      '/refresh',
      '/logout',
    ]) {
      expect(paths.has(p)).toBe(true);
    }
    // Server must hold no in-memory rate-limit state (removed for horizontal scaling).
    await expect(
      import('../../src/common/middleware/rate-limit.js'),
    ).rejects.toThrow();
  });

  it('45 invalid ObjectId 4xx', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await mutate(
      agent,
      'patch',
      '/notifications/not-an-object-id/read',
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });
});
