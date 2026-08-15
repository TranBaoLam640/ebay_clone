import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { buildMongoDbUri, getMongoDbTarget } from '../config/mongodb-uri.js';

try {
  const uri = buildMongoDbUri(env);
  const target = getMongoDbTarget(uri);
  await connectDatabase(uri);
  const admin = mongoose.connection.db.admin();
  await admin.ping();
  const buildInfo = await admin.command({ buildInfo: 1 });
  const hello = await admin.command({ hello: 1 });
  process.stdout.write('Database connection: successful\n');
  process.stdout.write(`Database name: ${target.database}\n`);
  process.stdout.write(`MongoDB server version: ${buildInfo.version}\n`);
  process.stdout.write(
    `Connection readyState: ${mongoose.connection.readyState}\n`,
  );
  process.stdout.write(`Replica set: ${hello.setName || 'not reported'}\n`);
} catch (error) {
  process.stderr.write(
    `Database connection: failed (${error.name || 'Error'})\n`,
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
