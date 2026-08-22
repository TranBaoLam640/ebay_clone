import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { AppError } from '../../common/errors/app-error.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as inrRepository from '../inr-requests/inr-request.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import {
  REPLACEMENT_ACTIVE_KEY,
  REPLACEMENT_TERMINAL_STATUSES,
} from './replacement.constants.js';
import * as repository from './replacement.repository.js';

const notFound = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Replacement not found');
const forbidden = (message) =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);
const invalidState = (message) =>
  new AppError(409, ERROR_CODES.CONFLICT, message);

const roleFor = async (userId, request, session) => {
  if (String(request.buyerId) === String(userId)) return 'BUYER';
  const seller = await sellerRepository.findByUserId(userId, session);
  if (seller && String(seller._id) === String(request.sellerId))
    return 'SELLER';
  return null;
};

const duplicateActive = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.activeKey || error?.keyValue?.activeKey);

const assertInputMatchesInr = (request, input) => {
  if (input.orderId && String(input.orderId) !== String(request.orderId))
    throw invalidState('Replacement order does not match INR request');
  if (
    input.orderItemId &&
    String(input.orderItemId) !== String(request.orderItemId)
  )
    throw invalidState('Replacement order item does not match INR request');
};

const loadProposalContext = async (userId, input, session) => {
  const request = await inrRepository.findById(input.inrRequestId, session);
  if (!request)
    throw new AppError(404, ERROR_CODES.INR_NOT_FOUND, 'INR request not found');
  if (request.status !== 'OPEN')
    throw invalidState('Replacement can only be proposed for an open INR');
  assertInputMatchesInr(request, input);
  const order = await orderRepository.findOrderItem({
    orderId: request.orderId,
    orderItemId: request.orderItemId,
    session,
  });
  const item = order?.items?.[0];
  if (!order || !item)
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Order item not found');
  if (String(order.buyerId) !== String(request.buyerId))
    throw invalidState('INR buyer does not match original order');
  if (String(order.sellerId) !== String(request.sellerId))
    throw invalidState('INR seller does not match original order');
  if (String(item.productId) !== String(request.productId))
    throw invalidState('INR product does not match original order item');
  const initiatorRole = await roleFor(userId, request, session);
  if (!initiatorRole)
    throw forbidden('Only the INR buyer or seller can propose replacement');
  return { request, order, item, initiatorRole };
};

const view = (replacement) => ({
  id: String(replacement._id),
  inrRequestId: String(replacement.inrRequestId),
  orderId: String(replacement.orderId),
  orderItemId: String(replacement.orderItemId),
  buyerId: String(replacement.buyerId),
  sellerId: String(replacement.sellerId),
  productId: String(replacement.productId),
  quantity: replacement.quantity,
  initiatorRole: replacement.initiatorRole,
  initiatedBy: String(replacement.initiatedBy),
  status: replacement.status,
  acceptedBy: replacement.acceptedBy ? String(replacement.acceptedBy) : null,
  declinedBy: replacement.declinedBy ? String(replacement.declinedBy) : null,
  cancelledBy: replacement.cancelledBy ? String(replacement.cancelledBy) : null,
  failedBy: replacement.failedBy ? String(replacement.failedBy) : null,
  acceptedAt: replacement.acceptedAt ?? null,
  declinedAt: replacement.declinedAt ?? null,
  cancelledAt: replacement.cancelledAt ?? null,
  completedAt: replacement.completedAt ?? null,
  failedAt: replacement.failedAt ?? null,
  decline: replacement.decline ?? null,
  cancellation: replacement.cancellation ?? null,
  failure: replacement.failure ?? null,
  createdAt: replacement.createdAt,
  updatedAt: replacement.updatedAt,
});

const assertCounterparty = (replacement, role, action) => {
  if (!role) throw forbidden(`Only the INR counterparty can ${action}`);
  if (role === replacement.initiatorRole)
    throw forbidden(`Replacement initiator cannot ${action} own proposal`);
};

const assertInitiator = (replacement, userId) => {
  if (String(replacement.initiatedBy) !== String(userId))
    throw forbidden('Only the initiator can cancel this replacement proposal');
};

const loadActionContext = async (userId, id, session) => {
  const replacement = await repository.findById(id, session);
  if (!replacement) throw notFound();
  const request = await inrRepository.findById(
    replacement.inrRequestId,
    session,
  );
  if (!request)
    throw new AppError(404, ERROR_CODES.INR_NOT_FOUND, 'INR request not found');
  const role = await roleFor(userId, request, session);
  if (!role) throw forbidden('Only the INR buyer or seller can act');
  return { replacement, role };
};

const transitionOrThrow = async ({
  id,
  from,
  update,
  session,
  staleMessage,
}) => {
  const changed = await repository.transition(id, from, update, session);
  if (changed) return changed;
  const current = await repository.findById(id, session);
  if (!current) throw notFound();
  if (REPLACEMENT_TERMINAL_STATUSES.includes(current.status))
    throw invalidState('Terminal replacement cannot be changed');
  throw invalidState(staleMessage);
};

export const propose = (userId, input) =>
  checkoutRepository.transaction(async (session) => {
    const { request, item, initiatorRole } = await loadProposalContext(
      userId,
      input,
      session,
    );
    try {
      const created = await repository.create(
        {
          inrRequestId: request._id,
          orderId: request.orderId,
          orderItemId: request.orderItemId,
          buyerId: request.buyerId,
          sellerId: request.sellerId,
          productId: item.productId,
          quantity: request.quantityMissing,
          initiatorRole,
          initiatedBy: userId,
          status: 'PROPOSED',
          activeKey: REPLACEMENT_ACTIVE_KEY,
        },
        session,
      );
      return view(created.toObject());
    } catch (error) {
      if (duplicateActive(error))
        throw invalidState('An active replacement already exists');
      throw error;
    }
  });

export const accept = (userId, id, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement, role } = await loadActionContext(userId, id, session);
    assertCounterparty(replacement, role, 'accept');
    const accepted = await transitionOrThrow({
      id,
      from: ['PROPOSED'],
      update: {
        $set: {
          status: 'ACCEPTED',
          acceptedBy: userId,
          acceptedAt: now,
          activeKey: REPLACEMENT_ACTIVE_KEY,
        },
      },
      session,
      staleMessage: 'Replacement is no longer proposed',
    });
    return view(accepted);
  });

export const decline = (userId, id, input = {}, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement, role } = await loadActionContext(userId, id, session);
    assertCounterparty(replacement, role, 'decline');
    const declined = await transitionOrThrow({
      id,
      from: ['PROPOSED'],
      update: {
        $set: {
          status: 'DECLINED',
          declinedBy: userId,
          declinedAt: now,
          ...(input.reason || input.note
            ? {
                decline: {
                  ...(input.reason && { reason: input.reason }),
                  ...(input.note && { note: input.note }),
                },
              }
            : {}),
        },
        $unset: { activeKey: 1 },
      },
      session,
      staleMessage: 'Replacement is no longer proposed',
    });
    return view(declined);
  });

export const cancel = (userId, id, input = {}, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement } = await loadActionContext(userId, id, session);
    assertInitiator(replacement, userId);
    const cancelled = await transitionOrThrow({
      id,
      from: ['PROPOSED', 'ACCEPTED'],
      update: {
        $set: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: now,
          ...(input.reason || input.note
            ? {
                cancellation: {
                  ...(input.reason && { reason: input.reason }),
                  ...(input.note && { note: input.note }),
                },
              }
            : {}),
        },
        $unset: { activeKey: 1 },
      },
      session,
      staleMessage: 'Replacement cannot be cancelled',
    });
    return view(cancelled);
  });

export const findById = async (id, session) => {
  const replacement = await repository.findById(id, session);
  return replacement ? view(replacement) : null;
};

export const listByInrRequest = async (inrRequestId, session) =>
  (await repository.listByInrRequest(inrRequestId, session)).map(view);
