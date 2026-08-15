import { z } from 'zod';

const productParams = z.object({
  productId: z.string().uuid('Invalid product id'),
});
const money = z.number().int().positive();

export const placeBidSchema = z.object({
  body: z.object({ maxBid: money }).strict(),
  params: productParams,
  query: z.object({}).strict(),
});

export const bidHistorySchema = z.object({
  body: z.any(),
  params: productParams,
  query: z.object({}).strict(),
});

export const bidStatusSchema = z.object({
  body: z.any(),
  params: productParams,
  query: z.object({}).strict(),
});

export const buyNowSchema = z.object({
  body: z.object({}).strip(),
  params: productParams,
  query: z.object({}).strict(),
});
