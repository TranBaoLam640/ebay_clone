import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const listSchema = z.object({
  body: z.any(),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    isRead: z.enum(['true', 'false']).optional(),
    type: z
      .enum(['ACCOUNT', 'ORDER', 'PAYMENT', 'RETURN', 'PROMOTION', 'SYSTEM'])
      .optional(),
  }),
});
export const notificationIdSchema = z.object({
  body: z.any(),
  params: z.object({ notificationId: objectId }),
  query: z.object({}),
});
