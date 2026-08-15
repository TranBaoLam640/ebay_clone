import { z } from 'zod';
import { RETURN_REASONS } from './return-request.constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const empty = z.object({});
const reason = z.enum(RETURN_REASONS);

export const createSchema = z.object({
  body: z
    .object({
      orderId: objectId,
      orderItemId: objectId,
      quantity: z.number().int().positive(),
      reason,
      details: z.string().trim().min(1).max(1000).optional(),
    })
    .strict(),
  params: empty,
  query: empty,
});

export const listSchema = z.object({
  body: z.any(),
  params: empty,
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const idSchema = z.object({
  body: z.any(),
  params: z.object({ returnId: objectId }),
  query: empty,
});
