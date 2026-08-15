import { Router } from 'express';
import { validate } from '../../common/middleware/validate.js';
import * as c from './controller.js';
import { csrfToken } from '../../common/middleware/csrf.js';
import {
  loginSchema,
  registerSchema,
  resendSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';
// Rate limiting is handled at the ingress-nginx layer (see infrastructure/kubernetes),
// keeping the Express server stateless for horizontal scaling.
export const authRoute = Router();
authRoute.get('/csrf-token', csrfToken);
authRoute.post('/register', validate(registerSchema), c.register);
authRoute.post('/verify-email', validate(otpSchema), c.verifyEmail);
authRoute.post(
  '/resend-verification',
  validate(resendSchema),
  c.resendVerification,
);
authRoute.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  c.forgotPassword,
);
authRoute.post(
  '/reset-password',
  validate(resetPasswordSchema),
  c.resetPassword,
);
authRoute.post(
  '/resend-reset-password',
  validate(forgotPasswordSchema),
  c.resendPasswordReset,
);
authRoute.post('/login', validate(loginSchema), c.login);
authRoute.post('/refresh', c.refresh);
authRoute.post('/logout', c.logout);
