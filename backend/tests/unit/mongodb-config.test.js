import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { buildMongoDbUri } from '../../src/config/mongodb-uri.js';

const base = {
  CLIENT_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CSRF_SECRET: 'c'.repeat(32),
  EMAIL_OTP_HMAC_SECRET: 'd'.repeat(32),
};

const config = (values = {}) => loadConfig({ ...base, ...values });

describe('environment configuration', () => {
  it('parses SMTP and OTP values with strict numeric and boolean types', () => {
    const loaded = config({
      MONGODB_HOST: 'db.example.test',
      MONGODB_DATABASE: 'buyer',
      EMAIL_PORT: '465',
      EMAIL_SECURE: 'true',
      EMAIL_OTP_TTL_MINUTES: '10',
      EMAIL_OTP_MAX_ATTEMPTS: '5',
      EMAIL_OTP_RESEND_COOLDOWN_SECONDS: '0',
    });
    expect(loaded.EMAIL_PORT).toBe(465);
    expect(loaded.EMAIL_SECURE).toBe(true);
    expect(loaded.EMAIL_OTP_TTL_MINUTES).toBe(10);
    expect(loaded.EMAIL_OTP_MAX_ATTEMPTS).toBe(5);
    expect(loaded.EMAIL_OTP_RESEND_COOLDOWN_SECONDS).toBe(0);
  });

  it.each([
    { EMAIL_PORT: '0' },
    { EMAIL_OTP_TTL_MINUTES: '0' },
    { EMAIL_OTP_MAX_ATTEMPTS: '0' },
    { EMAIL_OTP_RESEND_COOLDOWN_SECONDS: '-1' },
    { EMAIL_SECURE: 'yes' },
    { EMAIL_OTP_HMAC_SECRET: 'too-short' },
  ])('rejects unsafe email configuration', (values) => {
    expect(() =>
      config({
        MONGODB_HOST: 'db.example.test',
        MONGODB_DATABASE: 'buyer',
        ...values,
      }),
    ).toThrow();
  });
});

describe('MongoDB configuration', () => {
  it('prefers a complete MONGODB_URI', () => {
    const uri = 'mongodb://example.test/direct';
    expect(
      buildMongoDbUri(
        config({
          MONGODB_URI: uri,
          MONGODB_HOST: 'ignored.test',
          MONGODB_DATABASE: 'ignored',
        }),
      ),
    ).toBe(uri);
  });

  it('builds a URI without authentication or empty options', () => {
    expect(
      buildMongoDbUri(
        config({ MONGODB_HOST: '10.0.0.5', MONGODB_DATABASE: 'buyer' }),
      ),
    ).toBe('mongodb://10.0.0.5:27017/buyer');
  });

  it('encodes credentials and adds configured options', () => {
    expect(
      buildMongoDbUri(
        config({
          MONGODB_HOST: 'db.example.test',
          MONGODB_PORT: '27018',
          MONGODB_DATABASE: 'buyer',
          MONGODB_USERNAME: 'buyer@service',
          MONGODB_PASSWORD: 'p@ss:/word',
          MONGODB_AUTH_SOURCE: 'admin',
          MONGODB_REPLICA_SET: 'rs0',
          MONGODB_TLS: 'true',
        }),
      ),
    ).toBe(
      'mongodb://buyer%40service:p%40ss%3A%2Fword@db.example.test:27018/buyer?authSource=admin&replicaSet=rs0&tls=true',
    );
  });

  it.each([[{ MONGODB_USERNAME: 'user' }], [{ MONGODB_PASSWORD: 'secret' }]])(
    'rejects incomplete credentials without exposing the password',
    (values) => {
      let message = '';
      try {
        config({
          MONGODB_HOST: 'db.example.test',
          MONGODB_DATABASE: 'buyer',
          ...values,
        });
      } catch (error) {
        message = error.message;
      }
      expect(message).toContain(
        'MongoDB username and password must be provided together',
      );
      expect(message).not.toContain('secret');
    },
  );

  it.each([
    { MONGODB_MAX_POOL_SIZE: '0' },
    { MONGODB_MIN_POOL_SIZE: '-1' },
    { MONGODB_MAX_POOL_SIZE: '2', MONGODB_MIN_POOL_SIZE: '3' },
    { MONGODB_SERVER_SELECTION_TIMEOUT_MS: '0' },
  ])('rejects invalid pool or timeout configuration', (values) => {
    expect(() =>
      config({
        MONGODB_HOST: 'db.example.test',
        MONGODB_DATABASE: 'buyer',
        ...values,
      }),
    ).toThrow();
  });
});
