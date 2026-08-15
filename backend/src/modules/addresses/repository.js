import mongoose from 'mongoose';
import { Address } from './address.model.js';
export const transaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};
export const list = (userId, session) =>
  Address.find({ userId })
    .sort({ createdAt: 1 })
    .session(session || null);
export const owned = (userId, _id, session) =>
  Address.findOne({ userId, _id }).session(session || null);
export const exists = (userId, session) =>
  Address.exists({ userId }).session(session || null);
export const clearDefault = (userId, session) =>
  Address.updateMany(
    { userId, isDefault: true },
    { $set: { isDefault: false } },
    { session },
  );
export const create = async (data, session) =>
  (await Address.create([data], { session }))[0];
export const updateOwned = (userId, _id, data, session) =>
  Address.findOneAndUpdate({ userId, _id }, data, {
    returnDocument: 'after',
    runValidators: true,
    session,
  });
export const setDefault = (userId, _id, session) =>
  Address.findOneAndUpdate(
    { userId, _id },
    { isDefault: true },
    { returnDocument: 'after', session },
  );
export const deleteOwned = (userId, _id, session) =>
  Address.findOneAndDelete({ userId, _id }, { session });
export const promoteOldest = (userId, session) =>
  Address.findOneAndUpdate(
    { userId },
    { isDefault: true },
    { sort: { createdAt: 1 }, returnDocument: 'after', session },
  );
