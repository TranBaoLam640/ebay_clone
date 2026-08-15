import { success } from '../../common/utils/api-response.js';
import * as svc from './service.js';
import { AppError } from '../../common/errors/app-error.js';
import { ERROR_CODES } from '../../common/constants/error-codes.js';
import {
  accessCookieOptions,
  refreshCookieOptions,
  accessCookie,
  refreshCookie,
} from '../../config/cookies.js';

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie(accessCookie, accessToken, accessCookieOptions);
  res.cookie(refreshCookie, refreshToken, refreshCookieOptions);
};
const authError = () =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid credentials');

export const register = async (req, res, next) => {
  try {
    const out = await svc.register(req.validated.body);
    success(
      res,
      {
        email: out.user.email,
        otpExpiresInSeconds: out.otpExpiresInSeconds,
        resendAvailableInSeconds: out.resendAvailableInSeconds,
      },
      201,
    );
  } catch (e) {
    next(e);
  }
};
export const verifyEmail = async (req, res, next) => {
  try {
    await svc.verifyEmail(req.validated.body);
    success(res, { verified: true });
  } catch (e) {
    next(e);
  }
};
export const resendVerification = async (req, res, next) => {
  try {
    await svc.resendVerification(req.validated.body.email);
    success(res, { sent: true });
  } catch (e) {
    next(e);
  }
};
export const forgotPassword = async (req, res, next) => {
  try {
    await svc.forgotPassword(req.validated.body.email);
    success(res, { sent: true });
  } catch (e) {
    next(e);
  }
};
export const resetPassword = async (req, res, next) => {
  try {
    await svc.resetPassword(req.validated.body);
    success(res, { reset: true });
  } catch (e) {
    next(e);
  }
};
export const resendPasswordReset = async (req, res, next) => {
  try {
    await svc.resendPasswordReset(req.validated.body.email);
    success(res, { sent: true });
  } catch (e) {
    next(e);
  }
};
export const login = async (req, res, next) => {
  try {
    const out = await svc.login(
      req.validated.body.email,
      req.validated.body.password,
      req.ip,
      req.get('user-agent'),
    );
    setCookies(res, out.accessToken, out.refreshToken);
    success(res, { user: { id: out.user.id, email: out.user.email } });
  } catch (e) {
    next(e instanceof AppError ? e : authError());
  }
};
export const refresh = async (req, res, next) => {
  try {
    const out = await svc.rotate(
      req.cookies[refreshCookie],
      req.ip,
      req.get('user-agent'),
    );
    setCookies(res, out.accessToken, out.refreshToken);
    success(res, { refreshed: true });
  } catch {
    next(authError());
  }
};
export const logout = async (req, res, next) => {
  try {
    await svc.logout(req.cookies[refreshCookie]);
    res.clearCookie(accessCookie, accessCookieOptions);
    res.clearCookie(refreshCookie, refreshCookieOptions);
    success(res, { loggedOut: true });
  } catch (e) {
    next(e);
  }
};
