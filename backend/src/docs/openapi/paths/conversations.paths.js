import {
  body,
  collection,
  object,
  operation,
  parameter,
  ref,
  response,
  security,
} from '../components/index.js';

const conversationIdParam = parameter(
  'id',
  'path',
  ref('ObjectId'),
  true,
  'Conversation identifier.',
);

export const conversationPaths = {
  '/conversations': {
    get: operation({
      tag: 'Messaging',
      operationId: 'listConversations',
      summary: 'List buyer/seller conversations',
      description:
        'Lists conversations where the authenticated user is the buyer or owns the SellerProfile referenced by the conversation.',
      parameters: [
        parameter('limit', 'query', {
          type: 'integer',
          minimum: 1,
          maximum: 100,
        }),
        parameter('before', 'query', { type: 'string', format: 'date-time' }),
      ],
      success: response('Conversations', collection('Conversation')),
      errors: [400, 401, 429, 500],
      security: security.access,
    }),
    post: operation({
      tag: 'Messaging',
      operationId: 'createConversation',
      summary: 'Create or reuse a conversation',
      description:
        'Creates or reuses a PRE_PURCHASE conversation for a product. When orderId is supplied, validates the owned order and upgrades/reuses a POST_PURCHASE conversation while preserving message history.',
      requestBody: body({
        $ref: '#/components/schemas/CreateConversationRequest',
      }),
      success: response('Conversation', ref('Conversation')),
      successStatus: 201,
      errors: [400, 401, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/conversations/{id}/messages': {
    get: operation({
      tag: 'Messaging',
      operationId: 'listConversationMessages',
      summary: 'List conversation messages',
      parameters: [
        conversationIdParam,
        parameter('limit', 'query', {
          type: 'integer',
          minimum: 1,
          maximum: 100,
        }),
        parameter('before', 'query', ref('ObjectId')),
      ],
      success: response('Messages', collection('ConversationMessage')),
      errors: [400, 401, 403, 404, 429, 500],
      security: security.access,
    }),
    post: operation({
      tag: 'Messaging',
      operationId: 'sendConversationMessage',
      summary: 'Send a conversation message',
      description:
        'Persists a text/image/file message and emits message:new and conversation:updated to the Socket.IO conversation room. sendCopyToEmail uses the authenticated user email only.',
      parameters: [conversationIdParam],
      requestBody: body({ $ref: '#/components/schemas/SendMessageRequest' }),
      success: response('Message', ref('ConversationMessage')),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/conversations/{id}/attachments': {
    post: operation({
      tag: 'Messaging',
      operationId: 'uploadConversationAttachments',
      summary: 'Upload message attachments',
      description:
        'Uploads up to five image or supported document files for later use in a message. The multipart field name is files.',
      parameters: [conversationIdParam],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: object({
              files: {
                type: 'array',
                maxItems: 5,
                items: { type: 'string', format: 'binary' },
              },
            }),
          },
        },
      },
      success: response(
        'Uploaded attachments',
        ref('AttachmentUploadResponse'),
      ),
      successStatus: 201,
      errors: [400, 401, 403, 404, 413, 429, 500],
      security: security.unsafe,
    }),
  },
  '/conversations/{id}/read': {
    patch: operation({
      tag: 'Messaging',
      operationId: 'markConversationRead',
      summary: 'Mark conversation as read',
      parameters: [conversationIdParam],
      success: response('Conversation', ref('Conversation')),
      errors: [400, 401, 403, 404, 429, 500],
      security: security.unsafe,
    }),
  },
  '/conversations/{id}/archive': {
    patch: operation({
      tag: 'Messaging',
      operationId: 'archiveConversation',
      summary: 'Archive a conversation',
      parameters: [conversationIdParam],
      success: response('Conversation', ref('Conversation')),
      errors: [400, 401, 403, 404, 429, 500],
      security: security.unsafe,
    }),
  },
  '/conversations/{id}/offers': {
    post: operation({
      tag: 'Messaging',
      operationId: 'createConversationOffer',
      summary: 'Create an offer in a conversation',
      description:
        'Creates a PRE_PURCHASE offer message. POST_PURCHASE conversations reject new offers.',
      parameters: [conversationIdParam],
      requestBody: body({
        $ref: '#/components/schemas/ConversationOfferRequest',
      }),
      success: response('Offer', ref('Offer')),
      successStatus: 201,
      errors: [400, 401, 403, 404, 409, 413, 429, 500],
      security: security.unsafe,
    }),
  },
};
