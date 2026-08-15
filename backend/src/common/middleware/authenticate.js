import { verifyAccess } from '../utils/token.js';
import * as userService from '../../modules/users/service.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../constants/error-codes.js';
import { USER_STATUS } from '../constants/user-status.js';

// Resolve the access-token cookie to an active user, or null when there is no
// token / it is invalid / the account is not active. Never throws, so the strict
// and optional middlewares below share one resolution path.
const resolveUser = async (req) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) return null;
    const payload = verifyAccess(token);
    if (payload.type !== 'access') return null;
    const user = await userService.getAuthenticatedUser(payload.sub);
    if (!user || user.status !== USER_STATUS.ACTIVE) return null;
    return { id: user.id, role: user.role };
  } catch {
    return null;
  }
};

const attach = (req, user) => {
  req.user = user;
  req.log = req.log?.child({ userId: user.id }) || req.log;
};

export const authenticate = async (req, res, next) => {
  const user = await resolveUser(req);
  if (!user)
    return next(
      new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'),
    );
  attach(req, user);
  next();
};

/**
 * Identify the caller when they happen to be signed in, but never reject an
 * anonymous one. For public endpoints whose response is *personalised* rather
 * than gated — e.g. bid history, which unmasks the viewer's own rows.
 */
export const optionalAuthenticate = async (req, res, next) => {
  const user = await resolveUser(req);
  if (user) attach(req, user);
  next();
};
