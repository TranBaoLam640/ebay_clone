import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const paymentActionSchema = z.object({
  body: z.object({ checkoutGroupId: objectId }).strict(),
  params: z.object({}),
  query: z.object({}),
});
