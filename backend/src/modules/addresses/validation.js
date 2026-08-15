import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const fields = {
  recipientName: z.string().min(1),
  phone: z.string().min(1),
  addressLine: z.string().min(1),
  ward: z.string().min(1),
  district: z.string().min(1),
  province: z.string().min(1),
  country: z.string().min(1),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
};
export const createSchema = z.object({
  body: z.object(fields),
  params: z.object({}),
  query: z.object({}),
});
export const updateSchema = z.object({
  body: z.object(fields).partial().strict(),
  params: z.object({ addressId: objectId }),
  query: z.object({}),
});
export const addressIdSchema = z.object({
  body: z.any(),
  params: z.object({ addressId: objectId }),
  query: z.object({}),
});
