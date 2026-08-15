import { ApiError } from '@/services/types';
import i18n from '@/i18n';

/** Map an unknown thrown value to a user-facing message. */
export function messageFromError(err: unknown, fallback = i18n.t('auth.errors.generic')): string {
  if (err instanceof ApiError) {
    if (err.details?.length) return err.details[0].message;
    return err.message || fallback;
  }
  return fallback;
}

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Client-side password check mirroring the backend policy. */
export function validatePassword(password: string): string | null {
  if (!PASSWORD_RULE.test(password)) {
    return i18n.t('auth.errors.passwordPolicy');
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return i18n.t('auth.errors.invalidEmail');
  return null;
}
