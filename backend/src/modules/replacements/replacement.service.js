import { ERROR_CODES } from '../../common/constants/error-codes.js';
import { AppError } from '../../common/errors/app-error.js';
import * as checkoutRepository from '../checkout/checkout.repository.js';
import * as inrRepository from '../inr-requests/inr-request.repository.js';
import * as orderRepository from '../orders/order.repository.js';
import * as productRepository from '../products/product.repository.js';
import * as sellerRepository from '../sellers/seller.repository.js';
import {
  estimatedDeliveryAt,
  generateTrackingNumber,
} from '../shipments/shipment.service.js';
import * as shipmentRepository from '../shipments/shipment.repository.js';
import { SHIPMENT_CARRIERS } from '../shipments/shipment.constants.js';
import {
  REPLACEMENT_ACTIVE_KEY,
  REPLACEMENT_TERMINAL_STATUSES,
} from './replacement.constants.js';
import {
  notifyRefundInsteadRequested,
  notifyReplacementAccepted,
  notifyReplacementCancelled,
  notifyReplacementDeclined,
  notifyReplacementProposed,
} from './replacement.notifications.js';
import * as repository from './replacement.repository.js';

const notFound = () =>
  new AppError(404, ERROR_CODES.NOT_FOUND, 'Replacement not found');
const forbidden = (message) =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);
const invalidState = (message) =>
  new AppError(409, ERROR_CODES.CONFLICT, message);
const insufficientStock = () =>
  new AppError(
    409,
    ERROR_CODES.INSUFFICIENT_STOCK,
    'Replacement inventory is unavailable',
  );

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

const duplicateReplacementShipment = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.replacementId || error?.keyValue?.replacementId);

const duplicateTracking = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.trackingNumber || error?.keyValue?.trackingNumber);

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
  inventoryClaimStatus: replacement.inventoryClaimStatus ?? 'UNCLAIMED',
  inventoryClaimedAt: replacement.inventoryClaimedAt ?? null,
  inventoryReleasedAt: replacement.inventoryReleasedAt ?? null,
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

const assertCancellationAllowed = (replacement, userId, role) => {
  if (replacement.status === 'PROPOSED') {
    if (String(replacement.initiatedBy) !== String(userId))
      throw forbidden(
        'Only the initiator can cancel this replacement proposal',
      );
    return;
  }
  if (replacement.status === 'ACCEPTED') {
    if (!role) throw forbidden('Only the INR buyer or seller can cancel');
    return;
  }
  throw invalidState('Replacement cannot be cancelled');
};

const assertSellerOwnsReplacement = (replacement, role) => {
  if (role !== 'SELLER')
    throw forbidden('Only the owning seller can prepare replacement shipment');
  if (replacement.status !== 'ACCEPTED')
    throw invalidState('Replacement shipment requires accepted replacement');
  if (replacement.inventoryClaimStatus !== 'CLAIMED')
    throw invalidState('Replacement shipment requires claimed inventory');
};

const ensureReplacementMode = async (replacement, session) => {
  const request = await inrRepository.requireReplacementResolution(
    replacement.inrRequestId,
    session,
  );
  if (!request)
    throw invalidState('INR is not on the replacement resolution path');
  return request;
};

const releaseReplacementMode = async (replacement, session, now) => {
  const request = await inrRepository.releaseReplacementResolution(
    replacement.inrRequestId,
    session,
    now,
  );
  if (!request)
    throw invalidState('Replacement resolution could not be released');
  return request;
};

const terminalUpdateForRefund = ({ replacement, userId, role, now }) => {
  const actorIsInitiator = role === replacement.initiatorRole;
  if (actorIsInitiator)
    return {
      status: 'CANCELLED',
      update: {
        $set: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: now,
          inventoryClaimStatus: 'UNCLAIMED',
          cancellation: { reason: 'REFUND_INSTEAD' },
        },
        $unset: { activeKey: 1 },
      },
    };
  return {
    status: 'DECLINED',
    update: {
      $set: {
        status: 'DECLINED',
        declinedBy: userId,
        declinedAt: now,
        inventoryClaimStatus: 'UNCLAIMED',
        decline: { reason: 'REFUND_INSTEAD' },
      },
      $unset: { activeKey: 1 },
    },
  };
};

const cancelAcceptedForRefund = async ({
  replacement,
  userId,
  session,
  now,
}) => {
  const shipment = await shipmentRepository.findByReplacementId(
    replacement._id,
    session,
  );
  if (shipment && shipment.status !== 'READY_FOR_PICKUP')
    throw invalidState('Replacement cannot switch to refund after pickup');
  if (shipment) {
    const cancelledShipment =
      await shipmentRepository.cancelReadyForPickupByReplacementId(
        replacement._id,
        now,
        session,
      );
    if (!cancelledShipment)
      throw invalidState('Replacement shipment cannot be cancelled');
  }
  const restored = await productRepository.restoreStock(
    replacement.productId,
    replacement.quantity,
    session,
  );
  if (!restored?.matchedCount)
    throw invalidState('Replacement inventory could not be released');
  return transitionOrThrow({
    id: replacement._id,
    from: ['ACCEPTED'],
    filter: { inventoryClaimStatus: 'CLAIMED' },
    update: {
      $set: {
        status: 'CANCELLED',
        cancelledBy: userId,
        cancelledAt: now,
        inventoryClaimStatus: 'RELEASED',
        inventoryReleasedAt: now,
        cancellation: { reason: 'REFUND_INSTEAD' },
      },
      $unset: { activeKey: 1 },
    },
    session,
    staleMessage: 'Replacement cannot switch to refund',
  });
};

const terminalizeForRefund = async ({
  replacement,
  userId,
  role,
  session,
  now,
}) => {
  await ensureReplacementMode(replacement, session);
  if (replacement.status === 'PROPOSED') {
    const { update } = terminalUpdateForRefund({
      replacement,
      userId,
      role,
      now,
    });
    const changed = await repository.transition(
      replacement._id,
      ['PROPOSED'],
      update,
      session,
      { inventoryClaimStatus: 'UNCLAIMED' },
    );
    if (changed) return changed;
    const current = await repository.findById(replacement._id, session);
    if (!current) throw notFound();
    if (current.status === 'ACCEPTED')
      return cancelAcceptedForRefund({
        replacement: current,
        userId,
        session,
        now,
      });
    if (REPLACEMENT_TERMINAL_STATUSES.includes(current.status))
      throw invalidState('Terminal replacement cannot be changed');
    throw invalidState('Replacement can no longer switch to refund');
  }
  if (replacement.status === 'ACCEPTED')
    return cancelAcceptedForRefund({ replacement, userId, session, now });
  throw invalidState('Replacement cannot switch to refund after pickup');
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
  filter,
}) => {
  const changed = await repository.transition(
    id,
    from,
    update,
    session,
    filter,
  );
  if (changed) return changed;
  const current = await repository.findById(id, session);
  if (!current) throw notFound();
  if (REPLACEMENT_TERMINAL_STATUSES.includes(current.status))
    throw invalidState('Terminal replacement cannot be changed');
  throw invalidState(staleMessage);
};

export const proposeInSession = async (userId, input, session) => {
  const { request, item, initiatorRole } = await loadProposalContext(
    userId,
    input,
    session,
  );
  try {
    const claimedResolution = await inrRepository.acquireReplacementResolution(
      request._id,
      session,
    );
    if (!claimedResolution)
      throw invalidState('INR is already on another resolution path');
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
        inventoryClaimStatus: 'UNCLAIMED',
        activeKey: REPLACEMENT_ACTIVE_KEY,
      },
      session,
    );
    await notifyReplacementProposed(created, session);
    return view(created.toObject());
  } catch (error) {
    if (duplicateActive(error))
      throw invalidState('An active replacement already exists');
    throw error;
  }
};

export const propose = (userId, input) =>
  checkoutRepository.transaction((session) =>
    proposeInSession(userId, input, session),
  );

export const accept = (userId, id, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement, role } = await loadActionContext(userId, id, session);
    assertCounterparty(replacement, role, 'accept');
    await ensureReplacementMode(replacement, session);
    const claimed = await productRepository.deductStockForSeller(
      replacement.productId,
      replacement.sellerId,
      replacement.quantity,
      session,
    );
    if (!claimed) throw insufficientStock();
    const accepted = await transitionOrThrow({
      id,
      from: ['PROPOSED'],
      filter: { inventoryClaimStatus: 'UNCLAIMED' },
      update: {
        $set: {
          status: 'ACCEPTED',
          acceptedBy: userId,
          acceptedAt: now,
          inventoryClaimStatus: 'CLAIMED',
          inventoryClaimedAt: now,
          activeKey: REPLACEMENT_ACTIVE_KEY,
        },
      },
      session,
      staleMessage: 'Replacement is no longer proposed',
    });
    await notifyReplacementAccepted(accepted, session);
    return view(accepted);
  });

export const decline = (userId, id, input = {}, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement, role } = await loadActionContext(userId, id, session);
    assertCounterparty(replacement, role, 'decline');
    const declined = await transitionOrThrow({
      id,
      from: ['PROPOSED'],
      filter: { inventoryClaimStatus: 'UNCLAIMED' },
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
    await releaseReplacementMode(replacement, session, now);
    await notifyReplacementDeclined(declined, session);
    return view(declined);
  });

export const cancel = (userId, id, input = {}, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement, role } = await loadActionContext(userId, id, session);
    assertCancellationAllowed(replacement, userId, role);
    if (replacement.status === 'ACCEPTED') {
      const shipment = await shipmentRepository.findByReplacementId(
        replacement._id,
        session,
      );
      if (shipment && shipment.status !== 'READY_FOR_PICKUP')
        throw invalidState('Replacement cannot be cancelled after pickup');
      if (shipment) {
        const cancelledShipment =
          await shipmentRepository.cancelReadyForPickupByReplacementId(
            replacement._id,
            now,
            session,
          );
        if (!cancelledShipment)
          throw invalidState('Replacement shipment cannot be cancelled');
      }
      const restored = await productRepository.restoreStock(
        replacement.productId,
        replacement.quantity,
        session,
      );
      if (!restored?.matchedCount)
        throw invalidState('Replacement inventory could not be released');
    }
    const cancelled = await transitionOrThrow({
      id,
      from: [replacement.status],
      filter:
        replacement.status === 'ACCEPTED'
          ? { inventoryClaimStatus: 'CLAIMED' }
          : { inventoryClaimStatus: 'UNCLAIMED' },
      update: {
        $set: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: now,
          inventoryClaimStatus:
            replacement.status === 'ACCEPTED' ? 'RELEASED' : 'UNCLAIMED',
          ...(replacement.status === 'ACCEPTED' && {
            inventoryReleasedAt: now,
          }),
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
    await releaseReplacementMode(replacement, session, now);
    await notifyReplacementCancelled(cancelled, role, session);
    return view(cancelled);
  });

export const prepareShipment = (userId, id, { now = new Date() } = {}) =>
  checkoutRepository.transaction(async (session) => {
    const { replacement, role } = await loadActionContext(userId, id, session);
    assertSellerOwnsReplacement(replacement, role);
    await ensureReplacementMode(replacement, session);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const shipment = await shipmentRepository.create(
          {
            orderId: replacement.orderId,
            replacementId: replacement._id,
            buyerId: replacement.buyerId,
            sellerId: replacement.sellerId,
            purpose: 'REPLACEMENT',
            shipperId: null,
            carrier: SHIPMENT_CARRIERS.SBAY_EXPRESS,
            trackingNumber: generateTrackingNumber(),
            status: 'READY_FOR_PICKUP',
            estimatedDeliveryAt: estimatedDeliveryAt(now),
          },
          session,
        );
        return {
          replacement: view(replacement),
          shipment: shipmentRepository.toPublic(shipment),
        };
      } catch (error) {
        if (duplicateReplacementShipment(error))
          throw invalidState('Replacement shipment already exists');
        if (duplicateTracking(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error('Shipment tracking number generation failed');
  });

export const requestRefundInstead = (
  userId,
  inrRequestId,
  { now = new Date() } = {},
) =>
  checkoutRepository.transaction(async (session) => {
    const request = await inrRepository.findOwnedByBuyer(
      userId,
      inrRequestId,
      session,
    );
    if (!request)
      throw new AppError(
        404,
        ERROR_CODES.INR_NOT_FOUND,
        'INR request not found',
      );
    if (request.status !== 'OPEN')
      throw invalidState('INR request is not open');
    const replacement = await repository.findActiveByInrRequest(
      request._id,
      session,
    );
    if (!replacement) throw invalidState('No active replacement to switch');
    const switched = await terminalizeForRefund({
      replacement,
      userId,
      role: 'BUYER',
      session,
      now,
    });
    const updatedRequest = await inrRepository.switchReplacementToRefund(
      request._id,
      userId,
      session,
      now,
    );
    if (!updatedRequest)
      throw invalidState('INR could not switch to refund resolution');
    await notifyRefundInsteadRequested(updatedRequest, session);
    return { request: updatedRequest, replacement: view(switched) };
  });

export const prepareSellerRefundResolution = async ({
  sellerId,
  userId,
  request,
  session,
  now = new Date(),
}) => {
  const replacement = await repository.findActiveByInrRequest(
    request._id,
    session,
  );
  if (!replacement) {
    const claimed = await inrRepository.acquireRefundResolution(
      request._id,
      sellerId,
      session,
      now,
    );
    if (!claimed)
      throw invalidState('INR is already on another resolution path');
    return claimed;
  }
  await terminalizeForRefund({
    replacement,
    userId,
    role: 'SELLER',
    session,
    now,
  });
  const switched = await inrRepository.sellerSwitchReplacementToRefund(
    request._id,
    sellerId,
    session,
    now,
  );
  if (!switched)
    throw invalidState('INR could not switch to refund resolution');
  return switched;
};

export const findById = async (id, session) => {
  const replacement = await repository.findById(id, session);
  return replacement ? view(replacement) : null;
};

export const listByInrRequest = async (inrRequestId, session) =>
  (await repository.listByInrRequest(inrRequestId, session)).map(view);
