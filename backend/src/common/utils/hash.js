import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
export const hashPassword = (value) => bcrypt.hash(value, 12);
export const verifyPassword = (value, hash) => bcrypt.compare(value, hash);
export const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const generateEmailOtp = () =>
  crypto.randomInt(0, 1000000).toString().padStart(6, '0');
export const hashEmailOtp = (email, otp, secret) =>
  crypto.createHmac('sha256', secret).update(`${email}:${otp}`).digest('hex');
export const verifyEmailOtpHash = (candidate, stored) => {
  const candidateBuffer = Buffer.from(candidate, 'hex');
  const storedBuffer = Buffer.from(stored, 'hex');
  return (
    candidateBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(candidateBuffer, storedBuffer)
  );
};
