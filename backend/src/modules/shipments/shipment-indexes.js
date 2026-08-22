import { Shipment } from './shipment.model.js';

const sameKey = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);

const samePartialFilter = (actual = {}, expected = {}) =>
  JSON.stringify(actual) === JSON.stringify(expected);

const obsoleteOriginalKey = { orderId: 1 };
const legacyPurposeFilter = {
  $or: [{ purpose: { $exists: false } }, { purpose: null }],
};

const targetIndexes = [
  {
    key: { orderId: 1, purpose: 1 },
    options: {
      unique: true,
      name: 'unique_original_shipment_per_order',
      partialFilterExpression: { purpose: 'ORIGINAL' },
    },
  },
  {
    key: { replacementId: 1 },
    options: {
      unique: true,
      name: 'unique_replacement_shipment_per_replacement',
      partialFilterExpression: { purpose: 'REPLACEMENT' },
    },
  },
  {
    key: { orderId: 1, purpose: 1, createdAt: -1 },
    options: { name: 'orderId_1_purpose_1_createdAt_-1' },
  },
];

const hasIndex = (indexes, target) =>
  indexes.some(
    (index) =>
      sameKey(index.key, target.key) &&
      Boolean(index.unique) === Boolean(target.options.unique) &&
      samePartialFilter(
        index.partialFilterExpression,
        target.options.partialFilterExpression,
      ),
  );

const assertNoDuplicateOriginalCandidates = async (collection) => {
  const duplicates = await collection
    .aggregate([
      { $match: { purpose: 'ORIGINAL' } },
      { $group: { _id: '$orderId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ])
    .toArray();

  if (duplicates.length > 0) {
    const orderIds = duplicates.map((duplicate) => duplicate._id).join(', ');
    throw new Error(
      `Cannot maintain Shipment indexes; duplicate ORIGINAL shipments exist for orderId(s): ${orderIds}`,
    );
  }
};

export const maintainShipmentIndexes = async () => {
  await Shipment.createCollection();

  const collection = Shipment.collection;
  const backfill = await collection.updateMany(legacyPurposeFilter, {
    $set: { purpose: 'ORIGINAL' },
  });
  await assertNoDuplicateOriginalCandidates(collection);

  let refreshed = await collection.indexes();
  const created = [];
  for (const target of targetIndexes) {
    if (hasIndex(refreshed, target)) continue;
    const name = await collection.createIndex(target.key, target.options);
    created.push(name);
    refreshed = await collection.indexes();
  }

  const dropped = [];
  const obsolete = refreshed.find(
    (index) => index.unique === true && sameKey(index.key, obsoleteOriginalKey),
  );
  if (obsolete) {
    await collection.dropIndex(obsolete.name);
    dropped.push(obsolete.name);
  }

  return {
    backfilled: backfill.modifiedCount,
    dropped,
    created,
  };
};
