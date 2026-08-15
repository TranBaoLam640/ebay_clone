import { ReturnRequest } from './return-request.model.js';

const publicProjection = {
  _id: 1,
  orderId: 1,
  sellerId: 1,
  orderItemId: 1,
  productId: 1,
  quantity: 1,
  reason: 1,
  details: 1,
  status: 1,
  cancelledAt: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const toPublic = (request) => {
  const source = request?.toObject ? request.toObject() : request;
  return Object.fromEntries(
    Object.keys(publicProjection)
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
};

export const create = async (data, session) =>
  (await ReturnRequest.create([data], { session }))[0];

export const list = (buyerId, skip, limit) =>
  ReturnRequest.find({ buyerId })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

export const count = (buyerId) => ReturnRequest.countDocuments({ buyerId });

export const owned = (buyerId, id, session) =>
  ReturnRequest.findOne({ _id: id, buyerId })
    .select(publicProjection)
    .session(session || null)
    .lean();
