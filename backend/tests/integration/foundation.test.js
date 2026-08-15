import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let app;
let database;
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  database = await import('../../src/config/database.js');
  await database.connectDatabase(process.env.MONGODB_URI);
  ({ app } = await import('../../src/app.js'));
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

describe('foundation', () => {
  it('01 health200', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('02 ready200', async () => {
    const response = await request(app).get('/ready').expect(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ready' } });
  });

  it('03 unknown404', async () => {
    const response = await request(app).get('/not-a-route').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('04 error requestId', async () => {
    const response = await request(app)
      .get('/not-a-route')
      .set('x-request-id', 'known-request-id')
      .expect(404);
    expect(response.headers['x-request-id']).toBe('known-request-id');
    expect(response.body.error.requestId).toBe('known-request-id');
  });
});
