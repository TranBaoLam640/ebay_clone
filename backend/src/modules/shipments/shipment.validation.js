import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const empty = z.object({});

export const listSchema = z.object({
  body: z.any(),
  params: empty,
  query: z
    .object({
      scope: z.enum(['available', 'mine']).default('available'),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .strict(),
});

export const sellerListSchema = z.object({
  body: z.any(),
  params: empty,
  query: z
    .object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    })
    .strict(),
});

export const actionSchema = z.object({
  body: z.any(),
  params: z.object({ shipmentId: objectId }),
  query: empty,
});
