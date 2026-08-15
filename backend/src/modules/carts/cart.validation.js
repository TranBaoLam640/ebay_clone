import { z } from 'zod';

// Products are addressed by public uuid at the API boundary.
const productUuid = z.string().uuid('Invalid product id');
const quantity = z.number().int().positive();
const empty = z.object({});

export const itemSchema = z.object({
  body: z.object({ productId: productUuid, quantity }).strict(),
  params: empty,
  query: empty,
});
export const updateItemSchema = z.object({
  body: z.object({ quantity }).strict(),
  params: z.object({ productId: productUuid }),
  query: empty,
});
export const productIdSchema = z.object({
  body: z.any(),
  params: z.object({ productId: productUuid }),
  query: empty,
});
export const syncSchema = z.object({
  body: z
    .object({
      items: z.array(z.object({ productId: productUuid, quantity }).strict()),
    })
    .strict(),
  params: empty,
  query: empty,
});
