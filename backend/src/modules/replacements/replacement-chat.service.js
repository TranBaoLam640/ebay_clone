import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import * as conversationRepository from '../conversations/conversation.repository.js';
import * as conversationService from '../conversations/conversation.service.js';
import * as inrRepository from '../inr-requests/inr-request.repository.js';
import { emitToConversation } from '../../socket/socket.js';
import * as replacementRepository from './replacement.repository.js';
import * as replacementService from './replacement.service.js';
import { emitReplacementUpdate } from './replacement-events.js';

const invalidState = (message) =>
  new AppError(409, ERROR_CODES.CONFLICT, message);

const isDuplicateReplacementMessage = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.replacementId || error?.keyValue?.replacementId);

const createReplacementMessage = async ({
  conversation,
  replacement,
  userId,
  session,
}) => {
  try {
    const [message] = await conversationRepository.addMessage(
      {
        conversationId: conversation._id,
        senderId: userId,
        type: 'REPLACEMENT',
        replacementId: replacement.id,
        content: null,
        status: 'SENT',
      },
      session,
    );
    const senderRole =
      String(conversation.buyerId) === String(userId) ? 'BUYER' : 'SELLER';
    await conversationRepository.updateAfterMessage(
      conversation,
      message,
      senderRole === 'BUYER' ? 'SELLER' : 'BUYER',
      session,
    );
    return message;
  } catch (error) {
    if (isDuplicateReplacementMessage(error)) {
      const existing = await conversationRepository.findMessageByReplacementId(
        replacement.id,
        session,
      );
      if (existing) return existing;
    }
    throw error;
  }
};

export const proposeForInr = async (userId, inrRequestId) => {
  const { message } = await conversationRepository.transaction(
    async (session) => {
      const replacement = await replacementService.proposeInSession(
        userId,
        { inrRequestId },
        session,
      );
      const request = await inrRepository.findById(inrRequestId, session);
      if (!request?.conversationId)
        throw invalidState('INR request has no linked conversation');
      const conversation = await conversationRepository.findById(
        request.conversationId,
        session,
      );
      if (!conversation)
        throw new AppError(
          404,
          ERROR_CODES.NOT_FOUND,
          'Conversation not found',
        );
      const savedMessage = await createReplacementMessage({
        conversation,
        replacement,
        userId,
        session,
      });
      return { replacement, message: savedMessage };
    },
  );

  const view = await conversationService.messageForUser(userId, message);
  emitToConversation(message.conversationId, 'message:new', view);
  emitToConversation(message.conversationId, 'conversation:updated', {
    id: String(message.conversationId),
    lastMessage: view,
  });
  return view;
};

export const replacementForUser = async (userId, replacementId) => {
  const message =
    await conversationRepository.findMessageByReplacementId(replacementId);
  if (!message)
    throw new AppError(
      404,
      ERROR_CODES.NOT_FOUND,
      'Replacement message not found',
    );
  const view = await conversationService.messageForUser(userId, message);
  return view.replacement;
};

export const emitLatestReplacementUpdateForInr = async (inrRequestId) => {
  const [replacement] =
    await replacementRepository.listByInrRequest(inrRequestId);
  if (replacement) await emitReplacementUpdate(replacement._id);
};

export const accept = async (userId, replacementId) => {
  const replacement = await replacementService.accept(userId, replacementId);
  await emitReplacementUpdate(replacement.id);
  return replacementForUser(userId, replacement.id);
};

export const decline = async (userId, replacementId) => {
  const replacement = await replacementService.decline(userId, replacementId);
  await emitReplacementUpdate(replacement.id);
  return replacementForUser(userId, replacement.id);
};

export const prepareShipment = async (userId, replacementId) => {
  const result = await replacementService.prepareShipment(
    userId,
    replacementId,
  );
  await emitReplacementUpdate(result.replacement.id);
  return {
    replacementId: result.replacement.id,
    shipment: {
      id: String(result.shipment._id),
      carrier: result.shipment.carrier,
      trackingNumber: result.shipment.trackingNumber,
      status: result.shipment.status,
      estimatedDeliveryAt: result.shipment.estimatedDeliveryAt,
      pickedUpAt: result.shipment.pickedUpAt ?? null,
      deliveredAt: result.shipment.deliveredAt ?? null,
    },
  };
};
