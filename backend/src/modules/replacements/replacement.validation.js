import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const empty = z.object({}).strict();
export const replacementIdSchema = z.object({
  body: z.any(),
  params: z.object({ replacementId: objectId }).strict(),
  query: empty,
});
