import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const empty = z.object({}).strict();

export const listCatalogProductsSchema = z
  .object({
    body: z.any(),
    params: empty,
    query: z
      .object({
        q: z.string().trim().min(1).max(200).optional(),
        ePID: z.string().trim().min(1).max(80).optional(),
        brand: z.string().trim().min(1).max(120).optional(),
        model: z.string().trim().min(1).max(120).optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .strict(),
  })
  .strict();

export const catalogProductIdSchema = z
  .object({
    body: z.any(),
    params: z.object({ catalogProductId: objectId }).strict(),
    query: empty,
  })
  .strict();
