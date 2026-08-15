import { z } from 'zod';

// Categories are addressed by public uuid at the API boundary.
const categoryUuid = z.string().uuid('Invalid category id');

export const listCategoriesSchema = z.object({
  body: z.any(),
  params: z.object({}),
  query: z.object({ parentId: categoryUuid.optional() }).strict(),
});

export const categoryIdSchema = z.object({
  body: z.any(),
  params: z.object({ categoryId: categoryUuid }),
  query: z.object({}).strict(),
});
