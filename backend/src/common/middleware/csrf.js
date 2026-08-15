import crypto from 'node:crypto';
import { doubleCsrf } from 'csrf-csrf';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';

const bindingCookie = 'csrfBinding';
const cookieOptions = {
  sameSite: env.COOKIE_SAME_SITE,
  secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
  path: '/',
};
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies[bindingCookie] || '',
  cookieName: 'csrfToken',
  cookieOptions: { ...cookieOptions, httpOnly: false },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

export const csrfToken = (req, res) => {
  if (!req.cookies[bindingCookie]) {
    req.cookies[bindingCookie] = crypto.randomBytes(32).toString('hex');
    res.cookie(bindingCookie, req.cookies[bindingCookie], {
      ...cookieOptions,
      httpOnly: true,
    });
  }
  const token = generateCsrfToken(req, res);
  res.json({ success: true, data: { csrfToken: token } });
};

export const csrfProtection = (req, res, next) =>
  doubleCsrfProtection(req, res, (error) =>
    error
      ? next(new AppError(403, ERROR_CODES.INVALID_CSRF, 'Invalid CSRF token'))
      : next(),
  );
