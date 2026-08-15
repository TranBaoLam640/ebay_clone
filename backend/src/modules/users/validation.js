import { z } from 'zod';
export const updateSchema = z.object({
  body: z
    .object({
      fullName: z.string().min(1).optional(),
      phone: z.string().nullish(),
      avatarUrl: z.union([z.url(), z.literal('')]).nullish(),
    })
    .strict(),
  params: z.object({}),
  query: z.object({}),
});
export const passwordSchema = z.object({
  body: z.object({
    currentPassword: z.string(),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
  }),
  params: z.object({}),
  query: z.object({}),
});
