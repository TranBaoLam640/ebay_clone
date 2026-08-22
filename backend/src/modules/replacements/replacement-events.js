import * as conversationRepository from '../conversations/conversation.repository.js';
import { emitToConversation } from '../../socket/socket.js';

export const emitReplacementUpdate = async (replacementId) => {
  const message =
    await conversationRepository.findMessageByReplacementId(replacementId);
  if (!message) return;
  emitToConversation(message.conversationId, 'replacement:updated', {
    conversationId: String(message.conversationId),
    replacementId: String(replacementId),
    messageId: String(message._id),
  });
};
