import { Replacement } from './replacement.model.js';

const publicProjection = {
  _id: 1,
  inrRequestId: 1,
  orderId: 1,
  orderItemId: 1,
  buyerId: 1,
  sellerId: 1,
  productId: 1,
  quantity: 1,
  initiatorRole: 1,
  initiatedBy: 1,
  status: 1,
  acceptedBy: 1,
  declinedBy: 1,
  cancelledBy: 1,
  failedBy: 1,
  acceptedAt: 1,
  declinedAt: 1,
  cancelledAt: 1,
  completedAt: 1,
  failedAt: 1,
  decline: 1,
  cancellation: 1,
  failure: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const create = async (data, session) =>
  (await Replacement.create([data], { session }))[0];

export const findById = (id, session) =>
  Replacement.findById(id)
    .select(publicProjection)
    .session(session || null)
    .lean();

export const listByInrRequest = (inrRequestId, session) =>
  Replacement.find({ inrRequestId })
    .select(publicProjection)
    .sort({ createdAt: -1, _id: -1 })
    .session(session || null)
    .lean();

export const transition = (id, fromStatuses, update, session) =>
  Replacement.findOneAndUpdate(
    { _id: id, status: { $in: fromStatuses } },
    update,
    {
      session,
      returnDocument: 'after',
      projection: publicProjection,
      runValidators: true,
    },
  ).lean();
