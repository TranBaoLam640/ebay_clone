import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const productUuid = z.string().uuid('Invalid product id');
const attachment = z
  .object({
    url: z.url(),
    fileName: z.string().trim().max(255).optional(),
    mimeType: z.string().trim().max(120),
    size: z.number().int().nonnegative().max(10 * 1024 * 1024).optional(),
    type: z.enum(['IMAGE', 'FILE']).optional(),
  })
  .strict();

export const listConversationsSchema = z.object({
  body: z.any(),
  params: z.object({}).strict(),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      before: z.coerce.date().optional(),
    })
    .strict(),
});

export const createConversationSchema = z.object({
  body: z
    .object({
      productId: productUuid,
      orderId: objectId.optional(),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const conversationIdSchema = z.object({
  body: z.any(),
  params: z.object({ id: objectId }),
  query: z.object({}).strict(),
});

export const listMessagesSchema = z.object({
  body: z.any(),
  params: z.object({ id: objectId }),
  query: z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(30),
      before: objectId.optional(),
    })
    .strict(),
});

export const sendMessageSchema = z.object({
  body: z
    .object({
      type: z.enum(['TEXT', 'IMAGE', 'FILE']).default('TEXT'),
      clientMessageId: z.string().trim().max(100).optional(),
      content: z.string().trim().max(4000).optional(),
      attachments: z.array(attachment).max(5).default([]),
      sendCopyToEmail: z.boolean().default(false),
    })
    .strict(),
  params: z.object({ id: objectId }),
  query: z.object({}).strict(),
});
