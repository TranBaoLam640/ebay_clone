import { env } from './env.js';

const durationToMilliseconds = (value) => {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(value);
  if (!match) throw new Error(`Unsupported cookie duration: ${value}`);
  const units = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * units[match[2].toLowerCase()];
};
const base = {
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
  sameSite: env.COOKIE_SAME_SITE,
};
if (env.COOKIE_DOMAIN) base.domain = env.COOKIE_DOMAIN;
export const accessCookieOptions = Object.freeze({
  ...base,
  path: '/',
  maxAge: durationToMilliseconds(env.JWT_ACCESS_EXPIRES_IN),
});
export const refreshCookieOptions = Object.freeze({
  ...base,
  path: '/api/v1/auth',
  maxAge: durationToMilliseconds(env.JWT_REFRESH_EXPIRES_IN),
});
export const accessCookie = 'accessToken';
export const refreshCookie = 'refreshToken';
