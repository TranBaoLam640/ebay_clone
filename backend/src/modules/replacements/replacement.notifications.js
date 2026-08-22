import { USER4_NOTIFICATION_EVENTS } from '../../common/constants/user4-notification-events.js';
import { INR_REFERENCE_TYPE } from '../inr-requests/inr-request.constants.js';
import * as notificationService from '../notifications/service.js';
import * as sellerRepository from '../sellers/seller.repository.js';

const replacementKey = (replacement, event) =>
  `${event}:${replacement._id ?? replacement.id}`;

const refundRequestedKey = (request) =>
  `${USER4_NOTIFICATION_EVENTS.INR_REFUND_REQUESTED}:${request._id ?? request.id}:SELLER`;

const sellerUserId = async (sellerId, session) => {
  const seller = await sellerRepository.findById(sellerId, session);
  return seller?.userId ?? null;
};

const disputeNotification = (
  userId,
  { title, message, referenceId, eventType, eventKey },
  session,
) =>
  notificationService.createNotification(
    userId,
    {
      type: 'DISPUTE',
      title,
      message,
      referenceType: INR_REFERENCE_TYPE,
      referenceId,
      eventType,
      eventKey,
    },
    session,
  );

export const notifyReplacementProposed = async (replacement, session) => {
  const eventType = USER4_NOTIFICATION_EVENTS.REPLACEMENT_PROPOSED;
  if (replacement.initiatorRole === 'SELLER') {
    return disputeNotification(
      replacement.buyerId,
      {
        title: 'Replacement offered',
        message: 'The seller offered a replacement for your missing item.',
        referenceId: replacement.inrRequestId,
        eventType,
        eventKey: `${replacementKey(replacement, eventType)}:BUYER`,
      },
      session,
    );
  }
  const recipient = await sellerUserId(replacement.sellerId, session);
  if (!recipient) return null;
  return disputeNotification(
    recipient,
    {
      title: 'Replacement requested',
      message: 'The buyer requested a replacement for the missing item.',
      referenceId: replacement.inrRequestId,
      eventType,
      eventKey: `${replacementKey(replacement, eventType)}:SELLER`,
    },
    session,
  );
};

export const notifyReplacementAccepted = async (replacement, session) => {
  const eventType = USER4_NOTIFICATION_EVENTS.REPLACEMENT_ACCEPTED;
  if (replacement.initiatorRole === 'SELLER') {
    const recipient = await sellerUserId(replacement.sellerId, session);
    if (!recipient) return null;
    return disputeNotification(
      recipient,
      {
        title: 'Replacement accepted',
        message: 'The buyer accepted your replacement offer.',
        referenceId: replacement.inrRequestId,
        eventType,
        eventKey: `${replacementKey(replacement, eventType)}:SELLER`,
      },
      session,
    );
  }
  return disputeNotification(
    replacement.buyerId,
    {
      title: 'Replacement accepted',
      message: 'The seller accepted your replacement request.',
      referenceId: replacement.inrRequestId,
      eventType,
      eventKey: `${replacementKey(replacement, eventType)}:BUYER`,
    },
    session,
  );
};

export const notifyReplacementDeclined = async (replacement, session) => {
  const eventType = USER4_NOTIFICATION_EVENTS.REPLACEMENT_DECLINED;
  if (replacement.initiatorRole === 'SELLER') {
    const recipient = await sellerUserId(replacement.sellerId, session);
    if (!recipient) return null;
    return disputeNotification(
      recipient,
      {
        title: 'Replacement declined',
        message: 'Your replacement offer was declined.',
        referenceId: replacement.inrRequestId,
        eventType,
        eventKey: `${replacementKey(replacement, eventType)}:SELLER`,
      },
      session,
    );
  }
  return disputeNotification(
    replacement.buyerId,
    {
      title: 'Replacement declined',
      message: 'Your replacement request was declined.',
      referenceId: replacement.inrRequestId,
      eventType,
      eventKey: `${replacementKey(replacement, eventType)}:BUYER`,
    },
    session,
  );
};

export const notifyReplacementCancelled = async (
  replacement,
  actorRole,
  session,
) => {
  if (replacement.cancellation?.reason === 'REFUND_INSTEAD') return null;
  const eventType = USER4_NOTIFICATION_EVENTS.REPLACEMENT_CANCELLED;
  const recipient =
    actorRole === 'BUYER'
      ? await sellerUserId(replacement.sellerId, session)
      : replacement.buyerId;
  if (!recipient) return null;
  return disputeNotification(
    recipient,
    {
      title: 'Replacement cancelled',
      message: 'The replacement arrangement was cancelled.',
      referenceId: replacement.inrRequestId,
      eventType,
      eventKey: `${replacementKey(replacement, eventType)}:${actorRole === 'BUYER' ? 'SELLER' : 'BUYER'}`,
    },
    session,
  );
};

export const notifyRefundInsteadRequested = async (request, session) => {
  const recipient = await sellerUserId(request.sellerId, session);
  if (!recipient) return null;
  return disputeNotification(
    recipient,
    {
      title: 'Refund requested',
      message: 'The buyer wants a refund instead of the replacement.',
      referenceId: request._id,
      eventType: USER4_NOTIFICATION_EVENTS.INR_REFUND_REQUESTED,
      eventKey: refundRequestedKey(request),
    },
    session,
  );
};

export const notifyReplacementInTransit = (replacement, session) =>
  disputeNotification(
    replacement.buyerId,
    {
      title: 'Replacement shipped',
      message: 'Your replacement is now in transit.',
      referenceId: replacement.inrRequestId,
      eventType: USER4_NOTIFICATION_EVENTS.REPLACEMENT_IN_TRANSIT,
      eventKey: `${replacementKey(
        replacement,
        USER4_NOTIFICATION_EVENTS.REPLACEMENT_IN_TRANSIT,
      )}:BUYER`,
    },
    session,
  );

export const notifyReplacementDelivered = (replacement, session) =>
  disputeNotification(
    replacement.buyerId,
    {
      title: 'Replacement delivered',
      message: 'Your replacement shipment was marked as delivered.',
      referenceId: replacement.inrRequestId,
      eventType: USER4_NOTIFICATION_EVENTS.REPLACEMENT_DELIVERED,
      eventKey: `${replacementKey(
        replacement,
        USER4_NOTIFICATION_EVENTS.REPLACEMENT_DELIVERED,
      )}:BUYER`,
    },
    session,
  );

export const notifyReplacementCompleted = async (replacement, session) => {
  const recipient = await sellerUserId(replacement.sellerId, session);
  if (!recipient) return null;
  return disputeNotification(
    recipient,
    {
      title: 'Replacement received',
      message: 'The buyer confirmed receiving the replacement.',
      referenceId: replacement.inrRequestId,
      eventType: USER4_NOTIFICATION_EVENTS.REPLACEMENT_COMPLETED,
      eventKey: `${replacementKey(
        replacement,
        USER4_NOTIFICATION_EVENTS.REPLACEMENT_COMPLETED,
      )}:SELLER`,
    },
    session,
  );
};
