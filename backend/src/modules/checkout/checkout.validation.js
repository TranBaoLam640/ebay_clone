import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const checkoutBody = z
  .object({
    selectedCartItemIds: z.array(objectId).min(1),
    addressId: objectId,
    couponCode: z.string().trim().min(1).optional(),
    paymentMethod: z.enum(['COD', 'PAYPAL']),
  })
  .strict();
export const previewSchema = z.object({
  body: checkoutBody,
  params: z.object({}),
  query: z.object({}),
});
export const executeSchema = previewSchema;
