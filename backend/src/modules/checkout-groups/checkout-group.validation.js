import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const groupSchema = z.object({
  body: z.any(),
  params: z.object({ checkoutGroupId: objectId }),
  query: z.object({}),
});
