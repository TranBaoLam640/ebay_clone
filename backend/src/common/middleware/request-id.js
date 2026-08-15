import crypto from 'node:crypto';
export const requestId = (req, res, next) => {
  const supplied = req.headers['x-request-id'];
  req.id =
    typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(supplied)
      ? supplied
      : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
