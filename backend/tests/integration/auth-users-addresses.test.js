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
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const prefix = '/api/v1';
const password = 'Strong1!Password';
const address = {
  recipientName: 'Recipient',
  phone: '0123456789',
  addressLine: '1 Main Street',
  ward: 'Ward 1',
  district: 'District 1',
  province: 'Province 1',
  country: 'Vietnam',
};
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

const register = (agent, email = 'user@example.com', body = {}) =>
  mutate(agent, 'post', '/auth/register', {
    email,
    password,
    fullName: 'Test User',
    ...body,
  });

const activate = async (agent, email = 'user@example.com') => {
  const registration = await register(agent, email);
  expect(registration.status).toBe(201);
  await mutate(agent, 'post', '/auth/verify-email', {
    email,
    otp: sentEmails.at(-1).otp,
  }).then((response) => expect(response.status).toBe(200));
  return registration;
};

const login = async (agent, email = 'user@example.com') => {
  await activate(agent, email);
  const response = await mutate(agent, 'post', '/auth/login', {
    email,
    password,
  });
  expect(response.status).toBe(200);
  return response;
};

const refreshCookieFrom = (response) =>
  response.headers['set-cookie']
    .find((cookie) => cookie.startsWith('refreshToken='))
    .split(';')[0];

const createAddress = (agent, values = {}) =>
  mutate(agent, 'post', '/addresses', { ...address, ...values });

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

describe('auth', () => {
  it('05 registration', async () => {
    const response = await register(request.agent(app));
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({
      email: 'user@example.com',
      otpExpiresInSeconds: 600,
      resendAvailableInSeconds: 60,
    });
    expect(JSON.stringify(response.body)).not.toContain(sentEmails[0].otp);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]).toEqual(
      expect.objectContaining({
        to: 'user@example.com',
        otp: expect.stringMatching(/^\d{6}$/),
        expiresInMinutes: 10,
      }),
    );
    const { User } = await import('../../src/modules/users/user.model.js');
    const user = await User.findOne({ email: 'user@example.com' });
    expect(user.isEmailVerified).toBe(false);
    expect(User.schema.path('role').options).toEqual(
      expect.objectContaining({ enum: ['USER', 'ADMIN'], default: 'USER' }),
    );
    expect(User.schema.path('fullName').options.required).toBe(true);
  });

  it('returns an email delivery error after preserving registration state', async () => {
    emailService.sendVerificationEmail.mockResolvedValueOnce(false);
    const response = await register(request.agent(app));
    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('EMAIL_DELIVERY_FAILED');
    const { User } = await import('../../src/modules/users/user.model.js');
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    expect(await User.countDocuments({ email: 'user@example.com' })).toBe(1);
    expect(await EmailVerificationToken.countDocuments()).toBe(1);
  });

  it('06 duplicate409', async () => {
    await register(request.agent(app));
    const response = await register(request.agent(app));
    expect(response.status).toBe(409);
  });

  it('07 weak rejected', async () => {
    const response = await register(request.agent(app), 'weak@example.com', {
      password: 'weak',
    });
    expect(response.status).toBe(400);
  });

  it('08 passwordHash not plaintext', async () => {
    await register(request.agent(app));
    const { User } = await import('../../src/modules/users/user.model.js');
    const user = await User.findOne({ email: 'user@example.com' }).select(
      '+passwordHash',
    );
    expect(user.passwordHash).toBeTruthy();
    expect(user.passwordHash).not.toBe(password);
  });

  it('09 verification OTP hash is protected and never raw', async () => {
    await register(request.agent(app));
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    const stored = await EmailVerificationToken.findOne();
    const raw = sentEmails[0].otp;
    expect(stored.otpHash).not.toBe(raw);
    expect(JSON.stringify(stored.toObject())).not.toContain(raw);
    expect(stored.otpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.attempts).toBe(0);
    expect(stored.maxAttempts).toBe(5);
    expect(stored.lastSentAt).toBeInstanceOf(Date);
    expect(
      EmailVerificationToken.schema.path('expiresAt').options.expires,
    ).toBe(0);
  });

  it('10 valid verification', async () => {
    const agent = request.agent(app);
    await register(agent);
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: sentEmails[0].otp,
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ verified: true });
  });

  it('11 expired rejected', async () => {
    const agent = request.agent(app);
    await register(agent);
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    await EmailVerificationToken.updateOne({}, { expiresAt: new Date(0) });
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: sentEmails[0].otp,
    });
    expect(response.status).toBe(400);
  });

  it('12 used cannot reuse', async () => {
    const agent = request.agent(app);
    await register(agent);
    const body = { email: 'user@example.com', otp: sentEmails[0].otp };
    await mutate(agent, 'post', '/auth/verify-email', body).then((response) =>
      expect(response.status).toBe(200),
    );
    await mutate(agent, 'post', '/auth/verify-email', body).then((response) =>
      expect(response.status).toBe(400),
    );
  });

  it('supports an OTP with a leading zero', async () => {
    vi.spyOn(crypto, 'randomInt').mockReturnValueOnce(42731);
    const agent = request.agent(app);
    await register(agent);
    expect(sentEmails[0].otp).toBe('042731');
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: '042731',
    });
    expect(response.status).toBe(200);
  });

  it('rejects malformed OTP input', async () => {
    const agent = request.agent(app);
    await register(agent);
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: '12345',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('increments attempts for an incorrect OTP', async () => {
    const agent = request.agent(app);
    await register(agent);
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: sentEmails[0].otp === '000000' ? '000001' : '000000',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_EMAIL_VERIFICATION_OTP');
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    expect((await EmailVerificationToken.findOne()).attempts).toBe(1);
  });

  it('invalidates an OTP at the maximum attempts', async () => {
    const agent = request.agent(app);
    await register(agent);
    const wrongOtp = sentEmails[0].otp === '000000' ? '000001' : '000000';
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await mutate(agent, 'post', '/auth/verify-email', {
        email: 'user@example.com',
        otp: wrongOtp,
      });
      expect(response.status).toBe(400);
    }
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    const stored = await EmailVerificationToken.findOne();
    expect(stored.attempts).toBe(5);
    expect(stored.invalidatedAt).toBeInstanceOf(Date);
  });

  it('rejects a missing OTP record safely', async () => {
    const agent = request.agent(app);
    await register(agent);
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    await EmailVerificationToken.deleteMany({});
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: sentEmails[0].otp,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_EMAIL_VERIFICATION_OTP');
  });

  it('updates verification fields and consumes the OTP', async () => {
    const agent = request.agent(app);
    await register(agent);
    await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: sentEmails[0].otp,
    }).then((response) => expect(response.status).toBe(200));
    const { User } = await import('../../src/modules/users/user.model.js');
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    const user = await User.findOne({ email: 'user@example.com' });
    const stored = await EmailVerificationToken.findOne();
    expect(user.isEmailVerified).toBe(true);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(stored.usedAt).toBeInstanceOf(Date);
  });

  it('rolls back verification when its transaction fails', async () => {
    const agent = request.agent(app);
    await register(agent);
    const notificationService =
      await import('../../src/modules/notifications/service.js');
    vi.spyOn(
      notificationService,
      'createAccountNotification',
    ).mockRejectedValueOnce(new Error('transaction failure'));
    const response = await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: sentEmails[0].otp,
    });
    expect(response.status).toBe(500);
    const { User } = await import('../../src/modules/users/user.model.js');
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    expect(
      (await User.findOne({ email: 'user@example.com' })).isEmailVerified,
    ).toBe(false);
    expect((await EmailVerificationToken.findOne()).usedAt).toBeFalsy();
  });

  it('resend replaces the active OTP and preserves generic responses', async () => {
    const agent = request.agent(app);
    await register(agent);
    const oldOtp = sentEmails[0].otp;
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    await EmailVerificationToken.updateOne(
      {},
      { lastSentAt: new Date(Date.now() - 61000) },
    );
    await mutate(agent, 'post', '/auth/resend-verification', {
      email: 'user@example.com',
    }).then((response) => expect(response.status).toBe(200));
    const newOtp = sentEmails[1].otp;
    expect(await EmailVerificationToken.countDocuments()).toBe(2);
    expect(
      await EmailVerificationToken.countDocuments({
        usedAt: null,
        invalidatedAt: null,
      }),
    ).toBe(1);
    await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: oldOtp,
    }).then((response) => expect(response.status).toBe(400));
    await mutate(agent, 'post', '/auth/verify-email', {
      email: 'user@example.com',
      otp: newOtp,
    }).then((response) => expect(response.status).toBe(200));
    const missing = await mutate(
      request.agent(app),
      'post',
      '/auth/resend-verification',
      { email: 'missing@example.com' },
    );
    const verified = await mutate(
      request.agent(app),
      'post',
      '/auth/resend-verification',
      { email: 'user@example.com' },
    );
    expect(missing.status).toBe(200);
    expect(verified.status).toBe(200);
    expect(missing.body).toEqual(verified.body);
  });

  it('replaces a legacy link-token record through resend', async () => {
    const agent = request.agent(app);
    await register(agent);
    const { User } = await import('../../src/modules/users/user.model.js');
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    const user = await User.findOne({ email: 'user@example.com' });
    await EmailVerificationToken.deleteMany({});
    const legacyId = new mongoose.Types.ObjectId();
    await EmailVerificationToken.collection.insertOne({
      _id: legacyId,
      userId: user._id,
      tokenHash: crypto.randomBytes(32).toString('hex'),
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
      createdAt: new Date(Date.now() - 61000),
      updatedAt: new Date(Date.now() - 61000),
    });
    await mutate(agent, 'post', '/auth/resend-verification', {
      email: 'user@example.com',
    }).then((response) => expect(response.status).toBe(200));
    expect(
      (await EmailVerificationToken.findById(legacyId)).invalidatedAt,
    ).toBeInstanceOf(Date);
    const active = await EmailVerificationToken.findOne({
      otpHash: { $exists: true },
      invalidatedAt: null,
    });
    expect(active).toBeTruthy();
    expect(sentEmails.at(-1).otp).toMatch(/^\d{6}$/);
  });

  it('rejects resend during the persisted cooldown', async () => {
    const agent = request.agent(app);
    await register(agent);
    const response = await mutate(agent, 'post', '/auth/resend-verification', {
      email: 'user@example.com',
    });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('EMAIL_VERIFICATION_RESEND_TOO_SOON');
    expect(sentEmails).toHaveLength(1);
  });

  it('concurrent resends leave one usable OTP', async () => {
    const first = request.agent(app);
    await register(first);
    const { EmailVerificationToken } =
      await import('../../src/modules/auth/email-verification-token.model.js');
    await EmailVerificationToken.updateOne(
      {},
      { lastSentAt: new Date(Date.now() - 61000) },
    );
    const responses = await Promise.all([
      mutate(request.agent(app), 'post', '/auth/resend-verification', {
        email: 'user@example.com',
      }),
      mutate(request.agent(app), 'post', '/auth/resend-verification', {
        email: 'user@example.com',
      }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 429]);
    expect(
      await EmailVerificationToken.countDocuments({
        usedAt: null,
        invalidatedAt: null,
      }),
    ).toBe(1);
  });

  it('13 unverified login EMAIL_NOT_VERIFIED', async () => {
    const agent = request.agent(app);
    await register(agent);
    const response = await mutate(agent, 'post', '/auth/login', {
      email: 'user@example.com',
      password,
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('14 wrong password generic401', async () => {
    const agent = request.agent(app);
    await activate(agent);
    const response = await mutate(agent, 'post', '/auth/login', {
      email: 'user@example.com',
      password: 'Wrong1!Password',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid credentials');
  });

  it('15 login after verify', async () => {
    const response = await login(request.agent(app));
    expect(response.body.data.user.email).toBe('user@example.com');
    expect(
      response.headers['set-cookie'].some((c) => c.startsWith('accessToken=')),
    ).toBe(true);
  });

  it('16 login hashed RefreshToken', async () => {
    const response = await login(request.agent(app));
    const raw = refreshCookieFrom(response).replace('refreshToken=', '');
    const { RefreshToken } =
      await import('../../src/modules/auth/refresh-token.model.js');
    const stored = await RefreshToken.findOne();
    expect(stored.tokenHash).not.toBe(raw);
    expect(crypto.createHash('sha256').update(raw).digest('hex')).toBe(
      stored.tokenHash,
    );
    expect(RefreshToken.schema.indexes()).toEqual(
      expect.arrayContaining([[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]]),
    );
  });

  it('17 valid refresh', async () => {
    const agent = request.agent(app);
    const initial = await login(agent);
    const response = await mutate(agent, 'post', '/auth/refresh');
    expect(response.status).toBe(200);
    expect(refreshCookieFrom(response)).not.toBe(refreshCookieFrom(initial));
  });

  it('18 revoked refresh rejected', async () => {
    const agent = request.agent(app);
    const initial = await login(agent);
    const oldRefresh = refreshCookieFrom(initial);
    await mutate(agent, 'post', '/auth/refresh').then((response) =>
      expect(response.status).toBe(200),
    );
    const replay = request.agent(app);
    await csrf(replay);
    replay.jar.setCookie(oldRefresh);
    await mutate(replay, 'post', '/auth/refresh').then((response) =>
      expect(response.status).toBe(401),
    );
  });

  it('19 logout revokes DB', async () => {
    const agent = request.agent(app);
    await login(agent);
    await mutate(agent, 'post', '/auth/logout').then((response) =>
      expect(response.status).toBe(200),
    );
    const { RefreshToken } =
      await import('../../src/modules/auth/refresh-token.model.js');
    expect((await RefreshToken.findOne()).revokedAt).toBeInstanceOf(Date);
  });

  it('20 password change revokes all', async () => {
    const agent = request.agent(app);
    await login(agent);
    await mutate(agent, 'patch', '/users/me/password', {
      currentPassword: password,
      newPassword: 'Changed1!Password',
    }).then((response) => expect(response.status).toBe(200));
    const { RefreshToken } =
      await import('../../src/modules/auth/refresh-token.model.js');
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });

  it.each(['LOCKED', 'DISABLED'])(
    '21 locked or disabled login %s',
    async (status) => {
      const agent = request.agent(app);
      await activate(agent);
      const { User } = await import('../../src/modules/users/user.model.js');
      await User.updateOne({ email: 'user@example.com' }, { status });
      const response = await mutate(agent, 'post', '/auth/login', {
        email: 'user@example.com',
        password,
      });
      expect(response.status).toBe(403);
    },
  );
});

describe('users', () => {
  it('22 unauth profile', async () => {
    await request(app).get(`${prefix}/users/me`).expect(401);
  });

  it('23 auth read', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await agent.get(`${prefix}/users/me`).expect(200);
    expect(response.body.data.email).toBe('user@example.com');
    expect(response.body.data.sellerProfile).toBeNull();
  });

  it('23b auth read includes seller profile identity for seller users', async () => {
    const agent = request.agent(app);
    await login(agent);
    const read = await agent.get(`${prefix}/users/me`).expect(200);
    const { SellerProfile } =
      await import('../../src/modules/sellers/seller-profile.model.js');
    const seller = await SellerProfile.create({
      userId: read.body.data.id,
      displayName: 'Seller User',
      status: 'ACTIVE',
    });

    const response = await agent.get(`${prefix}/users/me`).expect(200);
    expect(response.body.data.sellerProfile).toEqual({
      id: String(seller._id),
    });
    expect(response.body.data.role).toBe('USER');
  });

  it('24 allowed updates', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await mutate(agent, 'patch', '/users/me', {
      fullName: 'Changed User',
      phone: '0987654321',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(response.status).toBe(200);
    expect(response.body.data.fullName).toBe('Changed User');
  });

  it('25 role/status/isEmailVerified/passwordHash mass assign blocked', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await mutate(agent, 'patch', '/users/me', {
      role: 'ADMIN',
      status: 'ACTIVE',
      isEmailVerified: false,
      passwordHash: 'plaintext',
    });
    expect(response.status).toBe(400);
  });

  it('26 API never passwordHash', async () => {
    const agent = request.agent(app);
    await login(agent);
    const read = await agent.get(`${prefix}/users/me`).expect(200);
    const update = await mutate(agent, 'patch', '/users/me', {
      fullName: 'No Hash',
    });
    expect(read.body.data.passwordHash).toBeUndefined();
    expect(update.body.data.passwordHash).toBeUndefined();
  });
});

describe('addresses', () => {
  it('27 first default', async () => {
    const agent = request.agent(app);
    await login(agent);
    const response = await createAddress(agent, { isDefault: false });
    expect(response.status).toBe(201);
    expect(response.body.data.isDefault).toBe(true);
  });

  it('28 second no two', async () => {
    const agent = request.agent(app);
    await login(agent);
    await createAddress(agent, { recipientName: 'First' });
    await createAddress(agent, { recipientName: 'Second' });
    const items = (await agent.get(`${prefix}/addresses`)).body.data;
    expect(items.filter((item) => item.isDefault)).toHaveLength(1);
  });

  it('29 set new default', async () => {
    const agent = request.agent(app);
    await login(agent);
    await createAddress(agent, { recipientName: 'First' });
    const second = await createAddress(agent, { recipientName: 'Second' });
    await mutate(
      agent,
      'patch',
      `/addresses/${second.body.data._id}/default`,
    ).then((response) => expect(response.status).toBe(200));
    const items = (await agent.get(`${prefix}/addresses`)).body.data;
    expect(items.find((item) => item.isDefault).recipientName).toBe('Second');
  });

  it('30 delete default promotes', async () => {
    const agent = request.agent(app);
    await login(agent);
    const first = await createAddress(agent, { recipientName: 'First' });
    await createAddress(agent, { recipientName: 'Second' });
    await mutate(agent, 'delete', `/addresses/${first.body.data._id}`).then(
      (response) => expect(response.status).toBe(200),
    );
    const items = (await agent.get(`${prefix}/addresses`)).body.data;
    expect(items.find((item) => item.isDefault).recipientName).toBe('Second');
  });

  it('31 A cannot read B address', async () => {
    const a = request.agent(app);
    await login(a, 'a@example.com');
    await createAddress(a);
    const b = request.agent(app);
    await login(b, 'b@example.com');
    const response = await b.get(`${prefix}/addresses`).expect(200);
    expect(response.body.data).toEqual([]);
  });

  it('32 A cannot update B', async () => {
    const a = request.agent(app);
    await login(a, 'a@example.com');
    const created = await createAddress(a);
    const b = request.agent(app);
    await login(b, 'b@example.com');
    await mutate(b, 'patch', `/addresses/${created.body.data._id}`, {
      phone: '1111111111',
    }).then((response) => expect(response.status).toBe(404));
  });

  it('33 A cannot delete B', async () => {
    const a = request.agent(app);
    await login(a, 'a@example.com');
    const created = await createAddress(a);
    const b = request.agent(app);
    await login(b, 'b@example.com');
    await mutate(b, 'delete', `/addresses/${created.body.data._id}`).then(
      (response) => expect(response.status).toBe(404),
    );
  });
});
