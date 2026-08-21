import { Carrier } from './carrier.model.js';

const publicProjection = { _id: 1, code: 1, name: 1 };

export const toPublic = (carrier) => {
  const source = carrier?.toObject ? carrier.toObject() : carrier;
  return {
    id: String(source._id),
    code: source.code,
    name: source.name,
  };
};

export const listActive = () =>
  Carrier.find({ active: true })
    .select(publicProjection)
    .sort({ name: 1 })
    .lean();

export const findById = (id, session) =>
  Carrier.findById(id)
    .session(session || null)
    .lean();

export const upsertMany = (carriers) =>
  Carrier.bulkWrite(
    carriers.map((carrier) => ({
      updateOne: {
        filter: { code: carrier.code },
        update: { $set: carrier },
        upsert: true,
      },
    })),
  );
