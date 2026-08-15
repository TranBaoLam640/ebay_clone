import { z } from 'zod';

const productParams = z.object({
  productId: z.string().uuid('Invalid product id'),
});
const money = z.number().int().positive();

export const createOfferSchema = z.object({
  body: z
    .object({
      amount: money,
      quantity: z.number().int().positive().max(999).optional(),
      message: z.string().trim().max(500).optional(),
    })
    .strict(),
  params: productParams,
  query: z.object({}).strict(),
});

export const offerIdSchema = z.object({
  body: z.any(),
  params: z.object({
    offerId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier'),
  }),
  query: z.object({}).strict(),
});
