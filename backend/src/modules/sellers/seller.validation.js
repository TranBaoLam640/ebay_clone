import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const sellerIdSchema = z.object({
  body: z.any(),
  params: z.object({ sellerId: objectId }),
  query: z.object({}).strict(),
});
