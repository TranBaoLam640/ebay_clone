import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { SellerFeedback } from '../modules/seller-feedbacks/seller-feedback.model.js';

const sameKey = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);

const obsoleteKey = { orderId: 1 };
const targetKey = { orderId: 1, orderItemId: 1 };
const targetName = 'orderId_1_orderItemId_1';

try {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to modify SellerFeedback indexes in production; run this maintenance only after an explicit production migration plan.',
    );
  }

  await connectDatabase();
  const collection = SellerFeedback.collection;
  process.stdout.write(`SellerFeedback collection: ${collection.name}\n`);

  await SellerFeedback.createCollection();
  const indexes = await collection.indexes();
  const obsolete = indexes.find(
    (index) => index.unique === true && sameKey(index.key, obsoleteKey),
  );
  if (obsolete) {
    await collection.dropIndex(obsolete.name);
    process.stdout.write(
      `Obsolete unique index found/dropped: ${obsolete.name}\n`,
    );
  } else {
    process.stdout.write('Obsolete unique index not present\n');
  }

  const refreshed = await collection.indexes();
  const target = refreshed.find(
    (index) => index.unique === true && sameKey(index.key, targetKey),
  );
  if (target) {
    process.stdout.write(
      `Target compound unique index already exists: ${target.name}\n`,
    );
  } else {
    const created = await collection.createIndex(targetKey, {
      unique: true,
      name: targetName,
    });
    process.stdout.write(`Target compound unique index created: ${created}\n`);
  }
} catch (error) {
  process.stderr.write(
    `SellerFeedback index maintenance failed: ${error.message}\n`,
  );
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
