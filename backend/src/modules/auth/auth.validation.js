import { z } from 'zod';
const password = z
  .string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);
export const registerSchema = z.object({
  body: z.object({
    email: z.email(),
    password,
    fullName: z.string().trim().min(1),
  }),
  params: z.object({}),
  query: z.object({}),
});
export const loginSchema = z.object({
  body: z.object({ email: z.email(), password: z.string() }),
  params: z.object({}),
  query: z.object({}),
});
export const otpSchema = z.object({
  body: z.object({ email: z.email(), otp: z.string().regex(/^\d{6}$/) }),
  params: z.object({}),
  query: z.object({}),
});
export const resendSchema = z.object({
  body: z.object({ email: z.email() }),
  params: z.object({}),
  query: z.object({}),
});
export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.email() }),
  params: z.object({}),
  query: z.object({}),
});
export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.email(),
    otp: z.string().regex(/^\d{6}$/),
    newPassword: password,
  }),
  params: z.object({}),
  query: z.object({}),
});
