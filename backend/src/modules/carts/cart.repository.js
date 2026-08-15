import mongoose from 'mongoose';
import { Cart } from './cart.model.js';

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

export const findByUser = (userId, session) =>
  Cart.findOne({ userId })
    .session(session || null)
    .lean();

export const setItems = (userId, items, session) =>
  Cart.findOneAndUpdate(
    { userId },
    { $set: { items } },
    { upsert: true, returnDocument: 'after', runValidators: true, session },
  ).lean();

export const addItem = (userId, productId, quantity) =>
  Cart.findOneAndUpdate(
    { userId, 'items.productId': { $ne: productId } },
    { $push: { items: { productId, quantity } } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean();

export const updateItem = (userId, productId, quantity) =>
  Cart.findOneAndUpdate(
    { userId, 'items.productId': productId },
    { $set: { 'items.$.quantity': quantity } },
    { returnDocument: 'after', runValidators: true },
  ).lean();

export const removeItem = (userId, productId) =>
  Cart.findOneAndUpdate(
    { userId, 'items.productId': productId },
    { $pull: { items: { productId } } },
    { returnDocument: 'after' },
  ).lean();

export const removeSelected = (userId, itemIds, session) =>
  Cart.updateOne(
    { userId },
    { $pull: { items: { _id: { $in: itemIds } } } },
    { session },
  );

export const clear = (userId) =>
  Cart.findOneAndUpdate(
    { userId },
    { $set: { items: [] } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
