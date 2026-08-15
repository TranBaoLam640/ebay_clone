import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const orderStatuses = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PAYMENT_FAILED',
  'DELIVERED',
];

export const listSchema = z.object({
  body: z.any(),
  params: z.object({}),
  query: z
    .object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(100).optional(),
      status: z.enum(orderStatuses).optional(),
      sellerId: objectId.optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      sort: z.enum(['newest', 'oldest']).default('newest'),
    })
    .refine((value) => !value.from || !value.to || value.from <= value.to, {
      message: 'from must not be after to',
      path: ['from'],
    }),
});

export const getSchema = z.object({
  body: z.any(),
  params: z.object({ orderId: objectId }),
  query: z.object({}),
});

export const checkoutOrderSchema = z.object({
  body: z
    .object({
      addressId: objectId,
      paymentMethod: z.enum(['COD', 'PAYPAL']),
    })
    .strict(),
  params: z.object({ orderId: objectId }),
  query: z.object({}),
});
