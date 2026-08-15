import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
export const signAccess = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN, algorithm: 'HS256' },
  );
export const signRefresh = (user) =>
  jwt.sign(
    { sub: user.id, type: 'refresh', jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256' },
  );
export const verifyAccess = (token) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
export const verifyRefresh = (token) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
