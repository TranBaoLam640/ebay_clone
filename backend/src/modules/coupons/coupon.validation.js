import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const validateSchema = z.object({
  body: z
    .object({
      code: z.string().trim().min(1),
      selectedCartItemIds: z.array(objectId).min(1),
    })
    .strict(),
  params: z.object({}),
  query: z.object({}),
});
